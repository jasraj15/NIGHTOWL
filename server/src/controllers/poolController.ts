import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Pool, IPool } from '../models/Pool.js';
import { PoolItem } from '../models/PoolItem.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { Report } from '../models/Report.js';
import { PUBLIC_USER_FIELDS } from '../models/User.js';
import {
  createPoolSchema,
  orderPlacedSchema,
  joinPoolSchema,
  extendPoolSchema,
  lockPoolSchema,
  reportSchema,
  discoverPoolsQuerySchema,
  resolveDurationMinutes,
} from '../validators/poolSchemas.js';
import { checkAndExpirePool } from '../services/poolExpiryService.js';
import { broadcastPoolUpdate, SOCKET_EVENTS } from '../services/socketService.js';
import { notifyUsers } from '../services/notificationService.js';
import { syncContributionsForPool, getBreakdownForPool, sanitizeRecordForViewer } from '../services/paymentService.js';
import { env } from '../config/env.js';

const ACTIVE_STATUSES = ['OPEN', 'LOCKED', 'ORDERED'] as const;

function enrichPool(p: any) {
  const currentSubtotal = p.currentSubtotal || 0;
  const remainingAmount = Math.max(0, Math.round((p.targetAmount - currentSubtotal) * 100) / 100);
  const progressPercent = Math.min(100, Math.round((currentSubtotal / p.targetAmount) * 100));
  const participantCount = p.participants?.length || 0;
  return {
    ...p,
    remainingAmount,
    progressPercent,
    participantCount,
    serverTime: new Date().toISOString(),
  };
}

function poolCreatorIsUser(pool: IPool, userId: string): boolean {
  return pool.creator.toString() === userId.toString();
}

function isParticipant(pool: IPool, userId: string): boolean {
  return pool.participants.some((p) => p.toString() === userId.toString());
}

async function recalcSubtotal(pool: IPool): Promise<void> {
  const items = await PoolItem.find({ poolId: pool._id }).lean();
  pool.currentSubtotal = Math.round(items.reduce((s, it) => s + it.itemSubtotal, 0) * 100) / 100;
}

function retailerLabel(pool: IPool): string {
  return pool.retailer === 'Other' && pool.retailerCustomName ? pool.retailerCustomName : pool.retailer;
}

/* -------------------------------------------------------------------------- */
/*                                  Discovery                                 */
/* -------------------------------------------------------------------------- */

export async function getPools(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const q = discoverPoolsQuerySchema.parse(req.query);
    const query: any = {};

    if (q.hostel && q.hostel !== 'ALL') query.hostel = q.hostel;
    if (q.retailer && q.retailer !== 'ALL') query.retailer = q.retailer;
    if (q.status && q.status !== 'ALL') query.status = q.status;
    else if (!q.status) query.status = { $in: ['OPEN', 'LOCKED', 'ORDERED'] };

    if (q.search) {
      const safe = q.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      query.$or = [{ title: rx }, { deliveryZone: rx }, { retailerCustomName: rx }, { notes: rx }];
    }

    if (q.closingSoon === 'true') {
      query.status = 'OPEN';
      query.closingTime = { $gt: new Date(), $lte: new Date(Date.now() + 15 * 60 * 1000) };
    }

    if (q.maxRemaining !== undefined) {
      // remaining = target - current  <= maxRemaining
      query.$expr = { $lte: [{ $subtract: ['$targetAmount', '$currentSubtotal'] }, q.maxRemaining] };
    }

    if (q.minParticipants !== undefined || q.maxParticipants !== undefined) {
      const cond: any[] = [];
      if (q.minParticipants !== undefined) cond.push({ $gte: [{ $size: '$participants' }, q.minParticipants] });
      if (q.maxParticipants !== undefined) cond.push({ $lte: [{ $size: '$participants' }, q.maxParticipants] });
      query.$expr = query.$expr ? { $and: [query.$expr, ...cond] } : cond.length === 1 ? cond[0] : { $and: cond };
    }

    const sortMap: Record<string, any> = {
      closing: { status: 1, closingTime: 1, createdAt: -1 },
      newest: { createdAt: -1 },
      remaining: { currentSubtotal: -1 },
      participants: { createdAt: -1 },
    };

    const skip = (q.page - 1) * q.limit;
    const [pools, totalCount] = await Promise.all([
      Pool.find(query)
        .populate('creator', PUBLIC_USER_FIELDS)
        .populate('participants', PUBLIC_USER_FIELDS)
        .sort(sortMap[q.sort])
        .skip(skip)
        .limit(q.limit)
        .lean(),
      Pool.countDocuments(query),
    ]);

    // Lazily expire overdue open pools that the scheduler has not reached yet.
    const now = Date.now();
    for (const p of pools as any[]) {
      if (p.status === 'OPEN' && p.closingTime && now > new Date(p.closingTime).getTime()) {
        const doc = await Pool.findById(p._id);
        if (doc) await checkAndExpirePool(doc);
        p.status = 'EXPIRED';
      }
    }

    res.status(200).json({
      success: true,
      pools: pools.map(enrichPool),
      pagination: { total: totalCount, page: q.page, limit: q.limit, totalPages: Math.ceil(totalCount / q.limit) },
      serverTime: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

/** Recommended open pools for the current user, with explicit reasons (no fabricated scores). */
export async function getRecommendedPools(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const user = req.user!;
    const now = new Date();
    const candidates = await Pool.find({
      status: 'OPEN',
      closingTime: { $gt: now },
      participants: { $ne: new mongoose.Types.ObjectId(user._id) },
    })
      .populate('creator', PUBLIC_USER_FIELDS)
      .populate('participants', PUBLIC_USER_FIELDS)
      .sort({ closingTime: 1 })
      .limit(40)
      .lean();

    const scored = (candidates as any[])
      .map((p) => {
        const reasons: string[] = [];
        let score = 0;
        const remaining = Math.max(0, p.targetAmount - (p.currentSubtotal || 0));
        const minutesLeft = Math.round((new Date(p.closingTime).getTime() - now.getTime()) / 60000);
        const count = p.participants?.length || 0;

        if (p.hostel === user.hostel) {
          score += 40;
          reasons.push(`Delivers to your hostel (${p.hostel})`);
        }
        if (remaining > 0 && remaining <= 150) {
          score += 25;
          reasons.push(`Only ₹${remaining} away from its minimum`);
        } else if (remaining === 0) {
          score += 10;
          reasons.push('Minimum already reached — low risk');
        }
        if (minutesLeft <= 20) {
          score += 15;
          reasons.push(`Closes in ${minutesLeft} min`);
        }
        if (count >= 2 && count < p.participantLimit) {
          score += 10;
          reasons.push(`${count} students already in`);
        }
        return { pool: enrichPool(p), score, reasons };
      })
      .filter((r) => r.reasons.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6);

    res.status(200).json({ success: true, recommendations: scored });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Create                                   */
/* -------------------------------------------------------------------------- */

export async function createPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createPoolSchema.parse(req.body);
    const userId = req.user!._id;

    if (!req.user!.hostelSelected) {
      res.status(403).json({ success: false, error: 'Select your hostel before creating a pool.', code: 'HOSTEL_NOT_SELECTED' });
      return;
    }

    const durationMinutes = resolveDurationMinutes(data);
    const createdAt = new Date(); // server-confirmed creation time
    const closingTime = new Date(createdAt.getTime() + durationMinutes * 60 * 1000);

    const pool = await Pool.create({
      title: data.title,
      retailer: data.retailer,
      retailerCustomName: data.retailer === 'Other' ? data.retailerCustomName : undefined,
      hostel: data.hostel,
      deliveryZone: data.deliveryZone,
      targetAmount: data.targetAmount,
      contributionCap: data.contributionCap,
      participantLimit: data.participantLimit,
      closingTime,
      notes: data.notes,
      deliveryFee: data.expectedDeliveryFee ?? 0,
      paymentInstructions: data.feeNotes,
      creator: userId,
      status: 'OPEN',
      currentSubtotal: 0,
      participants: [userId],
    });

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'POOL_CREATED',
      details: {
        title: pool.title,
        retailer: pool.retailer,
        hostel: pool.hostel,
        deliveryZone: pool.deliveryZone,
        targetAmount: pool.targetAmount,
        durationMinutes,
        closingTime,
      },
      ipAddress: req.ip,
    });

    const populated = await Pool.findById(pool._id)
      .populate('creator', PUBLIC_USER_FIELDS)
      .populate('participants', PUBLIC_USER_FIELDS)
      .lean();

    broadcastPoolUpdate('discovery', SOCKET_EVENTS.POOL_UPDATED, { poolId: pool._id.toString(), type: 'POOL_CREATED' });

    res.status(201).json({ success: true, message: 'Order pool created.', pool: enrichPool(populated) });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Detail                                   */
/* -------------------------------------------------------------------------- */

export async function getPoolById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pool ID format' });
      return;
    }
    const viewerId = req.user!._id;

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Order pool not found' });
      return;
    }

    await checkAndExpirePool(pool);

    const items = await PoolItem.find({ poolId: pool._id }).populate('userId', PUBLIC_USER_FIELDS).sort({ createdAt: -1 });

    const calculatedSubtotal = Math.round(items.reduce((sum, item) => sum + item.itemSubtotal, 0) * 100) / 100;
    if (pool.currentSubtotal !== calculatedSubtotal) {
      pool.currentSubtotal = calculatedSubtotal;
      await pool.save();
    }

    const isHost = poolCreatorIsUser(pool, viewerId);
    const member = isParticipant(pool, viewerId);

    let paymentRecords: any[] = [];
    let costBreakdown: any = null;
    if (pool.status !== 'OPEN' && pool.status !== 'CANCELLED' && pool.status !== 'EXPIRED') {
      const records = await PaymentRecord.find({ poolId: pool._id }).populate('userId', PUBLIC_USER_FIELDS).sort({ totalDue: -1 });
      // Members see everyone's amount + status; only the payer and the host see references/ids.
      paymentRecords = member ? records.map((r) => sanitizeRecordForViewer(r, viewerId, pool.creator.toString())) : [];
      costBreakdown = await getBreakdownForPool(pool);
    }

    const auditEvents = await AuditEvent.find({ poolId: pool._id }).populate('userId', 'fullName email').sort({ createdAt: -1 }).limit(30);

    // Host contact details are only shown to participants, and the phone only if the host allows it.
    const populated = await Pool.findById(pool._id)
      .populate('creator', `${PUBLIC_USER_FIELDS} roomNumber preferences.showPhoneToPoolMembers ${member ? 'phoneNumber' : ''}`)
      .populate('participants', PUBLIC_USER_FIELDS)
      .lean();

    const creator: any = (populated as any).creator;
    if (creator && typeof creator === 'object') {
      if (!(member && creator.preferences?.showPhoneToPoolMembers)) delete creator.phoneNumber;
      delete creator.preferences;
    }

    const outstanding = paymentRecords
      .filter((r) => r.paymentStatus !== 'PAID' && (r.userId?._id || r.userId)?.toString() !== pool.creator.toString())
      .reduce((s, r) => s + (r.totalDue || 0), 0);

    res.status(200).json({
      success: true,
      pool: enrichPool(populated),
      items,
      paymentRecords,
      costBreakdown,
      auditEvents,
      viewer: { isHost, isParticipant: member },
      outstandingBalance: Math.round(outstanding * 100) / 100,
      countdown: {
        serverTime: new Date().toISOString(),
        closingTime: pool.closingTime,
        secondsRemaining: Math.max(0, Math.round((pool.closingTime.getTime() - Date.now()) / 1000)),
      },
    });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                 Membership                                 */
/* -------------------------------------------------------------------------- */

export async function joinPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    joinPoolSchema.parse(req.body);
    const { id } = req.params;
    const userId = req.user!._id;

    if (!req.user!.hostelSelected) {
      res.status(403).json({ success: false, error: 'Select your hostel before joining a pool.', code: 'HOSTEL_NOT_SELECTED' });
      return;
    }

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    await checkAndExpirePool(pool);

    if (pool.status !== 'OPEN') {
      res.status(400).json({ success: false, error: `Cannot join pool because it is currently ${pool.status.toLowerCase()}.` });
      return;
    }

    // Atomic conditional update: prevents duplicate joins and over-capacity under concurrency.
    const updated = await Pool.findOneAndUpdate(
      {
        _id: pool._id,
        status: 'OPEN',
        participants: { $ne: new mongoose.Types.ObjectId(userId) },
        $expr: { $lt: [{ $size: '$participants' }, '$participantLimit'] },
      },
      { $addToSet: { participants: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    );

    if (!updated) {
      const already = isParticipant(pool, userId);
      res.status(400).json({
        success: false,
        error: already ? 'You have already joined this pool.' : `Pool has reached its limit of ${pool.participantLimit} participants.`,
      });
      return;
    }

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PARTICIPANT_JOINED',
      details: { participantCount: updated.participants.length, deliveryConfirmed: true },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.PARTICIPANT_JOINED, {
      poolId: pool._id.toString(),
      type: 'PARTICIPANT_JOINED',
      participant: { _id: userId, fullName: req.user!.fullName, hostel: req.user!.hostel },
      participantCount: updated.participants.length,
    });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_UPDATED, { poolId: pool._id.toString(), type: 'PARTICIPANT_JOINED', participantCount: updated.participants.length });

    await notifyUsers([pool.creator], {
      type: 'PARTICIPANT_JOINED',
      title: `${req.user!.fullName} joined your pool`,
      message: `"${pool.title}" now has ${updated.participants.length}/${pool.participantLimit} participants.`,
      poolId: pool._id,
    });

    if (updated.participants.length >= pool.participantLimit - 1) {
      await notifyUsers(updated.participants, {
        type: 'POOL_NEARLY_FULL',
        title: 'Pool is nearly full',
        message: `"${pool.title}" has ${updated.participants.length}/${pool.participantLimit} participants.`,
        poolId: pool._id,
      }, { excludeUserId: userId });
    }

    const populated = await Pool.findById(pool._id).populate('creator', PUBLIC_USER_FIELDS).populate('participants', PUBLIC_USER_FIELDS).lean();
    res.status(200).json({ success: true, message: 'Joined the pool. You can now add your items.', pool: enrichPool(populated) });
  } catch (err) {
    next(err);
  }
}

export async function leavePool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (pool.status !== 'OPEN') {
      res.status(400).json({ success: false, error: 'Cannot leave pool once it has been locked or closed.' });
      return;
    }
    if (poolCreatorIsUser(pool, userId)) {
      res.status(400).json({ success: false, error: 'The host cannot leave the pool. Cancel it instead.' });
      return;
    }
    if (!isParticipant(pool, userId)) {
      res.status(400).json({ success: false, error: 'You are not a participant of this pool.' });
      return;
    }

    const deleted = await PoolItem.deleteMany({ poolId: pool._id, userId });
    const updatedPool = await Pool.findOneAndUpdate(
      { _id: pool._id, status: 'OPEN' },
      { $pull: { participants: new mongoose.Types.ObjectId(userId) } },
      { new: true }
    );
    if (!updatedPool) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }
    pool.participants = updatedPool.participants;
    await recalcSubtotal(pool);
    await Pool.updateOne({ _id: pool._id }, { $set: { currentSubtotal: pool.currentSubtotal } });

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PARTICIPANT_LEFT',
      details: { itemsRemovedCount: deleted.deletedCount, newSubtotal: pool.currentSubtotal },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.PARTICIPANT_LEFT, {
      poolId: pool._id.toString(),
      type: 'PARTICIPANT_LEFT',
      userId,
      currentSubtotal: pool.currentSubtotal,
      participantCount: pool.participants.length,
    });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_UPDATED, {
      poolId: pool._id.toString(),
      type: 'PARTICIPANT_LEFT',
      currentSubtotal: pool.currentSubtotal,
      participantCount: pool.participants.length,
    });

    res.status(200).json({ success: true, message: 'You have left the pool and your items were removed.', pool: enrichPool(pool.toObject()) });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                               State transitions                            */
/* -------------------------------------------------------------------------- */

export async function lockPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = lockPoolSchema.parse(req.body || {});
    const { id } = req.params;
    const userId = req.user!._id;

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can lock the pool.' });
      return;
    }
    await checkAndExpirePool(pool);
    if (pool.status !== 'OPEN') {
      res.status(400).json({ success: false, error: `Pool cannot be locked because it is already ${pool.status.toLowerCase()}.` });
      return;
    }

    const items = await PoolItem.find({ poolId: pool._id });
    if (items.length === 0) {
      res.status(400).json({ success: false, error: 'Cannot lock an empty pool. Add at least one item first.' });
      return;
    }

    await recalcSubtotal(pool);
    const belowTarget = pool.currentSubtotal < pool.targetAmount;
    if (belowTarget && !body.proceedBelowTargetConfirmed) {
      res.status(400).json({
        success: false,
        code: 'BELOW_TARGET',
        error: `Cart total ₹${pool.currentSubtotal} is below the ₹${pool.targetAmount} minimum. Extend the pool, cancel it, or confirm you have checked the retailer's actual requirement.`,
        remainingAmount: Math.max(0, pool.targetAmount - pool.currentSubtotal),
      });
      return;
    }

    // Conditional transition OPEN -> LOCKED (safe under concurrent requests)
    const locked = await Pool.findOneAndUpdate(
      { _id: pool._id, status: 'OPEN' },
      { $set: { status: 'LOCKED', lockedAt: new Date(), currentSubtotal: pool.currentSubtotal, proceedBelowTargetConfirmed: belowTarget } },
      { new: true }
    );
    if (!locked) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    await syncContributionsForPool(locked);

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'POOL_LOCKED',
      details: { lockedBy: req.user!.fullName, currentSubtotal: locked.currentSubtotal, itemCount: items.length, belowTarget },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_LOCKED, { poolId: pool._id.toString(), status: 'LOCKED' });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'LOCKED' });

    await notifyUsers(locked.participants, {
      type: 'ORDER_UPDATE',
      title: 'Cart locked',
      message: `"${pool.title}" is locked. ${req.user!.fullName} is placing the ${retailerLabel(pool)} order.`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({ success: true, message: 'Pool locked. Items can no longer be changed.', pool: enrichPool(locked.toObject()) });
  } catch (err) {
    next(err);
  }
}

/** LOCKED -> OPEN (only before any payment has been collected). */
export async function reopenPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can reopen the pool.' });
      return;
    }
    if (pool.status !== 'LOCKED') {
      res.status(400).json({ success: false, error: `Only LOCKED pools can be reopened. Current status: ${pool.status}.` });
      return;
    }
    const paidCount = await PaymentRecord.countDocuments({ poolId: pool._id, paymentStatus: { $in: ['PAID', 'PROCESSING'] } });
    if (paidCount > 0) {
      res.status(400).json({ success: false, error: 'Cannot reopen: payments are already in progress for this pool.' });
      return;
    }

    const extraMinutes = Math.min(env.POOL_MAX_DURATION_MINUTES, 15);
    const newClosing = new Date(Math.max(pool.closingTime.getTime(), Date.now() + extraMinutes * 60 * 1000));

    const reopened = await Pool.findOneAndUpdate(
      { _id: pool._id, status: 'LOCKED' },
      { $set: { status: 'OPEN', reopenedAt: new Date(), closingTime: newClosing, lockedAt: undefined } },
      { new: true }
    );
    if (!reopened) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    await AuditEvent.create({ poolId: pool._id, userId, action: 'POOL_REOPENED', details: { closingTime: newClosing }, ipAddress: req.ip });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'OPEN', closingTime: newClosing });
    await notifyUsers(reopened.participants, {
      type: 'ORDER_UPDATE',
      title: 'Cart reopened',
      message: `"${pool.title}" was reopened by the host. You can edit your items until ${newClosing.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({ success: true, message: 'Pool reopened.', pool: enrichPool(reopened.toObject()) });
  } catch (err) {
    next(err);
  }
}

/** Extend deadline (OPEN) or revive an EXPIRED pool (owner decision when target not reached). */
export async function extendPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { additionalMinutes } = extendPoolSchema.parse(req.body);
    const { id } = req.params;
    const userId = req.user!._id;
    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can extend the deadline.' });
      return;
    }
    if (pool.status !== 'OPEN' && pool.status !== 'EXPIRED') {
      res.status(400).json({ success: false, error: `Only OPEN or EXPIRED pools can be extended. Current status: ${pool.status}.` });
      return;
    }
    if (pool.extensionCount >= 3) {
      res.status(400).json({ success: false, error: 'A pool can be extended at most 3 times.' });
      return;
    }

    const base = Math.max(pool.closingTime.getTime(), Date.now());
    const newClosing = new Date(base + additionalMinutes * 60 * 1000);
    const totalMinutes = Math.round((newClosing.getTime() - pool.createdAt.getTime()) / 60000);
    if (totalMinutes > env.POOL_MAX_DURATION_MINUTES * 2) {
      res.status(400).json({ success: false, error: `Pools cannot stay open longer than ${env.POOL_MAX_DURATION_MINUTES * 2} minutes in total.` });
      return;
    }

    const updated = await Pool.findOneAndUpdate(
      { _id: pool._id, status: { $in: ['OPEN', 'EXPIRED'] } },
      { $set: { status: 'OPEN', closingTime: newClosing, expiredAt: undefined }, $inc: { extensionCount: 1 } },
      { new: true }
    );
    if (!updated) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    await AuditEvent.create({ poolId: pool._id, userId, action: 'POOL_EXTENDED', details: { additionalMinutes, closingTime: newClosing, previousStatus: pool.status }, ipAddress: req.ip });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'OPEN', closingTime: newClosing, extended: true });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_UPDATED, { poolId: pool._id.toString(), type: 'POOL_EXTENDED', closingTime: newClosing });
    await notifyUsers(updated.participants, {
      type: 'DEADLINE_APPROACHING',
      title: 'Deadline extended',
      message: `"${pool.title}" now closes at ${newClosing.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' })}.`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({ success: true, message: `Deadline extended by ${additionalMinutes} minutes.`, pool: enrichPool(updated.toObject()) });
  } catch (err) {
    next(err);
  }
}

export async function confirmOrderPlaced(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const data = orderPlacedSchema.parse(req.body);

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can confirm that the retailer order was placed.' });
      return;
    }
    if (pool.status !== 'LOCKED') {
      res.status(400).json({ success: false, error: `Pool must be LOCKED before confirming order placement. Current status: ${pool.status}.` });
      return;
    }
    if (data.finalPayableAmount < pool.currentSubtotal - 0.009) {
      res.status(400).json({ success: false, error: `Final billed total (₹${data.finalPayableAmount}) cannot be less than the items subtotal (₹${pool.currentSubtotal}).` });
      return;
    }

    const updated = await Pool.findOneAndUpdate(
      { _id: pool._id, status: 'LOCKED' },
      {
        $set: {
          status: 'ORDERED',
          finalPayableAmount: data.finalPayableAmount,
          actualRetailerMinimum: data.actualRetailerMinimum,
          deliveryFee: data.deliveryFee,
          otherCharges: data.otherCharges,
          paymentInstructions: data.paymentInstructions,
          upiId: data.upiId || undefined,
          qrCodeUrl: data.qrCodeUrl || undefined,
          orderPlacedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!updated) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    const breakdown = await syncContributionsForPool(updated);

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'ORDER_PLACED',
      details: {
        finalPayableAmount: updated.finalPayableAmount,
        actualRetailerMinimum: updated.actualRetailerMinimum,
        deliveryFee: updated.deliveryFee,
        otherCharges: updated.otherCharges,
        retailerOrderReference: data.retailerOrderReference,
        splits: breakdown.splits,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, {
      poolId: pool._id.toString(),
      status: 'ORDERED',
      finalPayableAmount: updated.finalPayableAmount,
      deliveryFee: updated.deliveryFee,
      otherCharges: updated.otherCharges,
    });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.ORDER_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'ORDERED' });

    await notifyUsers(updated.participants, {
      type: 'ORDER_UPDATE',
      title: 'Order placed — your share is ready',
      message: `${req.user!.fullName} placed the ${retailerLabel(pool)} order for "${pool.title}". Open the pool to see your exact amount and pay.`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({
      success: true,
      message: 'Retailer order confirmed. Participants can now see and pay their exact share.',
      pool: enrichPool(updated.toObject()),
      costBreakdown: breakdown,
    });
  } catch (err) {
    next(err);
  }
}

export async function markDelivered(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can mark the delivery as complete.' });
      return;
    }
    if (pool.status !== 'ORDERED') {
      res.status(400).json({ success: false, error: `Only ORDERED pools can be marked delivered. Current status: ${pool.status}.` });
      return;
    }

    const updated = await Pool.findOneAndUpdate(
      { _id: pool._id, status: 'ORDERED' },
      { $set: { status: 'DELIVERED', deliveredAt: new Date() } },
      { new: true }
    );
    if (!updated) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    await AuditEvent.create({ poolId: pool._id, userId, action: 'POOL_DELIVERED', details: { deliveredAt: updated.deliveredAt }, ipAddress: req.ip });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'DELIVERED' });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.ORDER_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'DELIVERED' });
    await notifyUsers(updated.participants, {
      type: 'ORDER_UPDATE',
      title: 'Order delivered 🎉',
      message: `"${pool.title}" has arrived at ${pool.deliveryZone}. Collect your items!`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({ success: true, message: 'Order marked as delivered.', pool: enrichPool(updated.toObject()) });
  } catch (err) {
    next(err);
  }
}

export async function cancelPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!poolCreatorIsUser(pool, userId)) {
      res.status(403).json({ success: false, error: 'Only the pool host can cancel this pool.' });
      return;
    }
    if (pool.status === 'DELIVERED' || pool.status === 'CANCELLED') {
      res.status(400).json({ success: false, error: `${pool.status === 'DELIVERED' ? 'Delivered' : 'Cancelled'} pools cannot be cancelled.` });
      return;
    }
    const paidCount = await PaymentRecord.countDocuments({ poolId: pool._id, paymentStatus: 'PAID' });
    if (paidCount > 0) {
      res.status(400).json({ success: false, error: 'Cannot cancel: some participants have already paid. Resolve refunds first.' });
      return;
    }

    const updated = await Pool.findOneAndUpdate(
      { _id: pool._id, status: { $in: ['OPEN', 'LOCKED', 'ORDERED', 'EXPIRED'] } },
      { $set: { status: 'CANCELLED', cancelledAt: new Date() } },
      { new: true }
    );
    if (!updated) {
      res.status(409).json({ success: false, error: 'Pool state changed, please refresh.' });
      return;
    }

    await AuditEvent.create({ poolId: pool._id, userId, action: 'POOL_CANCELLED', details: { cancelledAt: updated.cancelledAt, previousStatus: pool.status }, ipAddress: req.ip });
    broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, { poolId: pool._id.toString(), status: 'CANCELLED' });
    await notifyUsers(updated.participants, {
      type: 'ORDER_UPDATE',
      title: 'Pool cancelled',
      message: `"${pool.title}" was cancelled by the host.`,
      poolId: pool._id,
    }, { excludeUserId: userId });

    res.status(200).json({ success: true, message: 'Pool cancelled.', pool: enrichPool(updated.toObject()) });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                               Orders / history                             */
/* -------------------------------------------------------------------------- */

export async function getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = new mongoose.Types.ObjectId(req.user!._id);
    const tab = String(req.query.tab || 'all');

    const base: any = { participants: userId };
    const filters: Record<string, any> = {
      active: { ...base, status: { $in: ACTIVE_STATUSES } },
      created: { creator: userId },
      joined: { ...base, creator: { $ne: userId } },
      completed: { ...base, status: 'DELIVERED' },
      cancelled: { ...base, status: { $in: ['CANCELLED', 'EXPIRED'] } },
      all: base,
    };
    const query = filters[tab] || filters.all;

    const pools = await Pool.find(query)
      .populate('creator', PUBLIC_USER_FIELDS)
      .populate('participants', PUBLIC_USER_FIELDS)
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const poolIds = pools.map((p) => p._id);
    const myRecords = await PaymentRecord.find({ poolId: { $in: poolIds }, userId }).lean();
    const recordByPool = new Map(myRecords.map((r) => [r.poolId.toString(), r]));
    const myItems = await PoolItem.aggregate([
      { $match: { poolId: { $in: poolIds }, userId } },
      { $group: { _id: '$poolId', subtotal: { $sum: '$itemSubtotal' }, count: { $sum: 1 } } },
    ]);
    const itemsByPool = new Map(myItems.map((r: any) => [r._id.toString(), r]));

    const counts = await Promise.all(
      Object.entries(filters).map(async ([key, f]) => [key, await Pool.countDocuments(f)] as const)
    );

    res.status(200).json({
      success: true,
      tab,
      counts: Object.fromEntries(counts),
      orders: pools.map((p: any) => {
        const rec = recordByPool.get(p._id.toString());
        const mine = itemsByPool.get(p._id.toString());
        return {
          ...enrichPool(p),
          isHost: p.creator?._id?.toString() === userId.toString(),
          myItemSubtotal: mine?.subtotal || 0,
          myItemCount: mine?.count || 0,
          myContribution: rec
            ? { totalDue: rec.totalDue, allocatedFee: rec.allocatedFee, paymentStatus: rec.paymentStatus, paymentMethod: rec.paymentMethod }
            : null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
}

/** Legacy shape kept for compatibility. */
export async function getMyPoolHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!._id;
    const [createdPools, joinedPools] = await Promise.all([
      Pool.find({ creator: userId }).populate('creator', PUBLIC_USER_FIELDS).sort({ createdAt: -1 }).limit(50).lean(),
      Pool.find({ participants: userId, creator: { $ne: userId } }).populate('creator', PUBLIC_USER_FIELDS).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    res.status(200).json({ success: true, createdPools: createdPools.map(enrichPool), joinedPools: joinedPools.map(enrichPool) });
  } catch (err) {
    next(err);
  }
}

/** Build a NEW draft from a previous order (never touches the original). */
export async function getDuplicateDraft(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pool ID format' });
      return;
    }
    const pool = await Pool.findById(id).lean();
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (!pool.participants.some((p) => p.toString() === userId)) {
      res.status(403).json({ success: false, error: 'You can only duplicate pools you took part in.' });
      return;
    }
    const myItems = await PoolItem.find({ poolId: pool._id, userId }).lean();
    res.status(200).json({
      success: true,
      draft: {
        title: `${pool.title} (again)`,
        retailer: pool.retailer,
        retailerCustomName: pool.retailerCustomName,
        hostel: pool.hostel,
        deliveryZone: pool.deliveryZone,
        targetAmount: pool.targetAmount,
        contributionCap: pool.contributionCap,
        participantLimit: pool.participantLimit,
        durationMinutes: 30,
        notes: pool.notes,
      },
      items: myItems.map((it) => ({ name: it.name, quantity: it.quantity, unitPrice: it.unitPrice, note: it.note })),
      sourcePoolId: pool._id,
    });
  } catch (err) {
    next(err);
  }
}

/* -------------------------------------------------------------------------- */
/*                                   Reports                                  */
/* -------------------------------------------------------------------------- */

export async function reportPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = reportSchema.parse(req.body);
    const { id } = req.params;
    const userId = req.user!._id;
    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    if (data.reportedUserId && !mongoose.Types.ObjectId.isValid(data.reportedUserId)) {
      res.status(400).json({ success: false, error: 'Invalid reported user id.' });
      return;
    }
    const recent = await Report.countDocuments({ reporter: userId, createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) } });
    if (recent >= 5) {
      res.status(429).json({ success: false, error: 'Too many reports in the last hour.' });
      return;
    }
    const report = await Report.create({
      reporter: userId,
      poolId: pool._id,
      reportedUser: data.reportedUserId,
      reason: data.reason,
      details: data.details,
    });
    await AuditEvent.create({ poolId: pool._id, userId, action: 'REPORT_FILED', details: { reportId: report._id, reason: data.reason }, ipAddress: req.ip });
    res.status(201).json({ success: true, message: 'Report submitted. A moderator will review it.', reportId: report._id });
  } catch (err) {
    next(err);
  }
}
