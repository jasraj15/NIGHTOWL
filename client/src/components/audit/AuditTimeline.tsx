import React from 'react';
import { History, ShieldCheck, ShoppingCart, Lock, Package, CheckCircle } from 'lucide-react';
import { AuditEvent } from '../../types/index.js';

interface AuditTimelineProps {
  events: AuditEvent[];
}

export const AuditTimeline: React.FC<AuditTimelineProps> = ({ events }) => {
  if (events.length === 0) return null;

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'POOL_CREATED':
        return <ShieldCheck className="w-3.5 h-3.5 text-lime" />;
      case 'ITEM_ADDED':
      case 'ITEM_REMOVED':
        return <ShoppingCart className="w-3.5 h-3.5 text-sky-400" />;
      case 'POOL_LOCKED':
        return <Lock className="w-3.5 h-3.5 text-amber-400" />;
      case 'ORDER_PLACED':
        return <Package className="w-3.5 h-3.5 text-indigo-400" />;
      case 'POOL_DELIVERED':
        return <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />;
      default:
        return <History className="w-3.5 h-3.5 text-ivory-400" />;
    }
  };

  const formatActionTitle = (action: string) => {
    switch (action) {
      case 'POOL_CREATED':
        return 'Order pool created';
      case 'PARTICIPANT_JOINED':
        return 'Student joined the pool';
      case 'PARTICIPANT_LEFT':
        return 'Participant left the pool';
      case 'ITEM_ADDED':
        return 'Item added to group cart';
      case 'ITEM_UPDATED':
        return 'Item details updated';
      case 'ITEM_REMOVED':
        return 'Item removed from cart';
      case 'POOL_LOCKED':
        return 'Pool locked for ordering';
      case 'ORDER_PLACED':
        return 'Retailer order confirmed';
      case 'POOL_DELIVERED':
        return 'Group order delivered';
      case 'POOL_CANCELLED':
        return 'Pool cancelled';
      case 'PAYMENT_SUBMITTED':
        return 'Payment reference submitted';
      case 'PAYMENT_CONFIRMED':
        return 'Host confirmed payment receipt';
      case 'PAYMENT_REJECTED':
        return 'Host rejected payment reference';
      default:
        return action.replace(/_/g, ' ');
    }
  };

  return (
    <div className="bg-navy-850 border border-navy-750 rounded-2xl p-6 shadow-xl">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-lime" />
        <h4 className="text-sm font-bold text-ivory-100">Live Pool Activity & Audit Trail</h4>
      </div>

      <div className="relative pl-4 space-y-4 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-navy-750">
        {events.slice(0, 10).map((evt) => {
          const dateStr = new Date(evt.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          });

          return (
            <div key={evt._id} className="relative flex items-start gap-3 text-xs">
              <div className="absolute -left-4 top-1 w-3 h-3 rounded-full bg-navy-800 border border-navy-700 flex items-center justify-center">
                {getActionIcon(evt.action)}
              </div>
              <div className="flex-1">
                <span className="font-semibold text-ivory-200">
                  {formatActionTitle(evt.action)}
                </span>
                {evt.userId?.fullName && (
                  <span className="text-ivory-400 ml-1.5">by {evt.userId.fullName}</span>
                )}
                {evt.details?.itemName && (
                  <span className="text-lime font-mono ml-1">
                    (&quot;{evt.details.itemName}&quot;)
                  </span>
                )}
              </div>
              <span className="text-[11px] text-ivory-500 font-mono flex-shrink-0">
                {dateStr}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
