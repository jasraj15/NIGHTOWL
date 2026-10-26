import mongoose, { Document, Schema, Model } from 'mongoose';

export type OtpPurpose = 'register' | 'login';

export interface IOtpToken extends Document {
  email: string;
  otpHash: string;
  purpose: OtpPurpose;
  attempts: number;
  expiresAt: Date;
  resendAfter: Date;
  createdAt: Date;
  updatedAt: Date;
}

const OtpTokenSchema = new Schema<IOtpToken>(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      enum: ['register', 'login'],
      required: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup
    },
    resendAfter: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for email and purpose
OtpTokenSchema.index({ email: 1, purpose: 1 });

export const OtpToken: Model<IOtpToken> = mongoose.model<IOtpToken>('OtpToken', OtpTokenSchema);
