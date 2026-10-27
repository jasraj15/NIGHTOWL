import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ClipboardList, Copy, ArrowRight, Users } from 'lucide-react';
import { OrderSummary, userName } from '../types/index.js';
import { get } from '../services/api.js';
import { useAsync } from '../hooks/useAsync.js';
import { Tabs, StatusBadge, RetailerBadge, HostelBadge, PaymentBadge, EmptyState, Skeleton, Alert, PageHeader } from '../components/ui/Bits.js';
import { money, formatDateTime } from '../utils/format.js';

type Tab = 'active' | 'created' | 'joined' | 'completed' | 'cancelled' | 'all';
const TABS: { value: Tab; label: string }[] = [
  { value: 'active', label: 'Active' },
  { value: 'created', label: 'Created by me' },
  { value: 'joined', label: 'Joined by me' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'all', label: 'All orders' },
];

export const OrdersPage: React.FC = () => {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab) || 'active';
  const data = useAsync(() => get<{ orders: OrderSummary[]; counts: Record<Tab, number> }>('/pools/orders/mine', { tab }), [tab]);

  const orders = data.data?.orders || [];
  const counts = data.data?.counts;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Orders" title="My orders" description="Every pool you've hosted or joined, with your items, your share of the fees and your payment status." />
      <Tabs tabs={TABS.map((t) => ({ ...t, count: counts?.[t.value] }))} value={tab} onChange={(v) => setParams({ tab: v })} />

      {data.loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : data.error ? (
        <Alert kind="danger" title="Couldn't load your orders">
          {data.error}
        </Alert>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-7 w-7" />}
          title={tab === 'active' ? 'No active orders' : 'Nothing here yet'}
          description={tab === 'active' ? 'Join an open pool or start one — it will show up here.' : 'Orders matching this tab will appear here.'}
          action={
            <Link to="/dashboard" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-lime-ink shadow-glow">
              Discover pools <ArrowRight className="h-4 w-4" />
            </Link>
          }
        />
      ) : (
        <ul className="space-y-3">
          {orders.map((o) => (
            <li key={o._id} className="card p-4 sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <RetailerBadge retailer={o.retailer} customName={o.retailerCustomName} />
                    <HostelBadge hostel={o.hostel} />
                    <StatusBadge status={o.status} />
                    {o.isHost && <span className="rounded-md bg-lime/10 px-2 py-0.5 text-[10px] font-bold uppercase text-lime">Host</span>}
                  </div>
                  <Link to={`/pools/${o._id}`} className="mt-2 block text-lg font-bold text-fg hover:text-lime">
                    {o.title}
                  </Link>
                  <p className="mt-0.5 text-xs text-muted">
                    {formatDateTime(o.createdAt)} · {o.deliveryZone} · host {userName(o.creator).split(' ')[0]} ·{' '}
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3 w-3" /> {o.participantCount}
                    </span>
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-faint">My items</dt>
                      <dd className="font-mono text-fg">
                        {o.myItemCount} · {money(o.myItemSubtotal)}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-faint">Shared fees</dt>
                      <dd className="font-mono text-fg">{o.myContribution ? money(o.myContribution.allocatedFee) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-faint">My share</dt>
                      <dd className="font-mono font-bold text-fg">{o.myContribution ? money(o.myContribution.totalDue) : '—'}</dd>
                    </div>
                    <div>
                      <dt className="text-[11px] uppercase tracking-wide text-faint">Cart total</dt>
                      <dd className="font-mono text-fg">
                        {money(o.finalPayableAmount ?? o.currentSubtotal)}
                        {o.finalPayableAmount ? '' : <span className="text-faint"> / {money(o.targetAmount)}</span>}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                  {o.myContribution && !o.isHost ? <PaymentBadge status={o.myContribution.paymentStatus} /> : <span className="text-xs text-faint">{o.isHost ? 'You collect payments' : 'No payment yet'}</span>}
                  <div className="flex gap-2">
                    <Link to={`/pools/${o._id}`} className="inline-flex h-9 items-center gap-1 rounded-lg border border-line px-3 text-xs font-semibold text-fg hover:bg-overlay">
                      Details <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                    {['DELIVERED', 'CANCELLED', 'EXPIRED'].includes(o.status) && (
                      <Link to={`/pools/new?duplicate=${o._id}`} className="inline-flex h-9 items-center gap-1 rounded-lg bg-overlay px-3 text-xs font-semibold text-fg hover:bg-line-strong/40" title="Start a new pool with these items">
                        <Copy className="h-3.5 w-3.5" /> Order again
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
