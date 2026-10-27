export type HostelType = 'Uniworld 1' | 'Uniworld 2';
export type RetailerType = 'Blinkit' | 'Zepto' | 'Swiggy Instamart' | 'Flipkart Minutes' | 'Amazon Now' | 'BigBasket Now' | 'Other';
export type PoolStatus = 'OPEN' | 'LOCKED' | 'ORDERED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'FAILED' | 'REFUND_PENDING' | 'REFUNDED';
export type PaymentMethod = 'RAZORPAY' | 'MANUAL_UPI';
export type ThemePreference = 'dark' | 'light' | 'system';

export const HOSTELS: HostelType[] = ['Uniworld 1', 'Uniworld 2'];
export const RETAILERS: RetailerType[] = ['Blinkit', 'Zepto', 'Swiggy Instamart', 'Flipkart Minutes', 'Amazon Now', 'BigBasket Now', 'Other'];
export const COUNTDOWN_PRESETS = [5, 10, 15, 20, 30, 45, 60] as const;

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

/** The signed-in user (self view — includes phone + preferences). */
export interface User {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  hostelSelected: boolean;
  roomNumber?: string;
  isEmailVerified: boolean;
  role: 'student' | 'moderator';
  status: 'active' | 'deactivated';
  preferences: UserPreferences;
  hasLinkedPayoutAccount: boolean;
  createdAt: string;
}

/** Public projection of another student (never includes phone). */
export interface PublicUser {
  _id: string;
  fullName: string;
  email: string;
  hostel: HostelType;
  phoneNumber?: string; // only present for the host, when they allow it and viewer is a member
  roomNumber?: string;
}

export interface Pool {
  _id: string;
  title: string;
  retailer: RetailerType;
  retailerCustomName?: string;
  hostel: HostelType;
  deliveryZone: string;
  targetAmount: number;
  contributionCap?: number;
  participantLimit: number;
  closingTime: string;
  notes?: string;
  creator: PublicUser | string;
  status: PoolStatus;
  currentSubtotal: number;
  participants: (PublicUser | string)[];
  participantCount: number;
  remainingAmount: number;
  progressPercent: number;
  serverTime?: string;

  actualRetailerMinimum?: number;
  finalPayableAmount?: number;
  deliveryFee?: number;
  otherCharges?: number;
  paymentInstructions?: string;
  upiId?: string;
  qrCodeUrl?: string;
  proceedBelowTargetConfirmed?: boolean;

  extensionCount?: number;
  lockedAt?: string;
  reopenedAt?: string;
  orderPlacedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  expiredAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PoolItem {
  _id: string;
  poolId: string;
  userId: PublicUser | string;
  name: string;
  quantity: number;
  unitPrice: number;
  itemSubtotal: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SplitResult {
  userId: string;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  proportionPercent: number;
}

export interface CostSplitBreakdown {
  itemsSubtotal: number;
  deliveryFee: number;
  otherCharges: number;
  totalSharedFees: number;
  finalPayableAmount: number;
  splits: SplitResult[];
  allocationMethod: string;
}

export interface PaymentRecord {
  _id: string;
  poolId: string;
  userId: PublicUser | string;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  amountPaise: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethod;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpayRefundId?: string;
  paymentReference?: string;
  failureReason?: string;
  reviewNote?: string;
  signatureVerifiedAt?: string;
  providerConfirmedAt?: string;
  submittedAt?: string;
  reviewedAt?: string;
  paidAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentConfig {
  provider: 'razorpay' | 'manual';
  keyId: string | null;
  routeEnabled: boolean;
  testMode: boolean | null;
  manualFallbackAvailable: boolean;
}

export interface AuditEvent {
  _id: string;
  poolId: string;
  userId?: { _id: string; fullName: string; email: string };
  action: string;
  details: Record<string, any>;
  createdAt: string;
}

export type NotificationType =
  | 'POOL_INVITATION'
  | 'PARTICIPANT_JOINED'
  | 'POOL_NEARLY_FULL'
  | 'DEADLINE_APPROACHING'
  | 'PAYMENT_UPDATE'
  | 'ORDER_UPDATE'
  | 'SYSTEM';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  title: string;
  message: string;
  poolId?: string;
  read: boolean;
  readAt?: string;
  createdAt: string;
}

export interface PoolDetailResponse {
  success: boolean;
  pool: Pool;
  items: PoolItem[];
  paymentRecords: PaymentRecord[];
  costBreakdown: CostSplitBreakdown | null;
  auditEvents: AuditEvent[];
  viewer: { isHost: boolean; isParticipant: boolean };
  outstandingBalance: number;
  countdown: { serverTime: string; closingTime: string; secondsRemaining: number };
}

export interface OrderSummary extends Pool {
  isHost: boolean;
  myItemSubtotal: number;
  myItemCount: number;
  myContribution: {
    totalDue: number;
    allocatedFee: number;
    paymentStatus: PaymentStatus;
    paymentMethod?: PaymentMethod;
  } | null;
}

export interface Recommendation {
  pool: Pool;
  score: number;
  reasons: string[];
}

export interface MyStats {
  poolsCreated: number;
  poolsJoined: number;
  poolsCompleted: number;
  activePools: number;
  participationRatePercent: number | null;
  avgMinutesToLock: number | null;
  note: string;
}

export interface PoolDraft {
  title: string;
  retailer: RetailerType;
  retailerCustomName?: string;
  hostel: HostelType;
  deliveryZone: string;
  targetAmount: number;
  contributionCap?: number;
  participantLimit: number;
  durationMinutes: number;
  notes?: string;
}

export interface DraftItem {
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

export function userId(u: PublicUser | string | undefined | null): string {
  if (!u) return '';
  return typeof u === 'string' ? u : u._id;
}

export function userName(u: PublicUser | string | undefined | null, fallback = 'Student'): string {
  if (!u || typeof u === 'string') return fallback;
  return u.fullName || fallback;
}

export function retailerLabel(pool: Pick<Pool, 'retailer' | 'retailerCustomName'>): string {
  return pool.retailer === 'Other' && pool.retailerCustomName ? pool.retailerCustomName : pool.retailer;
}
