import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IAuditEvent extends Document {
  poolId: Types.ObjectId;
  userId?: Types.ObjectId;
  action: string;
  details: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}

const AuditEventSchema = new Schema<IAuditEvent>(
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
      index: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    details: {
      type: Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

AuditEventSchema.index({ poolId: 1, createdAt: -1 });

export const AuditEvent: Model<IAuditEvent> = mongoose.model<IAuditEvent>(
  'AuditEvent',
  AuditEventSchema
);
