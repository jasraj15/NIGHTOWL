import React, { useState } from 'react';
import { History, ShieldCheck, ShoppingCart, Lock, Package, CheckCircle, Users, Wallet, XCircle, Clock, Flag, RotateCcw } from 'lucide-react';
import { AuditEvent } from '../../types/index.js';
import { formatTime, formatDate } from '../../utils/format.js';

const meta: Record<string, { label: string; icon: React.ReactNode }> = {
  POOL_CREATED: { label: 'Pool created', icon: <ShieldCheck className="h-3 w-3 text-lime" /> },
  PARTICIPANT_JOINED: { label: 'joined the pool', icon: <Users className="h-3 w-3 text-lime" /> },
  PARTICIPANT_LEFT: { label: 'left the pool', icon: <Users className="h-3 w-3 text-muted" /> },
  ITEM_ADDED: { label: 'added an item', icon: <ShoppingCart className="h-3 w-3 text-info" /> },
  ITEM_UPDATED: { label: 'updated an item', icon: <ShoppingCart className="h-3 w-3 text-info" /> },
  ITEM_REMOVED: { label: 'removed an item', icon: <ShoppingCart className="h-3 w-3 text-muted" /> },
  POOL_LOCKED: { label: 'locked the cart', icon: <Lock className="h-3 w-3 text-warn" /> },
  POOL_REOPENED: { label: 'reopened the cart', icon: <RotateCcw className="h-3 w-3 text-warn" /> },
  POOL_EXTENDED: { label: 'extended the deadline', icon: <Clock className="h-3 w-3 text-warn" /> },
  POOL_EXPIRED: { label: 'Pool expired', icon: <Clock className="h-3 w-3 text-muted" /> },
  ORDER_PLACED: { label: 'confirmed the retailer order', icon: <Package className="h-3 w-3 text-info" /> },
  POOL_DELIVERED: { label: 'marked the order delivered', icon: <CheckCircle className="h-3 w-3 text-ok" /> },
  POOL_CANCELLED: { label: 'cancelled the pool', icon: <XCircle className="h-3 w-3 text-danger" /> },
  PAYMENT_ORDER_CREATED: { label: 'started a Razorpay payment', icon: <Wallet className="h-3 w-3 text-info" /> },
  PAYMENT_VERIFIED: { label: 'payment verified by Razorpay', icon: <Wallet className="h-3 w-3 text-lime" /> },
  PAYMENT_FAILED: { label: 'payment failed', icon: <Wallet className="h-3 w-3 text-danger" /> },
  PAYMENT_SIGNATURE_INVALID: { label: 'payment signature rejected', icon: <Wallet className="h-3 w-3 text-danger" /> },
  PAYMENT_SUBMITTED: { label: 'submitted a UPI reference', icon: <Wallet className="h-3 w-3 text-info" /> },
  PAYMENT_CONFIRMED: { label: 'confirmed a manual payment', icon: <Wallet className="h-3 w-3 text-lime" /> },
  PAYMENT_REJECTED: { label: 'rejected a manual payment', icon: <Wallet className="h-3 w-3 text-danger" /> },
  PAYMENT_REFUND: { label: 'refund update', icon: <Wallet className="h-3 w-3 text-muted" /> },
  REPORT_FILED: { label: 'filed a report', icon: <Flag className="h-3 w-3 text-danger" /> },
};

export const ActivityTimeline: React.FC<{ events: AuditEvent[] }> = ({ events }) => {
  const [showAll, setShowAll] = useState(false);
  if (events.length === 0) return null;
  const list = showAll ? events : events.slice(0, 8);

  return (
    <section className="card p-5" aria-labelledby="activity-heading">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-lime" />
        <h3 id="activity-heading" className="text-sm font-bold text-fg">
          Activity
        </h3>
      </div>
      <ol className="relative mt-4 space-y-3 border-l border-line pl-4">
        {list.map((evt) => {
          const m = meta[evt.action] || { label: evt.action.replace(/_/g, ' ').toLowerCase(), icon: <History className="h-3 w-3 text-muted" /> };
          const actor = evt.userId?.fullName?.split(' ')[0];
          const systemEvent = evt.action === 'POOL_CREATED' || evt.action === 'POOL_EXPIRED';
          return (
            <li key={evt._id} className="relative text-xs">
              <span className="absolute -left-[23px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-line bg-raised">{m.icon}</span>
              <p className="text-fg">
                {!systemEvent && actor && <span className="font-semibold">{actor} </span>}
                {m.label}
                {evt.details?.itemName && <span className="text-muted"> — {evt.details.itemName}</span>}
                {evt.details?.participant && evt.action.startsWith('PAYMENT_') && <span className="text-muted"> — {evt.details.participant}</span>}
                {typeof evt.details?.amount === 'number' && <span className="font-mono text-muted"> · ₹{evt.details.amount}</span>}
              </p>
              <p className="text-[11px] text-faint">
                {formatDate(evt.createdAt)} · {formatTime(evt.createdAt)}
              </p>
            </li>
          );
        })}
      </ol>
      {events.length > 8 && (
        <button onClick={() => setShowAll((s) => !s)} className="mt-3 text-xs font-semibold text-lime hover:underline">
          {showAll ? 'Show less' : `Show all ${events.length} events`}
        </button>
      )}
    </section>
  );
};
