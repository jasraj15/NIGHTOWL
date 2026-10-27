import React from 'react';
import { Link } from 'react-router-dom';
import { Users, Clock, MapPin, ArrowRight, Sparkles } from 'lucide-react';
import { Pool, userName } from '../../types/index.js';
import { StatusBadge, RetailerBadge, HostelBadge, Progress } from '../ui/Bits.js';
import { useCountdown } from '../../hooks/useCountdown.js';
import { money, formatCountdown, cx } from '../../utils/format.js';

interface PoolCardProps {
  pool: Pool;
  reasons?: string[];
  highlight?: boolean;
}

export const PoolCard: React.FC<PoolCardProps> = ({ pool, reasons, highlight }) => {
  const { seconds, urgent, expired } = useCountdown(pool.closingTime, pool.serverTime);
  const isOpen = pool.status === 'OPEN' && !expired;
  const remaining = pool.remainingAmount ?? Math.max(0, pool.targetAmount - pool.currentSubtotal);
  const progress = pool.progressPercent ?? Math.min(100, Math.round((pool.currentSubtotal / pool.targetAmount) * 100));

  return (
    <Link
      to={`/pools/${pool._id}`}
      className={cx(
        'card group block p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-lime/40',
        highlight && 'border-lime/30 bg-gradient-to-br from-raised to-lime/5'
      )}
      aria-label={`${pool.title}, ${pool.retailer}, ${pool.hostel}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <RetailerBadge retailer={pool.retailer} customName={pool.retailerCustomName} />
          <HostelBadge hostel={pool.hostel} />
        </div>
        <StatusBadge status={expired && pool.status === 'OPEN' ? 'EXPIRED' : pool.status} />
      </div>

      <h3 className="mt-3 line-clamp-1 text-lg font-bold text-fg transition-colors group-hover:text-lime">{pool.title}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0 text-lime/80" />
        <span className="truncate">{pool.deliveryZone}</span>
        <span className="text-faint">· by {userName(pool.creator).split(' ')[0]}</span>
      </p>

      <div className="mt-4 rounded-xl border border-line bg-canvas/60 p-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium text-muted">Cart total</span>
          <span className="font-bold text-fg">
            {money(pool.currentSubtotal)} <span className="text-faint">/ {money(pool.targetAmount)}</span>
          </span>
        </div>
        <Progress value={progress} className="mt-2" label="Progress toward minimum order" />
        <div className="mt-1.5 flex items-center justify-between text-[11px]">
          {remaining <= 0 ? (
            <span className="font-semibold text-ok">Free delivery unlocked</span>
          ) : (
            <span className="font-semibold text-fg">{money(remaining)} more needed</span>
          )}
          <span className="font-mono text-faint">{progress}%</span>
        </div>
      </div>

      {reasons && reasons.length > 0 && (
        <ul className="mt-3 space-y-1">
          {reasons.slice(0, 2).map((r) => (
            <li key={r} className="flex items-center gap-1.5 text-[11px] text-muted">
              <Sparkles className="h-3 w-3 text-lime" /> {r}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {pool.participantCount ?? pool.participants?.length ?? 1} in
          </span>
          <span className={cx('inline-flex items-center gap-1 font-mono', urgent && isOpen && 'font-bold text-warn')}>
            <Clock className="h-3.5 w-3.5" />
            {isOpen ? formatCountdown(seconds) : pool.status === 'OPEN' ? 'Closed' : pool.status.toLowerCase()}
          </span>
        </div>
        <span className="inline-flex items-center gap-1 font-semibold text-lime transition-transform group-hover:translate-x-1">
          {isOpen ? 'Join' : 'View'} <ArrowRight className="h-3.5 w-3.5" />
        </span>
      </div>
    </Link>
  );
};
