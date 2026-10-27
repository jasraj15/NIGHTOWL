import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type PaymentEventSource = 'WEBHOOK' | 'CHECKOUT_VERIFY' | 'MANUAL';
export type PaymentEventProcessing = 'PROCESSED' | 'IGNORED' | 'FAILED' | 'DUPLICATE';

/**
 * Every provider event (webhook delivery or checkout verification) is recorded exactly once.
 * `providerEventId` is unique, which makes webhook processing idempotent: a redelivered
 * webhook hits the unique index and is recorded as DUPLICATE without re-applying side effects.
 */
export interface IPaymentEvent extends Document {
  providerEventId: string;
  source: PaymentEventSource;
  eventType: string;
  paymentRecordId?: Types.ObjectId;
  poolId?: Types.ObjectId;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  processingStatus: PaymentEventProcessing;
  note?: string;
  /** Sanitised subset of the provider payload — never card/UPI credentials. */
  payload?: Record<string, unknown>;
  createdAt: Date;
}

const PaymentEventSchema = new Schema<IPaymentEvent>(
  {
    providerEventId: { type: String, required: true, unique: true, index: true },
    source: { type: String, enum: ['WEBHOOK', 'CHECKOUT_VERIFY', 'MANUAL'], required: true },
    eventType: { type: String, required: true, index: true },
    paymentRecordId: { type: Schema.Types.ObjectId, ref: 'PaymentRecord', index: true },
    poolId: { type: Schema.Types.ObjectId, ref: 'Pool', index: true },
    razorpayOrderId: { type: String, index: true },
    razorpayPaymentId: { type: String, index: true },
    processingStatus: {
      type: String,
      enum: ['PROCESSED', 'IGNORED', 'FAILED', 'DUPLICATE'],
      required: true,
    },
    note: { type: String, maxlength: 300 },
    payload: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const PaymentEvent: Model<IPaymentEvent> = mongoose.model<IPaymentEvent>(
  'PaymentEvent',
  PaymentEventSchema
);
