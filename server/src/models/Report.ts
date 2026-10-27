import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type ReportReason = 'INAPPROPRIATE_CONTENT' | 'SUSPICIOUS_PAYMENT' | 'ABUSIVE_PARTICIPANT' | 'OTHER';
export type ReportStatus = 'OPEN' | 'REVIEWED' | 'DISMISSED';

export interface IReport extends Document {
  reporter: Types.ObjectId;
  poolId: Types.ObjectId;
  reportedUser?: Types.ObjectId;
  reason: ReportReason;
  details: string;
  status: ReportStatus;
  moderatorNote?: string;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ReportSchema = new Schema<IReport>(
  {
    reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    poolId: { type: Schema.Types.ObjectId, ref: 'Pool', required: true, index: true },
    reportedUser: { type: Schema.Types.ObjectId, ref: 'User' },
    reason: {
      type: String,
      enum: ['INAPPROPRIATE_CONTENT', 'SUSPICIOUS_PAYMENT', 'ABUSIVE_PARTICIPANT', 'OTHER'],
      required: true,
    },
    details: { type: String, required: true, trim: true, minlength: 5, maxlength: 500 },
    status: { type: String, enum: ['OPEN', 'REVIEWED', 'DISMISSED'], default: 'OPEN', index: true },
    moderatorNote: { type: String, trim: true, maxlength: 300 },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
  },
  { timestamps: true }
);

ReportSchema.index({ status: 1, createdAt: -1 });

export const Report: Model<IReport> = mongoose.model<IReport>('Report', ReportSchema);
