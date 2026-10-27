import mongoose, { Document, Schema, Model, Types } from 'mongoose';
import { HostelType } from './User.js';

export type RetailerType = 'Blinkit' | 'Zepto' | 'Swiggy Instamart' | 'Flipkart Minutes' | 'Amazon Now' | 'BigBasket Now' | 'Other';
export type PoolStatus = 'OPEN' | 'LOCKED' | 'ORDERED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';

export interface IPool extends Document {
  title: string;
  retailer: RetailerType;
  retailerCustomName?: string;
  hostel: HostelType;
  deliveryZone: string;
  targetAmount: number;
  contributionCap?: number;
  participantLimit: number;
  closingTime: Date;
  notes?: string;
  creator: Types.ObjectId;
  status: PoolStatus;
  
  // Post-lock / ordering details
  actualRetailerMinimum?: number;
  finalPayableAmount?: number;
  deliveryFee?: number;
  otherCharges?: number;
  paymentInstructions?: string;
  upiId?: string;
  qrCodeUrl?: string;

  // Cached aggregates
  currentSubtotal: number;
  participants: Types.ObjectId[];

  lockedAt?: Date;
  reopenedAt?: Date;
  extensionCount: number;
  orderPlacedAt?: Date;
  deliveredAt?: Date;
  cancelledAt?: Date;
  expiredAt?: Date;
  /** Owner explicitly confirmed the retailer's real minimum/delivery requirements before proceeding below target. */
  proceedBelowTargetConfirmed?: boolean;

  createdAt: Date;
  updatedAt: Date;
}

const PoolSchema = new Schema<IPool>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 100,
    },
    retailer: {
      type: String,
      enum: ['Blinkit', 'Zepto', 'Swiggy Instamart', 'Flipkart Minutes', 'Amazon Now', 'BigBasket Now', 'Other'],
      required: true,
      index: true,
    },
    retailerCustomName: {
      type: String,
      trim: true,
      maxlength: 50,
    },
    hostel: {
      type: String,
      enum: ['Uniworld 1', 'Uniworld 2'],
      required: true,
      index: true,
    },
    deliveryZone: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: [1, 'Target amount must be at least ₹1'],
    },
    contributionCap: {
      type: Number,
      min: [1, 'Contribution cap must be positive'],
    },
    participantLimit: {
      type: Number,
      default: 30,
      min: [2, 'At least 2 participants allowed'],
      max: [30, 'Maximum 30 participants allowed'],
    },
    closingTime: {
      type: Date,
      required: true,
      index: true,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    creator: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['OPEN', 'LOCKED', 'ORDERED', 'DELIVERED', 'CANCELLED', 'EXPIRED'],
      default: 'OPEN',
      index: true,
    },
    actualRetailerMinimum: {
      type: Number,
      min: 0,
    },
    finalPayableAmount: {
      type: Number,
      min: 0,
    },
    deliveryFee: {
      type: Number,
      min: 0,
      default: 0,
    },
    otherCharges: {
      type: Number,
      min: 0,
      default: 0,
    },
    paymentInstructions: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    upiId: {
      type: String,
      trim: true,
      maxlength: 60,
    },
    qrCodeUrl: {
      type: String,
      trim: true,
    },
    currentSubtotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    participants: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    lockedAt: Date,
    reopenedAt: Date,
    extensionCount: { type: Number, default: 0, min: 0 },
    orderPlacedAt: Date,
    deliveredAt: Date,
    cancelledAt: Date,
    expiredAt: Date,
    proceedBelowTargetConfirmed: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for discovery and filtering
PoolSchema.index({ hostel: 1, status: 1, createdAt: -1 });
PoolSchema.index({ retailer: 1, status: 1 });
PoolSchema.index({ participants: 1 });
PoolSchema.index({ status: 1, closingTime: 1 });
PoolSchema.index({ creator: 1, status: 1, createdAt: -1 });

export const Pool: Model<IPool> = mongoose.model<IPool>('Pool', PoolSchema);
