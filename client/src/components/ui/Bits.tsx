import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Inbox } from 'lucide-react';
import { HostelType, PaymentStatus, PoolStatus, RetailerType } from '../../types/index.js';
import { cx, initials } from '../../utils/format.js';

/* ----------------------------- Badges ----------------------------- */

const statusStyles: Record<PoolStatus, string> = {
  OPEN: 'bg-mint text-fg border-transparent',
  LOCKED: 'bg-sun text-fg border-transparent',
  ORDERED: 'bg-sky text-fg border-transparent',
  DELIVERED: 'bg-mint text-fg border-transparent',
  CANCELLED: 'bg-blush text-fg border-transparent',
  EXPIRED: 'bg-overlay text-muted border-transparent',
};
const statusLabels: Record<PoolStatus, string> = {
  OPEN: 'Open',
  LOCKED: 'Locked',
  ORDERED: 'Order placed',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  EXPIRED: 'Expired',
};

export const StatusBadge: React.FC<{ status: PoolStatus; className?: string }> = ({ status, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide', statusStyles[status], className)}>
    {status === 'OPEN' && <span className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" aria-hidden />}
    {statusLabels[status]}
  </span>
);

const retailerStyles: Record<RetailerType, string> = {
  Blinkit: 'bg-sun text-fg border-transparent',
  Zepto: 'bg-pop/20 text-fg border-transparent',
  'Swiggy Instamart': 'bg-blush text-fg border-transparent',
  'Flipkart Minutes': 'bg-sky text-fg border-transparent',
  'Amazon Now': 'bg-sun text-fg border-transparent',
  'BigBasket Now': 'bg-mint text-fg border-transparent',
  Other: 'bg-overlay text-muted border-transparent',
};

export const RetailerBadge: React.FC<{ retailer: RetailerType; customName?: string; className?: string }> = ({ retailer, customName, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold', retailerStyles[retailer], className)}>
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />
    {retailer === 'Other' && customName ? customName : retailer}
  </span>
);

export const HostelBadge: React.FC<{ hostel: HostelType; className?: string }> = ({ hostel, className }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-md border border-line bg-overlay px-2 py-0.5 text-xs font-medium text-fg', className)}>
    {hostel === 'Uniworld 1' ? 'U1' : 'U2'} · {hostel}
  </span>
);

const payStyles: Record<PaymentStatus, string> = {
  PENDING: 'bg-sun text-fg border-transparent',
  PROCESSING: 'bg-sky text-fg border-transparent',
  PAID: 'bg-mint text-fg border-transparent',
  FAILED: 'bg-blush text-danger border-transparent',
  REFUND_PENDING: 'bg-overlay text-muted border-transparent',
  REFUNDED: 'bg-overlay text-muted border-transparent',
};
export const payLabels: Record<PaymentStatus, string> = {
  PENDING: 'Payment pending',
  PROCESSING: 'Processing',
  PAID: 'Paid',
  FAILED: 'Failed',
  REFUND_PENDING: 'Refund pending',
  REFUNDED: 'Refunded',
};

export const PaymentBadge: React.FC<{ status: PaymentStatus; className?: string }> = ({ status, className }) => (
  <span className={cx('inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-bold', payStyles[status], className)}>{payLabels[status]}</span>
);

/* ----------------------------- Avatar ----------------------------- */

export const Avatar: React.FC<{ name: string; size?: 'sm' | 'md' | 'lg'; className?: string }> = ({ name, size = 'md', className }) => {
  const sizes = { sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' };
  return (
    <span
      className={cx('inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-overlay font-bold text-lime', sizes[size], className)}
      aria-hidden
    >
      {initials(name) || '?'}
    </span>
  );
};

/* --------------------------- Progress bar -------------------------- */

export const Progress: React.FC<{ value: number; className?: string; label?: string }> = ({ value, className, label }) => {
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      className={cx('h-2 w-full overflow-hidden rounded-full border border-line bg-canvas', className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label || 'Progress'}
    >
      <div className={cx('h-full rounded-full transition-all duration-500', v >= 100 ? 'bg-gradient-to-r from-lime to-ok shadow-glow' : 'bg-lime')} style={{ width: `${v}%` }} />
    </div>
  );
};

/* ------------------------------ Skeleton ------------------------------ */

export const Skeleton: React.FC<{ className?: string }> = ({ className }) => <div className={cx('skeleton', className)} aria-hidden />;

export const CardSkeleton: React.FC = () => (
  <div className="card p-5">
    <div className="flex justify-between">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-5 w-16" />
    </div>
    <Skeleton className="mt-4 h-6 w-3/4" />
    <Skeleton className="mt-2 h-4 w-1/2" />
    <Skeleton className="mt-5 h-16 w-full" />
    <div className="mt-4 flex justify-between">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-4 w-16" />
    </div>
  </div>
);

/* ----------------------------- Empty state ----------------------------- */

export const EmptyState: React.FC<{ icon?: React.ReactNode; title: string; description?: string; action?: React.ReactNode; className?: string }> = ({
  icon,
  title,
  description,
  action,
  className,
}) => (
  <div className={cx('rounded-3xl border border-dashed border-line-strong/50 bg-surface/40 px-6 py-14 text-center', className)}>
    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-overlay text-lime">{icon || <Inbox className="h-7 w-7" />}</div>
    <h3 className="text-lg font-bold text-fg">{title}</h3>
    {description && <p className="mx-auto mt-1 max-w-md text-sm text-muted">{description}</p>}
    {action && <div className="mt-6 flex justify-center">{action}</div>}
  </div>
);

/* ------------------------------- Alert ------------------------------- */

export const Alert: React.FC<{ kind?: 'info' | 'warn' | 'danger' | 'success'; title?: string; children?: React.ReactNode; className?: string }> = ({
  kind = 'info',
  title,
  children,
  className,
}) => {
  const styles = {
    info: 'border-info/30 bg-info/10 text-fg',
    warn: 'border-warn/30 bg-warn/10 text-fg',
    danger: 'border-danger/30 bg-danger/10 text-fg',
    success: 'border-lime/30 bg-lime/10 text-fg',
  };
  return (
    <div role={kind === 'danger' ? 'alert' : 'status'} className={cx('flex gap-3 rounded-xl border p-3.5 text-sm', styles[kind], className)}>
      {kind !== 'success' && <AlertTriangle className={cx('mt-0.5 h-4 w-4 shrink-0', kind === 'danger' ? 'text-danger' : kind === 'warn' ? 'text-warn' : 'text-info')} aria-hidden />}
      <div className="min-w-0">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cx('text-muted', title && 'mt-0.5')}>{children}</div>}
      </div>
    </div>
  );
};

/* -------------------------------- Tabs -------------------------------- */

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Tabs<T extends string>({ tabs, value, onChange, className }: { tabs: TabItem<T>[]; value: T; onChange: (v: T) => void; className?: string }) {
  return (
    <div role="tablist" className={cx('flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1', className)}>
      {tabs.map((t) => (
        <button
          key={t.value}
          role="tab"
          aria-selected={value === t.value}
          onClick={() => onChange(t.value)}
          className={cx(
            'flex shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors sm:text-sm',
            value === t.value ? 'bg-lime text-lime-ink' : 'text-muted hover:bg-overlay hover:text-fg'
          )}
        >
          {t.label}
          {typeof t.count === 'number' && (
            <span className={cx('rounded-full px-1.5 text-[10px]', value === t.value ? 'bg-lime-ink/15' : 'bg-overlay')}>{t.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/* ----------------------------- Stat tile ----------------------------- */

export const Stat: React.FC<{ label: string; value: React.ReactNode; hint?: string; to?: string; className?: string }> = ({ label, value, hint, to, className }) => {
  const inner = (
    <>
      <p className="text-[11px] font-bold uppercase tracking-wider text-faint">{label}</p>
      <p className="mt-1 text-2xl font-extrabold text-fg">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className={cx('card block border-transparent p-4 transition-transform hover:-translate-y-0.5', className)}>
      {inner}
    </Link>
  ) : (
    <div className={cx('card border-transparent p-4', className)}>{inner}</div>
  );
};

export const PageHeader: React.FC<{ eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }> = ({ eyebrow, title, description, actions }) => (
  <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div>
      {eyebrow && <p className="text-xs font-bold uppercase tracking-wider text-lime">{eyebrow}</p>}
      <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </div>
);
