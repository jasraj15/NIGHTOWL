import mongoose, { Document, Schema, Model, Types } from 'mongoose';

/**
 * A PaymentRecord is one participant's *contribution* to one pool:
 * item subtotal + allocated share of fees = totalDue, plus the provider-confirmed payment state.
 *
 * Status lifecycle (provider-driven where applicable):
 *   PENDING      — amount computed, nothing paid yet
 *   PROCESSING   — Razorpay order created / checkout opened, or a manual UPI reference awaiting host review
 *   PAID         — Razorpay payment captured & signature verified, or host confirmed manual receipt
 *   FAILED       — Razorpay payment failed, or host rejected the manual reference
 *   REFUND_PENDING / REFUNDED — refund lifecycle (webhook driven)
 */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REFUND_PENDING'
  | 'REFUNDED';

export type PaymentMethod = 'RAZORPAY' | 'MANUAL_UPI';

export interface IPaymentRecord extends Document {
  poolId: Types.ObjectId;
  userId: Types.ObjectId;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  /** totalDue expressed in paise — the authoritative integer amount sent to Razorpay. */
  amountPaise: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;

  // Razorpay identifiers (never secrets)
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  signatureVerifiedAt?: Date;
  providerConfirmedAt?: Date;
  failureReason?: string;

  // Manual UPI fallback
  paymentReference?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewNote?: string;

  paidAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    poolId: { type: Schema.Types.ObjectId, ref: 'Pool', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    itemSubtotal: { type: Number, required: true, min: 0 },
    allocatedFee: { type: Number, required: true, min: 0, default: 0 },
    totalDue: { type: Number, required: true, min: 0 },
    amountPaise: { type: Number, required: true, min: 0, default: 0 },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PROCESSING', 'PAID', 'FAILED', 'REFUND_PENDING', 'REFUNDED'],
      default: 'PENDING',
      index: true,
    },
    paymentMethod: { type: String, enum: ['RAZORPAY', 'MANUAL_UPI'] },

    razorpayOrderId: { type: String, trim: true, index: true, sparse: true },
    razorpayPaymentId: { type: String, trim: true, index: true, sparse: true },
    razorpayRefundId: { type: String, trim: true },
    signatureVerifiedAt: Date,
    providerConfirmedAt: Date,
    failureReason: { type: String, trim: true, maxlength: 300 },

    paymentReference: { type: String, trim: true, maxlength: 100 },
    submittedAt: Date,
    reviewedAt: Date,
    reviewNote: { type: String, trim: true, maxlength: 200 },

    paidAt: Date,
  },
  { timestamps: true }
);

PaymentRecordSchema.index({ poolId: 1, userId: 1 }, { unique: true });
PaymentRecordSchema.index({ userId: 1, createdAt: -1 });

PaymentRecordSchema.pre('validate', function (next) {
  if (typeof this.totalDue === 'number') {
    this.amountPaise = Math.round(this.totalDue * 100);
  }
  next();
});

export const PaymentRecord: Model<IPaymentRecord> = mongoose.model<IPaymentRecord>(
  'PaymentRecord',
  PaymentRecordSchema
);
