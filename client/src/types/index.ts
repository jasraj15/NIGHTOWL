export type HostelType = 'Uniworld 1' | 'Uniworld 2';
export type RetailerType = 'Blinkit' | 'Zepto' | 'Flipkart Minutes' | 'Other';
export type PoolStatus = 'OPEN' | 'LOCKED' | 'ORDERED' | 'DELIVERED' | 'CANCELLED' | 'EXPIRED';
export type PaymentStatus = 'PENDING' | 'SUBMITTED' | 'CONFIRMED' | 'REJECTED';

export interface User {
  _id: string;
  fullName: string;
  email: string;
  phoneNumber: string;
  hostel: HostelType;
  roomNumber?: string;
  isEmailVerified: boolean;
  role: 'student' | 'moderator';
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
  creator: User | string;
  status: PoolStatus;
  currentSubtotal: number;
  participants: (User | string)[];
  participantCount?: number;
  remainingAmount?: number;
  progressPercent?: number;

  actualRetailerMinimum?: number;
  finalPayableAmount?: number;
  deliveryFee?: number;
  otherCharges?: number;
  paymentInstructions?: string;
  upiId?: string;
  qrCodeUrl?: string;

  orderPlacedAt?: string;
  deliveredAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PoolItem {
  _id: string;
  poolId: string;
  userId: User | string;
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
  userId: User;
  itemSubtotal: number;
  allocatedFee: number;
  totalDue: number;
  paymentStatus: PaymentStatus;
  paymentReference?: string;
  submittedAt?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  _id: string;
  poolId: string;
  userId?: {
    _id: string;
    fullName: string;
    email: string;
  };
  action: string;
  details: Record<string, any>;
  createdAt: string;
}
