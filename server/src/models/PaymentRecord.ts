import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export interface IPaymentRecord extends Document {
  poolId: Types.ObjectId;
  userId: Types.ObjectId;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  submittedAt?: Date;
  reviewedAt?: Date;
  reviewNote?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PaymentRecordSchema = new Schema<IPaymentRecord>(
  {
    poolId: {
      type: Schema.Types.ObjectId,
      ref: 'Pool',
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    allocatedFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    totalDue: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'SUBMITTED', 'CONFIRMED', 'REJECTED'],
      default: 'PENDING',
      index: true,
    },
    paymentReference: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    submittedAt: Date,
    reviewedAt: Date,
    reviewNote: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  {
    timestamps: true,
  }
);

PaymentRecordSchema.index({ poolId: 1, userId: 1 }, { unique: true });

export const PaymentRecord: Model<IPaymentRecord> = mongoose.model<IPaymentRecord>(
  'PaymentRecord',
  PaymentRecordSchema
);
