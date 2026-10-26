import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, MapPin, ArrowRight } from 'lucide-react';
import { Pool } from '../../types/index.js';
import { StatusBadge, RetailerBadge, HostelBadge } from '../common/Badge.js';

interface PoolCardProps {
  pool: Pool;
}

export const PoolCard: React.FC<PoolCardProps> = ({ pool }) => {
  const currentSubtotal = pool.currentSubtotal || 0;
  const targetAmount = pool.targetAmount || 1;
  const progressPercent = Math.min(100, Math.round((currentSubtotal / targetAmount) * 100));
  const remaining = Math.max(0, targetAmount - currentSubtotal);

  // Time remaining calculation
  const closingDate = new Date(pool.closingTime);
  const now = new Date();
  const diffMs = closingDate.getTime() - now.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / (60 * 1000)));

  const isClosed = pool.status !== 'OPEN';
  const creatorName =
    typeof pool.creator === 'object' && pool.creator !== null
      ? pool.creator.fullName
      : 'Hostel Student';

  return (
    <Link
      to={`/pools/${pool._id}`}
      className="group block bg-navy-850 hover:bg-navy-800 border border-navy-750 hover:border-lime/40 rounded-2xl p-5 shadow-lg transition-all duration-200 hover:-translate-y-0.5"
    >
      {/* Top Header: Retailer + Status + Hostel */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex flex-wrap items-center gap-2">
          <RetailerBadge retailer={pool.retailer} customName={pool.retailerCustomName} />
          <HostelBadge hostel={pool.hostel} />
        </div>
        <StatusBadge status={pool.status} />
      </div>

      {/* Pool Title */}
      <h3 className="text-lg font-bold text-ivory-50 group-hover:text-lime transition-colors line-clamp-1">
        {pool.title}
      </h3>

      {/* Pickup Spot */}
      <div className="flex items-center gap-1.5 text-xs text-ivory-400 mt-1 mb-4">
        <MapPin className="w-3.5 h-3.5 text-lime/80 flex-shrink-0" />
        <span className="truncate">{pool.deliveryZone}</span>
      </div>

      {/* Progress towards Target minimum order value */}
      <div className="space-y-1.5 mb-4 bg-navy-900/60 p-3 rounded-xl border border-navy-750">
        <div className="flex items-center justify-between text-xs">
          <span className="text-ivory-400 font-medium">Cart Progress</span>
          <span className="font-bold text-ivory-100">
            ₹{currentSubtotal} <span className="text-ivory-500">/ ₹{targetAmount}</span>
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-navy-950 rounded-full h-2 overflow-hidden border border-navy-700">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progressPercent >= 100
                ? 'bg-gradient-to-r from-lime to-emerald-400 shadow-glow-lime'
                : 'bg-lime'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-[11px] pt-0.5">
          {progressPercent >= 100 ? (
            <span className="text-lime font-semibold flex items-center gap-1">
              🎉 Target Met for Free Delivery!
            </span>
          ) : (
            <span className="text-amber-300 font-medium">
              ₹{remaining} needed for minimum
            </span>
          )}
          <span className="font-mono text-ivory-400">{progressPercent}%</span>
        </div>
      </div>

      {/* Footer Info: Host + Participants + Countdown */}
      <div className="flex items-center justify-between pt-2 border-t border-navy-750/70 text-xs text-ivory-400">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Users className="w-3.5 h-3.5 text-ivory-400" />
            <span className="truncate max-w-[120px]">
              {creatorName.split(' ')[0]} • {pool.participantCount || pool.participants?.length || 1}/{pool.participantLimit}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-ivory-400" />
            <span>
              {isClosed
                ? 'Closed'
                : diffMinutes > 60
                ? `${Math.floor(diffMinutes / 60)}h ${diffMinutes % 60}m`
                : `${diffMinutes}m left`}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 font-semibold text-lime text-xs group-hover:translate-x-1 transition-transform">
          Join Cart <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </div>
    </Link>
  );
};
