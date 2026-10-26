import React from 'react';
import { PoolStatus, RetailerType, PaymentStatus, HostelType } from '../../types/index.js';

interface StatusBadgeProps {
  status: PoolStatus;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  const styles: Record<PoolStatus, string> = {
    OPEN: 'bg-lime/10 text-lime border-lime/30 animate-pulse-subtle',
    LOCKED: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    ORDERED: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    DELIVERED: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
    CANCELLED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
    EXPIRED: 'bg-gray-500/10 text-gray-400 border-gray-600/30',
  };

  const labels: Record<PoolStatus, string> = {
    OPEN: '🟢 Open Cart',
    LOCKED: '🔒 Locked',
    ORDERED: '📦 Order Placed',
    DELIVERED: '✨ Delivered',
    CANCELLED: '🚫 Cancelled',
    EXPIRED: '⏰ Expired',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-full border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

interface RetailerBadgeProps {
  retailer: RetailerType;
  customName?: string;
}

export const RetailerBadge: React.FC<RetailerBadgeProps> = ({ retailer, customName }) => {
  const styles: Record<RetailerType, string> = {
    Blinkit: 'bg-amber-400/15 text-amber-300 border-amber-400/30',
    Zepto: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
    'Flipkart Minutes': 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    Other: 'bg-gray-700/30 text-gray-300 border-gray-600/30',
  };

  const displayName = retailer === 'Other' && customName ? customName : retailer;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-md border ${styles[retailer]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
      {displayName}
    </span>
  );
};

interface PaymentBadgeProps {
  status: PaymentStatus;
}

export const PaymentBadge: React.FC<PaymentBadgeProps> = ({ status }) => {
  const styles: Record<PaymentStatus, string> = {
    PENDING: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
    SUBMITTED: 'bg-blue-500/10 text-blue-300 border-blue-500/30',
    CONFIRMED: 'bg-lime/10 text-lime border-lime/30',
    REJECTED: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
  };

  const labels: Record<PaymentStatus, string> = {
    PENDING: '⏳ Payment Pending',
    SUBMITTED: '📨 Ref Submitted',
    CONFIRMED: '✅ Paid & Verified',
    REJECTED: '❌ Payment Rejected',
  };

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
};

export const HostelBadge: React.FC<{ hostel: HostelType }> = ({ hostel }) => {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded bg-navy-750 text-ivory-200 border border-navy-700">
      <span className="text-lime">🏢</span> {hostel}
    </span>
  );
};
