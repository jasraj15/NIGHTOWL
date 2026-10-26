import { Request, Response, NextFunction } from 'express';
import { Pool } from '../models/Pool.js';
import { PaymentRecord } from '../models/PaymentRecord.js';
import { AuditEvent } from '../models/AuditEvent.js';
import { submitPaymentSchema, reviewPaymentSchema } from '../validators/paymentSchemas.js';
import { broadcastPoolUpdate } from '../services/socketService.js';

export async function submitPaymentReference(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { poolId } = req.params;
    const userId = req.user!._id;
    const data = submitPaymentSchema.parse(req.body);

    const pool = await Pool.findById(poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    if (pool.status === 'OPEN' || pool.status === 'CANCELLED') {
      res.status(400).json({
        success: false,
        error: `Payments cannot be submitted when pool is ${pool.status.toLowerCase()}. Wait until the order is placed.`,
      });
      return;
    }

    const record = await PaymentRecord.findOne({ poolId: pool._id, userId });
    if (!record) {
      res.status(404).json({
        success: false,
        error: 'No payment record found for your account in this pool.',
      });
      return;
    }

    record.paymentReference = data.paymentReference;
    record.paymentStatus = 'SUBMITTED';
    record.submittedAt = new Date();
    await record.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: 'PAYMENT_SUBMITTED',
      details: {
        paymentReference: record.paymentReference,
        amountDue: record.totalDue,
      },
      ipAddress: req.ip,
    });

    const populatedRecord = await PaymentRecord.findById(record._id).populate(
      'userId',
      'fullName email hostel'
    );

    broadcastPoolUpdate(pool._id.toString(), 'payment:record_updated', {
      poolId: pool._id.toString(),
      record: populatedRecord,
    });

    res.status(200).json({
      success: true,
      message: 'Payment reference submitted. The pool owner will verify receipt.',
      record: populatedRecord,
    });
  } catch (err) {
    next(err);
  }
}

export async function reviewPayment(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { poolId, paymentId } = req.params;
    const userId = req.user!._id;
    const data = reviewPaymentSchema.parse(req.body);

    const pool = await Pool.findById(poolId);
    if (!pool) {
      res.status(404).json({ success: false, error: 'Pool not found.' });
      return;
    }

    // Authorization: Only pool owner can review and confirm payments
    if (pool.creator.toString() !== userId.toString()) {
      res.status(403).json({
        success: false,
        error: 'Only the pool owner is authorized to confirm or reject participant payments.',
      });
      return;
    }

    const record = await PaymentRecord.findById(paymentId).populate(
      'userId',
      'fullName email hostel'
    );

    if (!record || record.poolId.toString() !== pool._id.toString()) {
      res.status(404).json({
        success: false,
        error: 'Payment record not found in this pool.',
      });
      return;
    }

    record.paymentStatus = data.status;
    record.reviewedAt = new Date();
    if (data.reviewNote !== undefined) record.reviewNote = data.reviewNote;
    await record.save();

    await AuditEvent.create({
      poolId: pool._id,
      userId,
      action: data.status === 'CONFIRMED' ? 'PAYMENT_CONFIRMED' : 'PAYMENT_REJECTED',
      details: {
        paymentRecordId: record._id,
        participant: (record.userId as any)?.fullName || 'Participant',
        status: record.paymentStatus,
        reviewNote: record.reviewNote,
      },
      ipAddress: req.ip,
    });

    broadcastPoolUpdate(pool._id.toString(), 'payment:record_updated', {
      poolId: pool._id.toString(),
      record,
    });

    res.status(200).json({
      success: true,
      message: `Payment status marked as ${data.status}.`,
      record,
    });
  } catch (err) {
    next(err);
  }
}
