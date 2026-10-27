import mongoose, { Document, Schema, Model } from 'mongoose';

export type HostelType = 'Uniworld 1' | 'Uniworld 2';
export type UserRole = 'student' | 'moderator';
export type ThemePreference = 'dark' | 'light' | 'system';
export type UserStatus = 'active' | 'deactivated';

export interface NotificationPreferences {
  poolInvitations: boolean;
  someoneJoinsMyPool: boolean;
  poolNearlyFull: boolean;
  deadlineApproaching: boolean;
  paymentUpdates: boolean;
  orderUpdates: boolean;
}

export interface UserPreferences {
  theme: ThemePreference;
  notifications: NotificationPreferences;
  showPhoneToPoolMembers: boolean;
}

export interface IUser extends Document {
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  /** True once the user has explicitly picked a hostel on the onboarding screen. */
  hostelSelected: boolean;
  roomNumber?: string;
  isEmailVerified: boolean;
  role: UserRole;
  status: UserStatus;
  preferences: UserPreferences;
  /** Razorpay Route linked account id (acc_xxx) — only set after provider onboarding. */
  razorpayLinkedAccountId?: string;
  lastLoginAt?: Date;
  deactivatedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  poolInvitations: true,
  someoneJoinsMyPool: true,
  poolNearlyFull: true,
  deadlineApproaching: true,
  paymentUpdates: true,
  orderUpdates: true,
};

const NotificationPreferencesSchema = new Schema<NotificationPreferences>(
  {
    poolInvitations: { type: Boolean, default: true },
    someoneJoinsMyPool: { type: Boolean, default: true },
    poolNearlyFull: { type: Boolean, default: true },
    deadlineApproaching: { type: Boolean, default: true },
    paymentUpdates: { type: Boolean, default: true },
    orderUpdates: { type: Boolean, default: true },
  },
  { _id: false }
);

const PreferencesSchema = new Schema<UserPreferences>(
  {
    theme: { type: String, enum: ['dark', 'light', 'system'], default: 'dark' },
    notifications: { type: NotificationPreferencesSchema, default: () => ({}) },
    showPhoneToPoolMembers: { type: Boolean, default: false },
  },
  { _id: false }
);

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
      default: 'Uniworld 1',
      index: true,
    },
    hostelSelected: {
      type: Boolean,
      default: false,
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
    status: {
      type: String,
      enum: ['active', 'deactivated'],
      default: 'active',
      index: true,
    },
    preferences: {
      type: PreferencesSchema,
      default: () => ({}),
    },
    razorpayLinkedAccountId: {
      type: String,
      trim: true,
      maxlength: 40,
    },
    lastLoginAt: Date,
    deactivatedAt: Date,
  },
  {
    timestamps: true,
  }
);

/** Public projection: never leak phone numbers to unrelated users. */
export const PUBLIC_USER_FIELDS = 'fullName email hostel';
export const SELF_USER_FIELDS =
  'fullName email phoneNumber hostel hostelSelected roomNumber isEmailVerified role status preferences razorpayLinkedAccountId lastLoginAt createdAt';

export function toSelfUser(user: IUser) {
  return {
    _id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phoneNumber: user.phoneNumber,
    hostel: user.hostel,
    hostelSelected: user.hostelSelected,
    roomNumber: user.roomNumber,
    isEmailVerified: user.isEmailVerified,
    role: user.role,
    status: user.status,
    preferences: user.preferences,
    hasLinkedPayoutAccount: Boolean(user.razorpayLinkedAccountId),
    createdAt: user.createdAt,
  };
}

export const User: Model<IUser> = mongoose.model<IUser>('User', UserSchema);
