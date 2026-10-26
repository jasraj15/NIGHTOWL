import mongoose, { Document, Schema, Model, Types } from 'mongoose';

export interface IPoolItem extends Document {
  poolId: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
  note?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PoolItemSchema = new Schema<IPoolItem>(
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
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      validate: {
        validator: Number.isInteger,
        message: 'Quantity must be an integer',
      },
    },
    unitPrice: {
      type: Number,
      required: true,
      min: [1, 'Unit price must be at least ₹1'],
    },
    itemSubtotal: {
      type: Number,
      required: true,
      min: [1, 'Item subtotal must be at least ₹1'],
    },
    note: {
      type: String,
      trim: true,
      maxlength: 150,
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save hook to ensure itemSubtotal matches quantity * unitPrice
PoolItemSchema.pre('validate', function (next) {
  if (this.quantity && this.unitPrice) {
    this.itemSubtotal = Math.round(this.quantity * this.unitPrice * 100) / 100;
  }
  next();
});

// Index for fetching items of a pool fast
PoolItemSchema.index({ poolId: 1, userId: 1 });

export const PoolItem: Model<IPoolItem> = mongoose.model<IPoolItem>('PoolItem', PoolItemSchema);
