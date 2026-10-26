import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { Pool, IPool } from '../models/Pool.js';
import { PoolItem } from '../models/PoolItem.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { User } from '../models/User.js';
import { createPoolSchema, orderPlacedSchema } from '../validators/poolSchemas.js';
import { checkAndExpirePool } from '../services/poolExpiryService.js';
import { calculateProportionalCostSplit } from '../services/costSplitService.js';
import { broadcastPoolUpdate } from '../services/socketService.js';

export async function getPools(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { hostel, retailer, status, search, page = '1', limit = '20' } = req.query;

    const query: any = {};

    if (hostel && (hostel === 'Uniworld 1' || hostel === 'Uniworld 2')) {
      query.hostel = hostel;
    }

    if (retailer) {
      query.retailer = retailer;
    }

    if (status) {
      query.status = status;
    }

    if (search && typeof search === 'string' && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { title: searchRegex },
        { deliveryZone: searchRegex },
        { retailerCustomName: searchRegex },
      ];
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit as string, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [pools, totalCount] = await Promise.all([
      Pool.find(query)
        .populate('creator', 'fullName email hostel roomNumber')
        .populate('participants', 'fullName email hostel')
        .sort({ status: 1, closingTime: 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Pool.countDocuments(query),
    ]);

    // Check expiry for open pools and enrich progress
    const enriched = await Promise.all(
      pools.map(async (p: any) => {
        // Safe runtime check for expiry
        if (p.status === 'OPEN' && p.closingTime && new Date() > new Date(p.closingTime)) {
          await Pool.updateOne({ _id: p._id }, { status: 'EXPIRED' });
          p.status = 'EXPIRED';
        }

        const remainingAmount = Math.max(0, p.targetAmount - (p.currentSubtotal || 0));
        const progressPercent = Math.min(
          100,
          Math.round(((p.currentSubtotal || 0) / p.targetAmount) * 100)
        );

        return {
          ...p,
          remainingAmount,
          progressPercent,
          participantCount: p.participants?.length || 0,
        };
      })
    );

    res.status(200).json({
      success: true,
      pools: enriched,
      pagination: {
        total: totalCount,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    });
  } catch (err) {
    next(err);
  }
}

export async function createPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = createPoolSchema.parse(req.body);
    const userId = req.user!._id;

    const pool = await Pool.create({
      title: data.title,
      retailer: data.retailer,
      retailerCustomName: data.retailerCustomName,
      hostel: data.hostel,
      deliveryZone: data.deliveryZone,
      targetAmount: data.targetAmount,
      contributionCap: data.contributionCap,
      participantLimit: data.participantLimit,
      closingTime: new Date(data.closingTime),
      notes: data.notes,
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
      },
      ipAddress: req.ip,
    });

    const populated = await Pool.findById(pool._id)
      .populate('creator', 'fullName email hostel roomNumber')
      .populate('participants', 'fullName email hostel');

    res.status(201).json({
      success: true,
      message: 'Order pool created successfully.',
      pool: populated,
    });
  } catch (err) {
    next(err);
  }
}

export async function getPoolById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ success: false, error: 'Invalid pool ID format' });
      return;
    }

    const pool = await Pool.findById(id)
      .populate('creator', 'fullName email hostel phoneNumber roomNumber')
      .populate('participants', 'fullName email hostel');

    if (!pool) {
      res.status(404).json({ success: false, error: 'Order pool not found' });
      return;
    }

    // Check expiry
    await checkAndExpirePool(pool);

    // Fetch items with user info
    const items = await PoolItem.find({ poolId: pool._id })
      .populate('userId', 'fullName email hostel')
      .sort({ createdAt: -1 });

    // Recalculate and synchronize exact subtotal
    const calculatedSubtotal = Math.round(
      items.reduce((sum, item) => sum + item.itemSubtotal, 0) * 100
    ) / 100;

    if (pool.currentSubtotal !== calculatedSubtotal) {
      pool.currentSubtotal = calculatedSubtotal;
      await pool.save();
    }

    // Fetch payment records if pool has entered locked, ordered, or delivered states
    let paymentRecords: any[] = [];
    let costBreakdown: any = null;

    if (pool.status !== 'OPEN' && pool.status !== 'CANCELLED') {
      paymentRecords = await PaymentRecord.find({ poolId: pool._id })
        .populate('userId', 'fullName email hostel phoneNumber')
        .sort({ totalDue: -1 });

      // Group totals per participant for split audit
      const participantTotals = pool.participants.map((p: any) => {
        const pIdStr = p._id.toString();
        const pSubtotal = items
          .filter((it) => it.userId && (it.userId as any)._id?.toString() === pIdStr)
          .reduce((sum, it) => sum + it.itemSubtotal, 0);
        return {
          userId: pIdStr,
          itemSubtotal: Math.round(pSubtotal * 100) / 100,
        };
      }).filter((pt) => pt.itemSubtotal > 0);

      costBreakdown = calculateProportionalCostSplit(
        participantTotals,
        pool.deliveryFee || 0,
        pool.otherCharges || 0,
        pool.finalPayableAmount
      );
    }

    // Fetch recent audit events
    const auditEvents = await AuditEvent.find({ poolId: pool._id })
      .populate('userId', 'fullName email')
      .sort({ createdAt: -1 })
      .limit(20);

    const remainingAmount = Math.max(0, pool.targetAmount - pool.currentSubtotal);
    const progressPercent = Math.min(
      100,
      Math.round((pool.currentSubtotal / pool.targetAmount) * 100)
    );

    res.status(200).json({
      success: true,
      pool: {
        ...pool.toObject(),
        remainingAmount,
        progressPercent,
      },
      items,
      paymentRecords,
      costBreakdown,
      auditEvents,
    });
  } catch (err) {
    next(err);
  }
}

export async function joinPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    await checkAndExpirePool(pool);

    if (pool.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Cannot join pool because it is currently ${pool.status.toLowerCase()}.`,
      });
      return;
    }

    const alreadyJoined = pool.participants.some(
      (p) => p.toString() === userId.toString()
    );

    if (alreadyJoined) {
      res.status(400).json({
        success: false,
        error: 'You have already joined this pool.',
      });
      return;
    }

    if (pool.participants.length >= pool.participantLimit) {
      res.status(400).json({
        success: false,
        error: `Pool has reached its limit of ${pool.participantLimit} participants.`,
      });
      return;
    }

    pool.participants.push(new mongoose.Types.ObjectId(userId));
    await pool.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PARTICIPANT_JOINED',
      details: {
        participantCount: pool.participants.length,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:updated', {
      poolId: pool._id.toString(),
      type: 'PARTICIPANT_JOINED',
      participantCount: pool.participants.length,
    });

    res.status(200).json({
      success: true,
      message: 'Successfully joined pool! You can now add your items.',
      pool,
    });
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
      res.status(400).json({
        success: false,
        error: 'Cannot leave pool once it has been locked or closed.',
      });
      return;
    }

    if (pool.creator.toString() === userId.toString()) {
      res.status(400).json({
        success: false,
        error: 'The creator cannot leave the pool. You can cancel the pool instead.',
      });
      return;
    }

    // Delete any items this user added
    const deletedItems = await PoolItem.find({ poolId: pool._id, userId });
    if (deletedItems.length > 0) {
      await PoolItem.deleteMany({ poolId: pool._id, userId });
    }

    // Remove user from participants
    pool.participants = pool.participants.filter(
      (p) => p.toString() !== userId.toString()
    );

    // Recalculate pool subtotal
    const remainingItems = await PoolItem.find({ poolId: pool._id });
    pool.currentSubtotal = Math.round(
      remainingItems.reduce((sum, item) => sum + item.itemSubtotal, 0) * 100
    ) / 100;

    await pool.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PARTICIPANT_LEFT',
      details: {
        itemsRemovedCount: deletedItems.length,
        newSubtotal: pool.currentSubtotal,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:updated', {
      poolId: pool._id.toString(),
      type: 'PARTICIPANT_LEFT',
      currentSubtotal: pool.currentSubtotal,
      participantCount: pool.participants.length,
    });

    res.status(200).json({
      success: true,
      message: 'You have left the pool and your items have been removed.',
      pool,
    });
  } catch (err) {
    next(err);
  }
}

export async function lockPool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const userId = req.user!._id;

    const pool = await Pool.findById(id);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    if (pool.creator.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the pool owner can lock the pool.',
      });
      return;
    }

    if (pool.status !== 'OPEN') {
      res.status(400).json({
        success: false,
        error: `Pool cannot be locked because it is already ${pool.status.toLowerCase()}.`,
      });
      return;
    }

    const items = await PoolItem.find({ poolId: pool._id });
    if (items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'Cannot lock an empty pool. Please add at least one item first.',
      });
      return;
    }

    pool.status = 'LOCKED';
    await pool.save();

    // Initialize or update payment records for each participant
    const participantTotalsMap = new Map<string, number>();
    for (const it of items) {
      const uStr = it.userId.toString();
      participantTotalsMap.set(uStr, (participantTotalsMap.get(uStr) || 0) + it.itemSubtotal);
    }

    for (const [pUserId, subtotal] of participantTotalsMap.entries()) {
      await PaymentRecord.findOneAndUpdate(
        { poolId: pool._id, userId: pUserId },
        {
          itemSubtotal: subtotal,
          allocatedFee: 0,
          totalDue: subtotal,
          paymentStatus: 'PENDING',
        },
        { upsert: true, new: true }
      );
    }

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'POOL_LOCKED',
      details: {
        lockedBy: req.user!.fullName,
        currentSubtotal: pool.currentSubtotal,
        itemCount: items.length,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:status_changed', {
      poolId: pool._id.toString(),
      status: 'LOCKED',
    });

    res.status(200).json({
      success: true,
      message: 'Pool has been locked. No further item additions or edits are allowed.',
      pool,
    });
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

    if (pool.creator.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the pool owner can confirm that the retailer order was placed.',
      });
      return;
    }

    if (pool.status !== 'LOCKED') {
      res.status(400).json({
        success: false,
        error: `Pool must be LOCKED before confirming order placement. Current status: ${pool.status}.`,
      });
      return;
    }

    pool.status = 'ORDERED';
    pool.finalPayableAmount = data.finalPayableAmount;
    pool.actualRetailerMinimum = data.actualRetailerMinimum;
    pool.deliveryFee = data.deliveryFee;
    pool.otherCharges = data.otherCharges;
    pool.paymentInstructions = data.paymentInstructions;
    pool.upiId = data.upiId;
    pool.qrCodeUrl = data.qrCodeUrl;
    pool.orderPlacedAt = new Date();

    await pool.save();

    // Recompute exact proportional split across all participants with items
    const items = await PoolItem.find({ poolId: pool._id });
    const participantTotalsMap = new Map<string, number>();

    for (const it of items) {
      const uStr = it.userId.toString();
      participantTotalsMap.set(uStr, (participantTotalsMap.get(uStr) || 0) + it.itemSubtotal);
    }

    const participantList = Array.from(participantTotalsMap.entries()).map(([pUserId, subtotal]) => ({
      userId: pUserId,
      itemSubtotal: Math.round(subtotal * 100) / 100,
    }));

    const splitBreakdown = calculateProportionalCostSplit(
      participantList,
      pool.deliveryFee || 0,
      pool.otherCharges || 0,
      pool.finalPayableAmount
    );

    // Update payment records with exact proportional numbers
    for (const split of splitBreakdown.splits) {
      await PaymentRecord.findOneAndUpdate(
        { poolId: pool._id, userId: split.userId },
        {
          itemSubtotal: split.itemSubtotal,
          allocatedFee: split.allocatedFee,
          totalDue: split.totalDue,
          paymentStatus: 'PENDING',
        },
        { upsert: true, new: true }
      );
    }

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'ORDER_PLACED',
      details: {
        finalPayableAmount: pool.finalPayableAmount,
        deliveryFee: pool.deliveryFee,
        otherCharges: pool.otherCharges,
        splits: splitBreakdown.splits,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:status_changed', {
      poolId: pool._id.toString(),
      status: 'ORDERED',
      finalPayableAmount: pool.finalPayableAmount,
      deliveryFee: pool.deliveryFee,
      otherCharges: pool.otherCharges,
      upiId: pool.upiId,
    });

    broadcastPoolUpdate(pool._id.toString(), 'payment:updated', {
      poolId: pool._id.toString(),
      splits: splitBreakdown.splits,
    });

    res.status(200).json({
      success: true,
      message: 'Retailer order confirmed! Participants can now view their exact amount due and submit payment.',
      pool,
      costBreakdown: splitBreakdown,
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

    if (pool.creator.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the pool owner can mark the delivery as complete.',
      });
      return;
    }

    if (pool.status !== 'ORDERED') {
      res.status(400).json({
        success: false,
        error: `Only orders in ORDERED status can be marked as delivered. Current status: ${pool.status}.`,
      });
      return;
    }

    pool.status = 'DELIVERED';
    pool.deliveredAt = new Date();
    await pool.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'POOL_DELIVERED',
      details: {
        deliveredAt: pool.deliveredAt,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:status_changed', {
      poolId: pool._id.toString(),
      status: 'DELIVERED',
    });

    res.status(200).json({
      success: true,
      message: 'Order marked as DELIVERED! Group order completed.',
      pool,
    });
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

    if (pool.creator.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the pool owner can cancel this order pool.',
      });
      return;
    }

    if (pool.status === 'DELIVERED') {
      res.status(400).json({
        success: false,
        error: 'Delivered orders cannot be cancelled.',
      });
      return;
    }

    pool.status = 'CANCELLED';
    pool.cancelledAt = new Date();
    await pool.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'POOL_CANCELLED',
      details: {
        cancelledAt: pool.cancelledAt,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'pool:status_changed', {
      poolId: pool._id.toString(),
      status: 'CANCELLED',
    });

    res.status(200).json({
      success: true,
      message: 'Order pool has been cancelled.',
      pool,
    });
  } catch (err) {
    next(err);
  }
}

export async function getMyPoolHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!._id;

    const [createdPools, joinedPools] = await Promise.all([
      Pool.find({ creator: userId })
        .populate('creator', 'fullName email hostel')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
      Pool.find({ participants: userId, creator: { $ne: userId } })
        .populate('creator', 'fullName email hostel')
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      createdPools,
      joinedPools,
    });
  } catch (err) {
    next(err);
  }
}
