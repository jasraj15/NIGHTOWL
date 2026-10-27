import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export type NotificationType =
  | 'POOL_INVITATION'
  | 'PARTICIPANT_JOINED'
  | 'POOL_NEARLY_FULL'
  | 'DEADLINE_APPROACHING'
  | 'PAYMENT_UPDATE'
  | 'ORDER_UPDATE'
  | 'SYSTEM';

export interface INotification extends Document {
  recipient: Types.ObjectId;
  type: NotificationType;
  title: string;
  message: string;
  poolId?: Types.ObjectId;
  read: boolean;
  readAt?: Date;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: [
        'POOL_INVITATION',
        'PARTICIPANT_JOINED',
        'POOL_NEARLY_FULL',
        'DEADLINE_APPROACHING',
        'PAYMENT_UPDATE',
        'ORDER_UPDATE',
        'SYSTEM',
      ],
      required: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    message: { type: String, required: true, trim: true, maxlength: 400 },
    poolId: { type: Schema.Types.ObjectId, ref: 'Pool', index: true },
    read: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

NotificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

export const Notification: Model<INotification> = mongoose.model<INotification>(
  'Notification',
  NotificationSchema
);
