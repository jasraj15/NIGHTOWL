import { Pool, IPool } from '../models/Pool.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { broadcastPoolUpdate, SOCKET_EVENTS } from './socketService.js';
import { notifyUsers } from './notificationService.js';

/**
 * Expire an OPEN pool whose deadline has passed. Uses a conditional update so
 * concurrent callers (request path + scheduler) cannot both "win".
 */
export async function checkAndExpirePool(pool: IPool): Promise<boolean> {
  if (pool.status !== 'OPEN' || !pool.closingTime || new Date() <= new Date(pool.closingTime)) {
    return false;
  }

  const updated = await Pool.findOneAndUpdate(
    { _id: pool._id, status: 'OPEN', closingTime: { $lt: new Date() } },
    { $set: { status: 'EXPIRED', expiredAt: new Date() } },
    { new: true }
  );
  if (!updated) {
    // Someone else already transitioned it; reflect the latest state on the passed document.
    const latest = await Pool.findById(pool._id).select('status').lean();
    if (latest) pool.status = latest.status;
    return false;
  }

  pool.status = 'EXPIRED';
  pool.expiredAt = updated.expiredAt;

  await AuditEvent.create({
    poolId: pool._id,
    action: 'POOL_EXPIRED',
    details: { closingTime: pool.closingTime, expiredAt: updated.expiredAt, reason: 'Closing deadline reached' },
  });

  broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_EXPIRED, { poolId: pool._id.toString(), status: 'EXPIRED' });
  broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.POOL_STATUS_CHANGED, {
    poolId: pool._id.toString(),
    status: 'EXPIRED',
    reason: 'Closing deadline reached',
  });

  const belowTarget = pool.currentSubtotal < pool.targetAmount;
  await notifyUsers([pool.creator], {
    type: 'ORDER_UPDATE',
    title: 'Your pool expired',
    message: belowTarget
      ? `"${pool.title}" closed at ₹${pool.currentSubtotal} of ₹${pool.targetAmount}. You can extend it, cancel it, or proceed after checking the retailer's real minimum.`
      : `"${pool.title}" reached its deadline. Extend it to keep collecting or cancel it.`,
    poolId: pool._id,
  });
  await notifyUsers(updated.participants, {
    type: 'ORDER_UPDATE',
    title: 'Pool expired',
    message: `"${pool.title}" closed before the host locked it. Watch for an extension from the host.`,
    poolId: pool._id,
  }, { excludeUserId: pool.creator });

  return true;
}

/** Warn participants once when a pool is about to close (within 5 minutes). */
const warnedPools = new Set<string>();

async function warnClosingSoon(): Promise<void> {
  const now = Date.now();
  const soon = await Pool.find({
    status: 'OPEN',
    closingTime: { $gt: new Date(now), $lte: new Date(now + 5 * 60 * 1000) },
  })
    .select('_id title participants closingTime')
    .lean();

  for (const p of soon) {
    const key = `${p._id.toString()}:${new Date(p.closingTime).getTime()}`;
    if (warnedPools.has(key)) continue;
    warnedPools.add(key);
    await notifyUsers(p.participants, {
      type: 'DEADLINE_APPROACHING',
      title: 'Closing in 5 minutes',
      message: `"${p.title}" closes soon — add your items now.`,
      poolId: p._id,
    });
  }
  if (warnedPools.size > 5000) warnedPools.clear();
}

let expiryInterval: NodeJS.Timeout | null = null;

export function startPoolExpiryScheduler(intervalMs = 30000): void {
  if (expiryInterval) return;
  expiryInterval = setInterval(async () => {
    try {
      const overduePools = await Pool.find({ status: 'OPEN', closingTime: { $lt: new Date() } });
      for (const pool of overduePools) await checkAndExpirePool(pool);
      await warnClosingSoon();
    } catch (err) {
      console.error('Error in pool expiry scheduler:', err);
    }
  }, intervalMs);
}

export function stopPoolExpiryScheduler(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
}
