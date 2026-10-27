import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { env, razorpayConfigured } from '../config/env.js';
import { Pool } from '../models/Pool.js';
import { User } from '../models/User.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { PaymentEvent } from '../models/PaymentEvent.js';
import { AuditEvent } from '../models/AuditEvent.js';
import {
  submitPaymentSchema,
  reviewPaymentSchema,
  verifyRazorpayPaymentSchema,
} from '../validators/paymentSchemas.js';
import {
  createRazorpayOrder,
  fetchRazorpayPayment,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  getPublicPaymentConfig,
  RazorpayError,
} from '../services/razorpayClient.js';
import {
  applyCapturedPayment,
  markPaymentFailed,
  announcePaymentStatus,
  sanitizeRecordForViewer,
  getBreakdownForPool,
  findPoolOrThrow,
} from '../services/paymentService.js';

const PAYABLE_STATUSES = new Set(['ORDERED', 'DELIVERED']);

/** GET /payments/config — what the browser needs (never the secret). */
export function getPaymentConfig(_req: Request, res: Response): void {
  res.status(200).json({ success: true, config: getPublicPaymentConfig() });
}

/** GET /pools/:poolId/payments/me — my contribution + transparent breakdown. */
export async function getMyContribution(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pool = await findPoolOrThrow(req.params.poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    const userId = req.user!._id;
    const isMember = pool.participants.some((p) => p.toString() === userId);
    if (!isMember) {
      res.status(403).json({ success: false, error: 'You are not a participant of this pool.' });
      return;
    }
    const record = await PaymentRecord.findOne({ poolId: pool._id, userId }).populate('userId', 'fullName email hostel');
    const breakdown = await getBreakdownForPool(pool);
    res.status(200).json({
      success: true,
      record: record ? sanitizeRecordForViewer(record, userId, pool.creator.toString()) : null,
      breakdown,
      poolStatus: pool.status,
      payable: PAYABLE_STATUSES.has(pool.status),
      config: getPublicPaymentConfig(),
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /pools/:poolId/payments/razorpay/order
 * Steps 1–3: authenticated participant requests payment → backend computes amount → creates Razorpay order.
 */
export async function createPaymentOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!razorpayConfigured) {
      res.status(503).json({
        success: false,
        error: 'Online payments are not configured on this server. Use the manual UPI reference flow instead.',
        code: 'RAZORPAY_NOT_CONFIGURED',
      });
      return;
    }

    const pool = await findPoolOrThrow(req.params.poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    const userId = req.user!._id;

    if (!PAYABLE_STATUSES.has(pool.status)) {
      res.status(400).json({
        success: false,
        error: `Payments open once the host confirms the retailer order. Current status: ${pool.status}.`,
      });
      return;
    }
    if (pool.creator.toString() === userId) {
      res.status(400).json({ success: false, error: 'The host does not pay themselves through NightOwl.' });
      return;
    }

    const record = await PaymentRecord.findOne({ poolId: pool._id, userId });
    if (!record) {
      res.status(404).json({ success: false, error: 'No contribution found for you in this pool.' });
      return;
    }
    if (record.paymentStatus === 'PAID') {
      res.status(409).json({ success: false, error: 'This contribution is already paid.' });
      return;
    }
    if (record.amountPaise < 100) {
      res.status(400).json({ success: false, error: 'Amount due is below the ₹1 provider minimum.' });
      return;
    }

    // Reuse an existing unpaid order for this amount instead of creating a new one every click.
    if (record.razorpayOrderId && record.paymentStatus === 'PROCESSING' && record.paymentMethod === 'RAZORPAY') {
      res.status(200).json({
        success: true,
        reused: true,
        order: { id: record.razorpayOrderId, amount: record.amountPaise, currency: 'INR' },
        keyId: env.RAZORPAY_KEY_ID,
        contribution: sanitizeRecordForViewer(record, userId, pool.creator.toString()),
        payer: { name: req.user!.fullName, email: req.user!.email, contact: req.user!.phoneNumber },
      });
      return;
    }

    // Razorpay Route: only when enabled AND the host has a provider-onboarded linked account.
    let transferToLinkedAccountId: string | undefined;
    if (env.RAZORPAY_ROUTE_ENABLED) {
      const host = await User.findById(pool.creator).select('razorpayLinkedAccountId').lean();
      if (host?.razorpayLinkedAccountId) transferToLinkedAccountId = host.razorpayLinkedAccountId;
    }

    const order = await createRazorpayOrder({
      amountPaise: record.amountPaise,
      receipt: `no_${record._id.toString().slice(-18)}`,
      notes: {
        poolId: pool._id.toString(),
        paymentRecordId: record._id.toString(),
        userId,
      },
      transferToLinkedAccountId,
    });

    record.razorpayOrderId = order.id;
    record.paymentMethod = 'RAZORPAY';
    record.paymentStatus = 'PROCESSING';
    record.failureReason = undefined;
    await record.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PAYMENT_ORDER_CREATED',
      details: { razorpayOrderId: order.id, amount: record.totalDue, routeTransfer: Boolean(transferToLinkedAccountId) },
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      keyId: env.RAZORPAY_KEY_ID,
      contribution: sanitizeRecordForViewer(record, userId, pool.creator.toString()),
      payer: { name: req.user!.fullName, email: req.user!.email, contact: req.user!.phoneNumber },
      settlement: transferToLinkedAccountId
        ? 'ROUTE_TRANSFER_TO_HOST'
        : 'PLATFORM_MERCHANT_ACCOUNT',
    });
  } catch (err) {
    if (err instanceof RazorpayError) {
      res.status(err.statusCode).json({ success: false, error: err.message, code: 'RAZORPAY_ERROR' });
      return;
    }
    next(err);
  }
}

/**
 * POST /pools/:poolId/payments/razorpay/verify
 * Steps 6–10: verify signature, confirm with Razorpay, persist, then (and only then) report success.
 */
export async function verifyPaymentCheckout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = verifyRazorpayPaymentSchema.parse(req.body);
    const pool = await findPoolOrThrow(req.params.poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    const userId = req.user!._id;

    const record = await PaymentRecord.findOne({ poolId: pool._id, userId });
    if (!record) {
      res.status(404).json({ success: false, error: 'No contribution found for you in this pool.' });
      return;
    }

    // The order must be the one we created for THIS contribution (prevents replaying another user's receipt).
    if (!record.razorpayOrderId || record.razorpayOrderId !== data.razorpay_order_id) {
      res.status(403).json({ success: false, error: 'Order does not belong to your contribution.' });
      return;
    }

    if (!verifyCheckoutSignature(data.razorpay_order_id, data.razorpay_payment_id, data.razorpay_signature)) {
      await AuditEvent.create({
        poolId: pool._id,
        userId,
        action: 'PAYMENT_SIGNATURE_INVALID',
        details: { razorpayOrderId: data.razorpay_order_id, razorpayPaymentId: data.razorpay_payment_id },
        ipAddress: req.ip,
      });
      res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
      return;
    }

    record.signatureVerifiedAt = new Date();
    await record.save();

    // Step 8: confirm with the provider.
    let payment;
    try {
      payment = await fetchRazorpayPayment(data.razorpay_payment_id);
    } catch (err: any) {
      // Signature is valid but we cannot reach Razorpay right now: keep PROCESSING; the webhook will finalise.
      record.paymentStatus = 'PROCESSING';
      record.razorpayPaymentId = data.razorpay_payment_id;
      await record.save();
      res.status(202).json({
        success: true,
        pending: true,
        message: 'Signature verified. Waiting for Razorpay to confirm capture (webhook).',
        contribution: sanitizeRecordForViewer(record, userId, pool.creator.toString()),
      });
      return;
    }

    if (payment.order_id !== record.razorpayOrderId) {
      res.status(400).json({ success: false, error: 'Payment does not belong to this order.' });
      return;
    }

    if (payment.status === 'captured') {
      const result = await applyCapturedPayment({
        record,
        pool,
        payment,
        source: 'CHECKOUT_VERIFY',
        providerEventId: `checkout:${payment.id}`,
      });
      const fresh = (await PaymentRecord.findById(record._id).populate('userId', 'fullName email hostel')) || record;
      if (result.applied || result.reason === 'duplicate_event' || result.reason === 'already_paid') {
        res.status(200).json({
          success: true,
          message: 'Payment verified and recorded.',
          contribution: sanitizeRecordForViewer(fresh, userId, pool.creator.toString()),
        });
      } else {
        res.status(400).json({
          success: false,
          error: fresh?.failureReason || 'Payment could not be reconciled.',
          contribution: sanitizeRecordForViewer(fresh, userId, pool.creator.toString()),
        });
      }
      return;
    }

    if (payment.status === 'authorized') {
      record.paymentStatus = 'PROCESSING';
      record.razorpayPaymentId = payment.id;
      await record.save();
      res.status(202).json({
        success: true,
        pending: true,
        message: 'Payment authorised; awaiting capture confirmation from Razorpay.',
        contribution: sanitizeRecordForViewer(record, userId, pool.creator.toString()),
      });
      return;
    }

    await markPaymentFailed(
      record,
      pool,
      payment.error_description || `Provider reported status ${payment.status}`,
      `checkout-failed:${payment.id}`,
      payment
    );
    res.status(400).json({ success: false, error: 'Payment was not successful.' });
  } catch (err) {
    if (err instanceof RazorpayError) {
      res.status(err.statusCode).json({ success: false, error: err.message, code: 'RAZORPAY_ERROR' });
      return;
    }
    next(err);
  }
}

/**
 * POST /payments/razorpay/webhook  (mounted with express.raw — body is a Buffer)
 * Step 11: verify webhook signature over the raw body and process idempotently.
 */
export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.header('x-razorpay-signature');
  const rawBody: Buffer = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body || {}));

  if (!env.RAZORPAY_WEBHOOK_SECRET) {
    res.status(503).json({ success: false, error: 'Webhook secret not configured.' });
    return;
  }
  if (!verifyWebhookSignature(rawBody, signature)) {
    res.status(400).json({ success: false, error: 'Invalid webhook signature.' });
    return;
  }

  let event: any;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    res.status(400).json({ success: false, error: 'Malformed JSON.' });
    return;
  }

  const eventType: string = event?.event || 'unknown';
  // Razorpay sends a unique event id header; fall back to a content hash if missing.
  const providerEventId =
    req.header('x-razorpay-event-id') ||
    `hash:${crypto.createHash('sha256').update(rawBody).digest('hex').slice(0, 40)}`;

  // Exact redelivery of an already fully-processed webhook → no-op.
  const alreadyDelivered = await PaymentEvent.exists({ providerEventId });
  if (alreadyDelivered) {
    res.status(200).json({ success: true, duplicate: true });
    return;
  }

  const paymentEntity = event?.payload?.payment?.entity;
  const refundEntity = event?.payload?.refund?.entity;
  const orderId: string | undefined = paymentEntity?.order_id || event?.payload?.order?.entity?.id;

  try {
    const record = orderId ? await PaymentRecord.findOne({ razorpayOrderId: orderId }) : null;
    const pool = record ? await Pool.findById(record.poolId) : null;

    if (!record || !pool) {
      await PaymentEvent.create({
        providerEventId,
        source: 'WEBHOOK',
        eventType,
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentEntity?.id,
        processingStatus: 'IGNORED',
        note: 'No matching contribution for this order',
      }).catch(() => undefined);
      res.status(200).json({ success: true, ignored: true });
      return;
    }

    switch (eventType) {
      case 'payment.captured':
      case 'order.paid': {
        if (!paymentEntity) break;
        await applyCapturedPayment({
          record,
          pool,
          payment: paymentEntity,
          source: 'WEBHOOK',
          providerEventId: `webhook:${eventType}:${paymentEntity.id}`,
        });
        break;
      }
      case 'payment.failed': {
        await markPaymentFailed(
          record,
          pool,
          paymentEntity?.error_description || 'Payment failed at provider',
          `webhook:payment.failed:${paymentEntity?.id || providerEventId}`,
          paymentEntity
        );
        break;
      }
      case 'refund.created':
      case 'refund.processed': {
        try {
          await PaymentEvent.create({
            providerEventId: `webhook:${eventType}:${refundEntity?.id || providerEventId}`,
            source: 'WEBHOOK',
            eventType,
            paymentRecordId: record._id,
            poolId: pool._id,
            razorpayOrderId: orderId,
            razorpayPaymentId: paymentEntity?.id,
            processingStatus: 'PROCESSED',
          });
        } catch (err: any) {
          if (err?.code === 11000) break;
          throw err;
        }
        record.paymentStatus = eventType === 'refund.processed' ? 'REFUNDED' : 'REFUND_PENDING';
        record.razorpayRefundId = refundEntity?.id;
        await record.save();
        await AuditEvent.create({ poolId: pool._id, userId: record.userId, action: 'PAYMENT_REFUND', details: { eventType, refundId: refundEntity?.id } });
        const populated = await PaymentRecord.findById(record._id).populate('userId', 'fullName email hostel');
        if (populated) await announcePaymentStatus(pool, populated);
        break;
      }
      default: {
        await PaymentEvent.create({
          providerEventId,
          source: 'WEBHOOK',
          eventType,
          paymentRecordId: record._id,
          poolId: pool._id,
          razorpayOrderId: orderId,
          processingStatus: 'IGNORED',
          note: 'Unhandled event type',
        }).catch(() => undefined);
      }
    }

    // Also record the raw delivery id so an exact redelivery is a no-op.
    await PaymentEvent.create({
      providerEventId,
      source: 'WEBHOOK',
      eventType: `${eventType}:delivery`,
      paymentRecordId: record._id,
      poolId: pool._id,
      razorpayOrderId: orderId,
      razorpayPaymentId: paymentEntity?.id,
      processingStatus: 'PROCESSED',
    }).catch(() => undefined);

    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Webhook processing error:', err?.message);
    // 500 makes Razorpay retry; idempotency guards make retries safe.
    res.status(500).json({ success: false, error: 'Webhook processing failed.' });
  }
}

/** POST /pools/:poolId/payments/manual — clearly labelled host-verified UPI fallback. */
export async function submitPaymentReference(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = submitPaymentSchema.parse(req.body);
    const pool = await findPoolOrThrow(req.params.poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    const userId = req.user!._id;

    if (!PAYABLE_STATUSES.has(pool.status)) {
      res.status(400).json({
        success: false,
        error: `Payments cannot be submitted while the pool is ${pool.status.toLowerCase()}. Wait until the order is placed.`,
      });
      return;
    }

    const record = await PaymentRecord.findOne({ poolId: pool._id, userId });
    if (!record) {
      res.status(404).json({ success: false, error: 'No payment record found for your account in this pool.' });
      return;
    }
    if (record.paymentStatus === 'PAID') {
      res.status(409).json({ success: false, error: 'This contribution is already paid.' });
      return;
    }

    record.paymentReference = data.paymentReference;
    record.paymentMethod = 'MANUAL_UPI';
    record.paymentStatus = 'PROCESSING';
    record.submittedAt = new Date();
    record.failureReason = undefined;
    await record.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PAYMENT_SUBMITTED',
      details: { paymentReference: record.paymentReference, amountDue: record.totalDue, method: 'MANUAL_UPI' },
      ipAddress: req.ip,
    });

    const populated = await PaymentRecord.findById(record._id).populate('userId', 'fullName email hostel');
    if (populated) await announcePaymentStatus(pool, populated);

    res.status(200).json({
      success: true,
      message: 'Payment reference submitted. The pool host will verify receipt in their UPI app.',
      record: sanitizeRecordForViewer(populated, userId, pool.creator.toString()),
    });
  } catch (err) {
    next(err);
  }
}

/** POST /pools/:poolId/payments/:paymentId/review — host confirms/rejects a MANUAL reference only. */
export async function reviewPayment(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const data = reviewPaymentSchema.parse(req.body);
    const pool = await findPoolOrThrow(req.params.poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }
    const userId = req.user!._id;

    if (pool.creator.toString() !== userId) {
      res.status(403).json({ success: false, error: 'Only the pool host can review manual payments.' });
      return;
    }

    const record = await PaymentRecord.findById(req.params.paymentId).populate('userId', 'fullName email hostel');
    if (!record || record.poolId.toString() !== pool._id.toString()) {
      res.status(404).json({ success: false, error: 'Payment record not found in this pool.' });
      return;
    }
    if (record.paymentMethod === 'RAZORPAY' && record.paymentStatus === 'PAID') {
      res.status(400).json({ success: false, error: 'Provider-verified payments cannot be overridden manually.' });
      return;
    }

    record.paymentStatus = data.status;
    record.paymentMethod = record.paymentMethod || 'MANUAL_UPI';
    record.reviewedAt = new Date();
    if (data.status === 'PAID') record.paidAt = new Date();
    if (data.reviewNote !== undefined) record.reviewNote = data.reviewNote;
    await record.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: data.status === 'PAID' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_REJECTED',
      details: {
        paymentRecordId: record._id,
        participant: (record.userId as any)?.fullName || 'Participant',
        status: record.paymentStatus,
        reviewNote: record.reviewNote,
      },
      ipAddress: req.ip,
    });

    await announcePaymentStatus(pool, record);

    res.status(200).json({
      success: true,
      message: `Payment marked as ${data.status}.`,
      record: sanitizeRecordForViewer(record, userId, pool.creator.toString()),
    });
  } catch (err) {
    next(err);
  }
}

/** GET /payments/history — the current user's payment records across all pools. */
export async function getMyPaymentHistory(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const userId = req.user!._id;
    const records = await PaymentRecord.find({ userId })
      .populate('poolId', 'title retailer hostel status creator orderPlacedAt deliveredAt')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const summary = records.reduce(
      (acc, r: any) => {
        acc.totalDue += r.totalDue || 0;
        if (r.paymentStatus === 'PAID') acc.totalPaid += r.totalDue || 0;
        return acc;
      },
      { totalDue: 0, totalPaid: 0 }
    );

    res.status(200).json({
      success: true,
      records: records.map((r: any) => ({
        _id: r._id,
        pool: r.poolId,
        itemSubtotal: r.itemSubtotal,
        allocatedFee: r.allocatedFee,
        totalDue: r.totalDue,
        paymentStatus: r.paymentStatus,
        paymentMethod: r.paymentMethod,
        razorpayOrderId: r.razorpayOrderId,
        razorpayPaymentId: r.razorpayPaymentId,
        paymentReference: r.paymentReference,
        paidAt: r.paidAt,
        createdAt: r.createdAt,
      })),
      summary: {
        totalDue: Math.round(summary.totalDue * 100) / 100,
        totalPaid: Math.round(summary.totalPaid * 100) / 100,
      },
    });
  } catch (err) {
    next(err);
  }
}
