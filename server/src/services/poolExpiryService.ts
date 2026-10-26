import { Pool, IPool } from '../models/Pool.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { getSocketIO } from './socketService.js';

/**
 * Checks if an open pool has passed its closing time.
 * If so, updates status to EXPIRED, records an audit event, and broadcasts.
 */
export async function checkAndExpirePool(pool: IPool): Promise<boolean> {
  if (pool.status === 'OPEN' && pool.closingTime && new Date() > new Date(pool.closingTime)) {
    pool.status = 'EXPIRED';
    await pool.save();

    await AuditEvent.create({
      poolId: pool._id,
      action: 'POOL_EXPIRED',
      details: {
        closingTime: pool.closingTime,
        expiredAt: new Date(),
        reason: 'Closing deadline reached',
      },
    });

    const io = getSocketIO();
    if (io) {
      io.to(`pool:${pool._id.toString()}`).emit('pool:status_changed', {
        poolId: pool._id.toString(),
        status: 'EXPIRED',
        reason: 'Closing deadline reached',
      });
    }

    return true;
  }
  return false;
}

/**
 * Background interval to automatically expire overdue open pools.
 */
let expiryInterval: NodeJS.Timeout | null = null;

export function startPoolExpiryScheduler(): void {
  if (expiryInterval) return;

  expiryInterval = setInterval(async () => {
    try {
      const now = new Date();
      const overduePools = await Pool.find({
        status: 'OPEN',
        closingTime: { $lt: now },
      });

      for (const pool of overduePools) {
        await checkAndExpirePool(pool);
      }
    } catch (err) {
      console.error('Error in pool expiry scheduler:', err);
    }
  }, 30000); // Check every 30 seconds
}

export function stopPoolExpiryScheduler(): void {
  if (expiryInterval) {
    clearInterval(expiryInterval);
    expiryInterval = null;
  }
}
