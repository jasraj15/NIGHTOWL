import { Types } from 'mongoose';
import { Pool, IPool } from '../models/Pool.js';
import { PoolItem } from '../models/PoolItem.js';
import { PaymentRecord, IPaymentRecord } from '../models/PaymentRecord.js';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { calculateProportionalCostSplit, CostSplitBreakdown } from './costSplitService.js';
import { broadcastPoolUpdate, emitToUser, SOCKET_EVENTS } from './socketService.js';
import { notifyUsers } from './notificationService.js';
import { RazorpayPayment } from './razorpayClient.js';

/**
 * Recompute every participant's contribution for a pool from the database
 * (items are the source of truth) and upsert PaymentRecords.
 *
 * Records that are already PAID keep their amounts untouched so a host cannot
 * retroactively change what someone has already paid.
 */
export async function syncContributionsForPool(pool: IPool): Promise<CostSplitBreakdown> {
  const items = await PoolItem.find({ poolId: pool._id }).lean();
  const totalsMap = new Map<string, number>();
  for (const it of items) {
    const key = it.userId.toString();
    totalsMap.set(key, (totalsMap.get(key) || 0) + it.itemSubtotal);
  }

  const participantTotals = Array.from(totalsMap.entries()).map(([userId, subtotal]) => ({
    userId,
    itemSubtotal: Math.round(subtotal * 100) / 100,
  }));

  const breakdown = calculateProportionalCostSplit(
    participantTotals,
    pool.deliveryFee || 0,
    pool.otherCharges || 0,
    pool.finalPayableAmount
  );

  for (const split of breakdown.splits) {
    const existing = await PaymentRecord.findOne({ poolId: pool._id, userId: split.userId });
    if (existing && (existing.paymentStatus === 'PAID' || existing.paymentStatus === 'REFUND_PENDING' || existing.paymentStatus === 'REFUNDED')) {
      continue;
    }
    await PaymentRecord.findOneAndUpdate(
      { poolId: pool._id, userId: split.userId },
      {
        $set: {
          itemSubtotal: split.itemSubtotal,
          allocatedFee: split.allocatedFee,
          totalDue: split.totalDue,
          amountPaise: Math.round(split.totalDue * 100),
        },
        $setOnInsert: { paymentStatus: 'PENDING' },
      },
      { upsert: true, new: true, runValidators: true }
    );
  }

  return breakdown;
}

export async function getBreakdownForPool(pool: IPool): Promise<CostSplitBreakdown> {
  const items = await PoolItem.find({ poolId: pool._id }).lean();
  const totalsMap = new Map<string, number>();
  for (const it of items) {
    const key = it.userId.toString();
    totalsMap.set(key, (totalsMap.get(key) || 0) + it.itemSubtotal);
  }
  const participantTotals = Array.from(totalsMap.entries()).map(([userId, subtotal]) => ({
    userId,
    itemSubtotal: Math.round(subtotal * 100) / 100,
  }));
  return calculateProportionalCostSplit(
    participantTotals,
    pool.deliveryFee || 0,
    pool.otherCharges || 0,
    pool.finalPayableAmount
  );
}

export function sanitizeRecordForViewer(record: any, viewerId: string, poolCreatorId: string) {
  const r = typeof record.toObject === 'function' ? record.toObject() : { ...record };
  const ownerId = (r.userId?._id || r.userId)?.toString();
  const isSelf = ownerId === viewerId;
  const isHost = viewerId === poolCreatorId;
  if (!isSelf && !isHost) {
    delete r.paymentReference;
    delete r.razorpayOrderId;
    delete r.razorpayPaymentId;
    delete r.razorpayRefundId;
    delete r.reviewNote;
    delete r.failureReason;
  }
  if (r.userId && typeof r.userId === 'object') {
    delete r.userId.phoneNumber;
  }
  return r;
}

interface ApplyPaidInput {
  record: IPaymentRecord;
  pool: IPool;
  payment: Pick<RazorpayPayment, 'id' | 'order_id' | 'amount' | 'status' | 'method'>;
  source: 'WEBHOOK' | 'CHECKOUT_VERIFY';
  providerEventId: string;
}

/**
 * Transition a contribution to PAID exactly once. Safe to call from both the
 * checkout verification path and the webhook path — whichever arrives first wins,
 * the second is recorded as a DUPLICATE event and causes no side effects.
 */
export async function applyCapturedPayment(input: ApplyPaidInput): Promise<{ applied: boolean; reason?: string }> {
  const { record, pool, payment, source, providerEventId } = input;

  // Idempotency guard (unique index on providerEventId)
  try {
    await PaymentEvent.create({
      providerEventId,
      source,
      eventType: 'payment.captured',
      paymentRecordId: record._id,
      poolId: pool._id,
      razorpayOrderId: payment.order_id,
      razorpayPaymentId: payment.id,
      processingStatus: 'PROCESSED',
      payload: { amount: payment.amount, status: payment.status, method: payment.method },
    });
  } catch (err: any) {
    if (err?.code === 11000) {
      return { applied: false, reason: 'duplicate_event' };
    }
    throw err;
  }

  if (payment.amount !== record.amountPaise) {
    await PaymentEvent.updateOne(
      { providerEventId },
      { $set: { processingStatus: 'FAILED', note: `Amount mismatch: expected ${record.amountPaise} got ${payment.amount}` } }
    );
    record.paymentStatus = 'FAILED';
    record.failureReason = 'Amount paid does not match the amount due. Contact the host.';
    await record.save();
    return { applied: false, reason: 'amount_mismatch' };
  }

  // Conditional update: only move to PAID if not already PAID (optimistic concurrency).
  const updated = await PaymentRecord.findOneAndUpdate(
    { _id: record._id, paymentStatus: { $ne: 'PAID' } },
    {
      $set: {
        paymentStatus: 'PAID',
        paymentMethod: 'RAZORPAY',
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id || record.razorpayOrderId,
        providerConfirmedAt: new Date(),
        paidAt: new Date(),
        failureReason: undefined,
      },
    },
    { new: true }
  ).populate('userId', 'fullName email hostel');

  if (!updated) {
    await PaymentEvent.updateOne({ providerEventId }, { $set: { processingStatus: 'DUPLICATE', note: 'Record already PAID' } });
    return { applied: false, reason: 'already_paid' };
  }

  await AuditEvent.create({
    poolId: pool._id,
    userId: record.userId,
    action: 'PAYMENT_VERIFIED',
    details: {
      method: 'RAZORPAY',
      razorpayPaymentId: payment.id,
      razorpayOrderId: payment.order_id,
      amount: record.totalDue,
      source,
    },
  });

  await announcePaymentStatus(pool, updated);
  return { applied: true };
}

export async function markPaymentFailed(
  record: IPaymentRecord,
  pool: IPool,
  reason: string,
  providerEventId: string,
  payment?: Partial<RazorpayPayment>
): Promise<boolean> {
  try {
    await PaymentEvent.create({
      providerEventId,
      source: 'WEBHOOK',
      eventType: 'payment.failed',
      paymentRecordId: record._id,
      poolId: pool._id,
      razorpayOrderId: payment?.order_id,
      razorpayPaymentId: payment?.id,
      processingStatus: 'PROCESSED',
      note: reason.slice(0, 300),
    });
  } catch (err: any) {
    if (err?.code === 11000) return false;
    throw err;
  }

  if (record.paymentStatus === 'PAID') return false; // never downgrade a verified payment

  record.paymentStatus = 'FAILED';
  record.failureReason = reason.slice(0, 300);
  if (payment?.id) record.razorpayPaymentId = payment.id;
  await record.save();

  await AuditEvent.create({
    poolId: pool._id,
    userId: record.userId,
    action: 'PAYMENT_FAILED',
    details: { reason, razorpayPaymentId: payment?.id },
  });

  const populated = await PaymentRecord.findById(record._id).populate('userId', 'fullName email hostel');
  if (populated) await announcePaymentStatus(pool, populated);
  return true;
}

/** Notify the payer and the host; emit socket events only to their private rooms. */
export async function announcePaymentStatus(pool: IPool, record: IPaymentRecord): Promise<void> {
  const payerId = ((record.userId as any)?._id || record.userId).toString();
  const hostId = pool.creator.toString();
  const payerName = (record.userId as any)?.fullName || 'A participant';

  const payload = {
    poolId: pool._id.toString(),
    record: sanitizeRecordForViewer(record, payerId, hostId),
    status: record.paymentStatus,
  };

  emitToUser(payerId, SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, payload);
  if (hostId !== payerId) {
    emitToUser(hostId, SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, {
      ...payload,
      record: sanitizeRecordForViewer(record, hostId, hostId),
    });
  }
  // Public (non-sensitive) hint so other members can refresh the outstanding-balance summary.
  broadcastPoolUpdate(pool._id.toString(), SOCKET_EVENTS.PAYMENT_RECORD_UPDATED, {
    poolId: pool._id.toString(),
    userId: payerId,
    status: record.paymentStatus,
  });

  const statusText: Record<string, string> = {
    PAID: 'verified as paid',
    FAILED: 'marked as failed',
    PROCESSING: 'submitted for review',
    REFUNDED: 'refunded',
    REFUND_PENDING: 'queued for refund',
    PENDING: 'reset to pending',
  };

  await notifyUsers([payerId], {
    type: 'PAYMENT_UPDATE',
    title: `Payment ${statusText[record.paymentStatus] || record.paymentStatus.toLowerCase()}`,
    message: `Your ₹${record.totalDue} contribution to "${pool.title}" was ${statusText[record.paymentStatus] || record.paymentStatus.toLowerCase()}.`,
    poolId: pool._id,
  });

  if (hostId !== payerId) {
    await notifyUsers([hostId], {
      type: 'PAYMENT_UPDATE',
      title: `${payerName}: payment ${statusText[record.paymentStatus] || record.paymentStatus.toLowerCase()}`,
      message: `₹${record.totalDue} for "${pool.title}" is now ${record.paymentStatus}.`,
      poolId: pool._id,
    });
  }
}

export function isObjectId(id: string): boolean {
  return Types.ObjectId.isValid(id);
}

export async function findPoolOrThrow(poolId: string): Promise<IPool | null> {
  if (!Types.ObjectId.isValid(poolId)) return null;
  return Pool.findById(poolId);
}
