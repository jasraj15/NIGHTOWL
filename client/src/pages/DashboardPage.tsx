import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { PlusCircle, Search, RefreshCw, Sparkles, SlidersHorizontal, X, Moon } from 'lucide-react';
import { Pool, Recommendation, OrderSummary, MyStats, RETAILERS, HOSTELS } from '../types/index.js';
import { get } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { useAsync } from '../hooks/useAsync.js';
import { useDebounce } from '../hooks/useDebounce.js';
import { getSocket, SOCKET_EVENTS } from '../services/socket.js';
import { PoolCard } from '../components/pools/PoolCard.js';
import { CardSkeleton, EmptyState, Stat, Alert, StatusBadge, PaymentBadge } from '../components/ui/Bits.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select } from '../components/ui/Field.js';
import { money, cx } from '../utils/format.js';

type HostelFilter = 'MINE' | 'ALL' | 'Uniworld 1' | 'Uniworld 2';
type QuickFilter = 'open' | 'closing' | 'almost';

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const [hostel, setHostel] = useState<HostelFilter>((params.get('hostel') as HostelFilter) || 'MINE');
  const [retailer, setRetailer] = useState(params.get('retailer') || 'ALL');
  const [quick, setQuick] = useState<QuickFilter>((params.get('quick') as QuickFilter) || 'open');
  const [search, setSearch] = useState(params.get('q') || '');
  const [minParticipants, setMinParticipants] = useState(params.get('minP') || '');
  const [maxRemaining, setMaxRemaining] = useState(params.get('maxR') || '');
  const [showAdvanced, setShowAdvanced] = useState(Boolean(params.get('minP') || params.get('maxR')));
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    const next: Record<string, string> = {};
    if (hostel !== 'MINE') next.hostel = hostel;
    if (retailer !== 'ALL') next.retailer = retailer;
    if (quick !== 'open') next.quick = quick;
    if (debouncedSearch) next.q = debouncedSearch;
    if (minParticipants) next.minP = minParticipants;
    if (maxRemaining) next.maxR = maxRemaining;
    setParams(next, { replace: true });
  }, [hostel, retailer, quick, debouncedSearch, minParticipants, maxRemaining, setParams]);

  const hostelParam = hostel === 'MINE' ? user?.hostel : hostel;

  const pools = useAsync(
    () =>
      get<{ pools: Pool[]; pagination: { total: number } }>('/pools', {
        hostel: hostelParam,
        retailer: retailer === 'ALL' ? undefined : retailer,
        status: quick === 'open' || quick === 'closing' ? 'OPEN' : 'OPEN',
        closingSoon: quick === 'closing' ? 'true' : undefined,
        maxRemaining: quick === 'almost' ? 150 : maxRemaining || undefined,
        minParticipants: minParticipants || undefined,
        search: debouncedSearch || undefined,
        sort: 'closing',
        limit: 30,
      }),
    [hostelParam, retailer, quick, debouncedSearch, minParticipants, maxRemaining]
  );
  const recommended = useAsync(() => get<{ recommendations: Recommendation[] }>('/pools/recommended'), []);
  const mine = useAsync(() => get<{ orders: OrderSummary[]; counts: Record<string, number> }>('/pools/orders/mine', { tab: 'active' }), []);
  const stats = useAsync(() => get<{ stats: MyStats }>('/users/me/stats'), []);

  // Live refresh when any pool changes anywhere (discovery room is broadcast to all sockets).
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    let t: number | undefined;
    const bump = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        void pools.refetch();
        void recommended.refetch();
        void mine.refetch();
      }, 400);
    };
    s.on(SOCKET_EVENTS.POOL_UPDATED, bump);
    s.on(SOCKET_EVENTS.POOL_STATUS_CHANGED, bump);
    return () => {
      s.off(SOCKET_EVENTS.POOL_UPDATED, bump);
      s.off(SOCKET_EVENTS.POOL_STATUS_CHANGED, bump);
      window.clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h >= 22 || h < 4) return 'Burning the midnight oil';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const activeOrders = mine.data?.orders || [];
  const poolList = pools.data?.pools || [];
  const recs = (recommended.data?.recommendations || []).filter((r) => r.pool.hostel === hostelParam || hostel === 'ALL');

  const clearFilters = () => {
    setRetailer('ALL');
    setQuick('open');
    setSearch('');
    setMinParticipants('');
    setMaxRemaining('');
  };
  const hasFilters = retailer !== 'ALL' || quick !== 'open' || search || minParticipants || maxRemaining;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      {/* Greeting + summary */}
      <section className="card night-sky relative overflow-hidden p-6 sm:p-8">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-lime">
              <Moon className="h-3.5 w-3.5" /> {user?.hostel}
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">
              {greeting}, {user?.fullName.split(' ')[0]}.
            </h1>
            <p className="mt-1 text-sm text-muted">Pool your late-night cart with students in your hostel and share the fees.</p>
          </div>
          <Link to="/pools/new" className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-lime px-5 text-sm font-bold text-lime-ink shadow-glow hover:bg-lime-soft">
            <PlusCircle className="h-5 w-5" /> Create a pool
          </Link>
        </div>
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Active orders" value={mine.loading ? '…' : activeOrders.length} to="/orders" className="bg-sun" />
          <Stat label="Pools created" value={stats.loading ? '…' : stats.data?.stats.poolsCreated ?? 0} to="/orders?tab=created" className="bg-blush" />
          <Stat label="Completed" value={stats.loading ? '…' : stats.data?.stats.poolsCompleted ?? 0} to="/orders?tab=completed" className="bg-mint" />
          <Stat
            label="Avg. time to lock"
            value={stats.loading ? '…' : stats.data?.stats.avgMinutesToLock != null ? `${stats.data.stats.avgMinutesToLock}m` : '—'}
            hint="pools you hosted"
            className="bg-sky"
          />
        </div>
      </section>

      {/* My active orders */}
      {activeOrders.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-bold text-fg">My active orders</h2>
            <Link to="/orders" className="text-xs font-semibold text-lime hover:underline">
              View all
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {activeOrders.slice(0, 6).map((o) => (
              <Link key={o._id} to={`/pools/${o._id}`} className="card w-64 shrink-0 p-4 transition-colors hover:border-lime/40">
                <div className="flex items-center justify-between gap-2">
                  <StatusBadge status={o.status} />
                  {o.isHost && <span className="text-[10px] font-bold uppercase text-faint">Host</span>}
                </div>
                <p className="mt-2 line-clamp-1 font-bold text-fg">{o.title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {o.retailer} · {o.myItemCount} item{o.myItemCount === 1 ? '' : 's'} · {money(o.myItemSubtotal)}
                </p>
                {o.myContribution && (
                  <div className="mt-2 flex items-center justify-between">
                    <span className="text-xs text-muted">Your share {money(o.myContribution.totalDue)}</span>
                    <PaymentBadge status={o.myContribution.paymentStatus} />
                  </div>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recommended */}
      {recs.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-lime" />
            <h2 className="text-lg font-bold text-fg">Recommended for you</h2>
            <span className="text-xs text-faint">based on your hostel, amount remaining and closing time</span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {recs.slice(0, 3).map((r) => (
              <PoolCard key={r.pool._id} pool={r.pool} reasons={r.reasons} highlight />
            ))}
          </div>
        </section>
      )}

      {/* Discovery */}
      <section>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <h2 className="text-lg font-bold text-fg">Open pools</h2>
          <div className="flex flex-1 items-center gap-2 lg:max-w-xl">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title, pickup spot or notes…"
              leading={<Search className="h-4 w-4" />}
              aria-label="Search pools"
              wrapClassName="flex-1"
              trailing={
                search ? (
                  <button onClick={() => setSearch('')} className="rounded-md p-1 text-faint hover:text-fg" aria-label="Clear search">
                    <X className="h-4 w-4" />
                  </button>
                ) : undefined
              }
            />
            <Button variant="secondary" size="md" onClick={() => setShowAdvanced((s) => !s)} icon={<SlidersHorizontal className="h-4 w-4" />} aria-expanded={showAdvanced}>
              <span className="hidden sm:inline">Filters</span>
            </Button>
            <Button variant="ghost" size="md" onClick={() => void pools.refetch()} aria-label="Refresh pools" icon={<RefreshCw className={cx('h-4 w-4', pools.loading && 'animate-spin')} />} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['MINE', 'ALL', ...HOSTELS] as HostelFilter[]).map((h) => (
            <button key={h} onClick={() => setHostel(h)} className={cx('chip', hostel === h ? 'border-lime bg-lime text-lime-ink' : 'border-line bg-surface text-muted hover:text-fg')}>
              {h === 'MINE' ? `My hostel (${user?.hostel === 'Uniworld 1' ? 'U1' : 'U2'})` : h === 'ALL' ? 'Both hostels' : h}
            </button>
          ))}
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          {(
            [
              ['open', 'Open now'],
              ['closing', 'Closing soon'],
              ['almost', 'Almost there (≤ ₹150)'],
            ] as [QuickFilter, string][]
          ).map(([v, label]) => (
            <button key={v} onClick={() => setQuick(v)} className={cx('chip', quick === v ? 'border-lime/60 bg-lime/10 text-lime' : 'border-line bg-surface text-muted hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>

        {showAdvanced && (
          <div className="mt-3 grid gap-3 rounded-2xl border border-line bg-surface p-4 sm:grid-cols-3">
            <Select label="Retailer" value={retailer} onChange={(e) => setRetailer(e.target.value)} options={[{ value: 'ALL', label: 'All retailers' }, ...RETAILERS.map((r) => ({ value: r, label: r }))]} />
            <Input label="Min. participants" type="number" min={0} inputMode="numeric" value={minParticipants} onChange={(e) => setMinParticipants(e.target.value)} placeholder="e.g. 2" />
            <Input label="Max. amount remaining (₹)" type="number" min={0} inputMode="numeric" value={maxRemaining} onChange={(e) => setMaxRemaining(e.target.value)} placeholder="e.g. 100" />
          </div>
        )}

        {!showAdvanced && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {['ALL', ...RETAILERS].map((r) => (
              <button key={r} onClick={() => setRetailer(r)} className={cx('chip py-1', retailer === r ? 'border-lime/60 bg-lime/10 text-lime' : 'border-line bg-surface text-muted hover:text-fg')}>
                {r === 'ALL' ? 'All retailers' : r}
              </button>
            ))}
          </div>
        )}

        <div className="mt-5">
          {pools.loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          ) : pools.error ? (
            <Alert kind="danger" title="Couldn't load pools">
              {pools.error}{' '}
              <button onClick={() => void pools.refetch()} className="font-semibold text-lime hover:underline">
                Retry
              </button>
            </Alert>
          ) : poolList.length === 0 ? (
            <EmptyState
              icon={<Moon className="h-7 w-7" />}
              title={hasFilters ? 'No pools match these filters' : 'No open pools right now'}
              description={hasFilters ? 'Try widening your filters or including both hostels.' : 'Be the first tonight — start a pool and your hostel will see it instantly.'}
              action={
                <div className="flex gap-2">
                  {hasFilters && (
                    <Button variant="secondary" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  )}
                  <Link to="/pools/new" className="inline-flex h-11 items-center gap-2 rounded-xl bg-lime px-4 text-sm font-bold text-lime-ink shadow-glow">
                    <PlusCircle className="h-4 w-4" /> Create a pool
                  </Link>
                </div>
              }
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {poolList.map((p) => (
                <PoolCard key={p._id} pool={p} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
