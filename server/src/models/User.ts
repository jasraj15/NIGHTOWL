import mongoose, { Document, Schema, Model } from 'mongoose';

export type HostelType = 'Uniworld 1' | 'Uniworld 2';
export type UserRole = 'student' | 'moderator';

export interface IUser extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  roomNumber?: string;
  isEmailVerified: boolean;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
      match: [/^[a-zA-Z0-9._%+-]+@sst\.scaler\.com$/, 'Email must be a valid @sst.scaler.com address'],
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
      match: [/^[6-9]\d{9}$/, 'Must be a valid 10-digit Indian mobile number'],
    },
    hostel: {
      type: String,
      enum: ['Uniworld 1', 'Uniworld 2'],
      required: true,
      index: true,
    },
    roomNumber: {
      type: String,
      trim: true,
      maxlength: 20,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    role: {
      type: String,
      enum: ['student', 'moderator'],
      default: 'student',
    },
  },
  {
    timestamps: true,
  }
);

// Do not return sensitive info if any
UserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
