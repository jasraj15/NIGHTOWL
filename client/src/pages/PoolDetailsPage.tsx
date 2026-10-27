import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import confetti from 'canvas-confetti';
import { ArrowLeft, Users, Clock, MapPin, Lock, Package, CheckCircle2, Plus, UserPlus, LogOut, Flag, Unlock, XCircle, Copy as CopyIcon, Phone, Info, RotateCcw } from 'lucide-react';
import { Pool, PoolItem, PaymentRecord, PaymentConfig, PoolDetailResponse, userId, userName, retailerLabel, PublicUser } from '../types/index.js';
import { get, post, patch, del, errorMessage } from '../services/api.js';
import { joinPoolRoom, leavePoolRoom, getSocket, SOCKET_EVENTS } from '../services/socket.js';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { useAsync } from '../hooks/useAsync.js';
import { useCountdown } from '../hooks/useCountdown.js';
import { StatusBadge, RetailerBadge, HostelBadge, Progress, Avatar, Alert, Skeleton } from '../components/ui/Bits.js';
import { Button } from '../components/ui/Button.js';
import { Modal, ConfirmDialog } from '../components/ui/Modal.js';
import { Checkbox } from '../components/ui/Field.js';
import { CartItemList } from '../components/cart/CartItemList.js';
import { ItemModal } from '../components/cart/ItemModal.js';
import { LockPoolModal, OrderPlacedModal, ExtendPoolModal, ReportModal } from '../components/pools/HostModals.js';
import { PaymentSection } from '../components/payment/PaymentSection.js';
import { ActivityTimeline } from '../components/audit/ActivityTimeline.js';
import { money, formatCountdown, formatDateTime, cx } from '../utils/format.js';

const PRM = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export const PoolDetailsPage: React.FC = () => {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const detail = useAsync(() => get<PoolDetailResponse>(`/pools/${id}`), [id]);
  const paymentConfig = useAsync(() => get<{ config: PaymentConfig }>('/payments/config'), []);

  const [pool, setPool] = useState<Pool | null>(null);
  const [items, setItems] = useState<PoolItem[]>([]);
  const [records, setRecords] = useState<PaymentRecord[]>([]);
  const [serverTime, setServerTime] = useState<string | undefined>();

  useEffect(() => {
    if (!detail.data) return;
    setPool(detail.data.pool);
    setItems(detail.data.items);
    setRecords(detail.data.paymentRecords);
    setServerTime(detail.data.countdown.serverTime);
  }, [detail.data]);

  const refetchDetail = detail.refetch; // stable reference
  const refetch = useCallback(() => {
    void refetchDetail();
  }, [refetchDetail]);

  // ---- modals / dialogs
  const [itemModal, setItemModal] = useState<{ open: boolean; item: PoolItem | null }>({ open: false, item: null });
  const [deleteItem, setDeleteItem] = useState<PoolItem | null>(null);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinConfirmed, setJoinConfirmed] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [lockOpen, setLockOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [extendOpen, setExtendOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | 'reopen' | 'deliver' | 'cancel'>(null);
  const [busy, setBusy] = useState(false);

  // ---- live updates
  useEffect(() => {
    if (!id) return;
    let active = true;
    void joinPoolRoom(id);
    const s = getSocket();
    if (!s) return;

    const applyTotals = (d: any) =>
      setPool((p) => (p ? { ...p, currentSubtotal: d.currentSubtotal ?? p.currentSubtotal, remainingAmount: d.remainingAmount ?? p.remainingAmount, progressPercent: d.progressPercent ?? p.progressPercent } : p));
    const onAdded = (d: any) => {
      if (d.poolId !== id || !active) return;
      setItems((prev) => [d.item, ...prev.filter((i) => i._id !== d.item._id)]);
      applyTotals(d);
    };
    const onUpdated = (d: any) => {
      if (d.poolId !== id) return;
      setItems((prev) => prev.map((i) => (i._id === d.item._id ? d.item : i)));
      applyTotals(d);
    };
    const onRemoved = (d: any) => {
      if (d.poolId !== id) return;
      setItems((prev) => prev.filter((i) => i._id !== d.itemId));
      applyTotals(d);
    };
    const onMembership = () => refetch();
    const onStatus = (d: any) => {
      if (d.poolId !== id) return;
      if ((d.status === 'ORDERED' || d.status === 'DELIVERED') && !PRM()) confetti({ particleCount: 90, spread: 70, origin: { y: 0.6 } });
      refetch();
    };
    const onPayment = (d: any) => {
      if (d.poolId === id) refetch();
    };
    const onReconnect = () => {
      void joinPoolRoom(id);
      refetch();
    };

    s.on(SOCKET_EVENTS.ITEM_ADDED, onAdded);
    s.on(SOCKET_EVENTS.ITEM_UPDATED, onUpdated);
    s.on(SOCKET_EVENTS.ITEM_REMOVED, onRemoved);
    s.on(SOCKET_EVENTS.PARTICIPANT_JOINED, onMembership);
    s.on(SOCKET_EVENTS.PARTICIPANT_LEFT, onMembership);
    s.on(SOCKET_EVENTS.POOL_STATUS_CHANGED, onStatus);
    s.on(SOCKET_EVENTS.POOL_EXPIRED, onStatus);
    s.on(SOCKET_EVENTS.POOL_UPDATED, onMembership);
    s.on(SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, onPayment);
    s.on(SOCKET_EVENTS.PAYMENT_RECORD_UPDATED, onPayment);
    s.on('connect', onReconnect);
    return () => {
      active = false;
      leavePoolRoom(id);
      s.off(SOCKET_EVENTS.ITEM_ADDED, onAdded);
      s.off(SOCKET_EVENTS.ITEM_UPDATED, onUpdated);
      s.off(SOCKET_EVENTS.ITEM_REMOVED, onRemoved);
      s.off(SOCKET_EVENTS.PARTICIPANT_JOINED, onMembership);
      s.off(SOCKET_EVENTS.PARTICIPANT_LEFT, onMembership);
      s.off(SOCKET_EVENTS.POOL_STATUS_CHANGED, onStatus);
      s.off(SOCKET_EVENTS.POOL_EXPIRED, onStatus);
      s.off(SOCKET_EVENTS.POOL_UPDATED, onMembership);
      s.off(SOCKET_EVENTS.PAYMENT_STATUS_CHANGED, onPayment);
      s.off(SOCKET_EVENTS.PAYMENT_RECORD_UPDATED, onPayment);
      s.off('connect', onReconnect);
    };
  }, [id, refetch]);

  const { seconds, urgent, expired } = useCountdown(pool?.closingTime, serverTime);
  // When the countdown hits zero, ask the server (it is the authority on expiry).
  useEffect(() => {
    if (expired && pool?.status === 'OPEN') {
      const t = setTimeout(refetch, 1200);
      return () => clearTimeout(t);
    }
  }, [expired, pool?.status, refetch]);

  const viewer = detail.data?.viewer || { isHost: false, isParticipant: false };
  const isHost = viewer.isHost;
  const isMember = viewer.isParticipant;
  const isOpen = pool?.status === 'OPEN' && !expired;
  const canEditCart = Boolean(isOpen && isMember);
  const myItems = useMemo(() => items.filter((i) => userId(i.userId) === user?._id), [items, user?._id]);
  const mySubtotal = myItems.reduce((s, i) => s + i.itemSubtotal, 0);
  const participants = useMemo(() => (pool?.participants || []).filter((p): p is PublicUser => typeof p === 'object'), [pool]);
  const creator = pool && typeof pool.creator === 'object' ? pool.creator : null;

  const run = async (fn: () => Promise<void>, successMsg?: string) => {
    setBusy(true);
    try {
      await fn();
      if (successMsg) toast.success(successMsg);
      refetch();
    } catch (err) {
      toast.error('Action failed', errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const join = () =>
    run(async () => {
      await post(`/pools/${id}/join`, { deliveryConfirmed: true });
      setJoinOpen(false);
      setJoinConfirmed(false);
    }, 'You joined the pool — add your items');

  const leave = () =>
    run(async () => {
      await post(`/pools/${id}/leave`);
      setLeaveOpen(false);
    }, 'You left the pool');

  const saveItem = async (data: { name: string; quantity: number; unitPrice: number; note?: string }) => {
    if (itemModal.item) await patch(`/pools/${id}/items/${itemModal.item._id}`, data);
    else await post(`/pools/${id}/items`, data);
    toast.success(itemModal.item ? 'Item updated' : 'Item added');
    refetch();
  };

  const removeItem = () =>
    run(async () => {
      if (!deleteItem) return;
      await del(`/pools/${id}/items/${deleteItem._id}`);
      setDeleteItem(null);
    }, 'Item removed');

  const transition = (path: string, msg: string) =>
    run(async () => {
      await post(`/pools/${id}/${path}`);
      setConfirm(null);
      if (path === 'deliver' && !PRM()) confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
    }, msg);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied', 'Share it with your floor.');
    } catch {
      toast.error('Could not copy link');
    }
  };

  /* ------------------------------ render ------------------------------ */

  if (detail.loading && !pool) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:px-6 lg:px-8" aria-busy>
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-40 w-full" />
        <div className="grid gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 lg:col-span-2" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  if (detail.error || !pool) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Alert kind="danger" title="Couldn't open this pool">
          {detail.error || 'Pool not found.'}
        </Alert>
        <Link to="/dashboard" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-lime">
          <ArrowLeft className="h-4 w-4" /> Back to discover
        </Link>
      </div>
    );
  }

  const effectiveStatus = expired && pool.status === 'OPEN' ? 'EXPIRED' : pool.status;
  const full = pool.participantCount >= pool.participantLimit;

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => void copyLink()} icon={<CopyIcon className="h-3.5 w-3.5" />}>
            Share
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setReportOpen(true)} icon={<Flag className="h-3.5 w-3.5" />} aria-label="Report this pool">
            <span className="hidden sm:inline">Report</span>
          </Button>
        </div>
      </div>

      {/* Header card */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <RetailerBadge retailer={pool.retailer} customName={pool.retailerCustomName} />
          <HostelBadge hostel={pool.hostel} />
          <StatusBadge status={effectiveStatus} />
          {isHost && <span className="rounded-md bg-lime/10 px-2 py-0.5 text-[11px] font-bold uppercase text-lime">You host this</span>}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-fg sm:text-3xl">{pool.title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-lime" /> {pool.deliveryZone}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4 text-lime" /> {pool.participantCount}/{pool.participantLimit} students
          </span>
          <span className={cx('inline-flex items-center gap-1.5 font-mono', urgent && isOpen && 'font-bold text-warn')}>
            <Clock className="h-4 w-4 text-lime" />
            {isOpen ? `closes in ${formatCountdown(seconds)}` : pool.status === 'OPEN' ? 'closed' : `${pool.status.toLowerCase()} · ${formatDateTime(pool.lockedAt || pool.orderPlacedAt || pool.deliveredAt || pool.cancelledAt || pool.updatedAt)}`}
          </span>
        </div>
        {pool.notes && <p className="mt-3 rounded-xl border border-line bg-surface p-3 text-sm text-muted">{pool.notes}</p>}

        <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="flex items-end justify-between">
              <p className="text-sm text-muted">
                Cart total <span className="ml-1 text-2xl font-extrabold text-fg">{money(pool.currentSubtotal)}</span>
                <span className="text-faint"> / {money(pool.targetAmount)}</span>
              </p>
              <p className={cx('text-sm font-semibold', pool.remainingAmount <= 0 ? 'text-lime' : 'text-warn')}>
                {pool.remainingAmount <= 0 ? 'Minimum reached' : `${money(pool.remainingAmount)} to go`}
              </p>
            </div>
            <Progress value={pool.progressPercent} className="mt-2 h-3" label="Progress toward minimum order" />
            {pool.contributionCap && <p className="mt-1.5 text-xs text-faint">Per-person cap {money(pool.contributionCap)}</p>}
          </div>

          {/* Primary action */}
          <div className="flex flex-col gap-2 sm:min-w-[220px]">
            {!isMember && isOpen && !full && (
              <Button size="lg" onClick={() => setJoinOpen(true)} icon={<UserPlus className="h-4 w-4" />}>
                Join this pool
              </Button>
            )}
            {!isMember && isOpen && full && <Alert kind="warn">This pool is full.</Alert>}
            {canEditCart && (
              <Button size="lg" onClick={() => setItemModal({ open: true, item: null })} icon={<Plus className="h-4 w-4" />}>
                Add item
              </Button>
            )}
            {isHost && isOpen && (
              <Button size="lg" variant="secondary" onClick={() => setLockOpen(true)} icon={<Lock className="h-4 w-4" />} disabled={items.length === 0}>
                Lock cart
              </Button>
            )}
            {isHost && pool.status === 'LOCKED' && (
              <Button size="lg" onClick={() => setOrderOpen(true)} icon={<Package className="h-4 w-4" />}>
                I placed the order
              </Button>
            )}
            {isHost && pool.status === 'ORDERED' && (
              <Button size="lg" onClick={() => setConfirm('deliver')} icon={<CheckCircle2 className="h-4 w-4" />}>
                Mark delivered
              </Button>
            )}
          </div>
        </div>

        {/* Host secondary controls */}
        {isHost && ['OPEN', 'LOCKED', 'EXPIRED', 'ORDERED'].includes(effectiveStatus) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            {(effectiveStatus === 'OPEN' || effectiveStatus === 'EXPIRED') && (pool.extensionCount || 0) < 3 && (
              <Button size="sm" variant="outline" onClick={() => setExtendOpen(true)} icon={<Clock className="h-3.5 w-3.5" />}>
                {effectiveStatus === 'EXPIRED' ? 'Extend & reopen' : 'Extend deadline'}
              </Button>
            )}
            {pool.status === 'LOCKED' && (
              <Button size="sm" variant="outline" onClick={() => setConfirm('reopen')} icon={<Unlock className="h-3.5 w-3.5" />}>
                Reopen cart
              </Button>
            )}
            <Button size="sm" variant="danger" onClick={() => setConfirm('cancel')} icon={<XCircle className="h-3.5 w-3.5" />}>
              Cancel pool
            </Button>
          </div>
        )}
        {effectiveStatus === 'EXPIRED' && isHost && (
          <Alert kind="warn" className="mt-4" title="The countdown ran out before locking">
            The cart stayed {money(pool.remainingAmount)} short. Extend it to let more people join, cancel it, or — if you've checked the retailer's real minimum — extend and then lock with confirmation.
          </Alert>
        )}
        {!isMember && !isOpen && pool.status !== 'DELIVERED' && <p className="mt-4 text-sm text-muted">This pool is no longer accepting participants.</p>}
        {isMember && !isHost && isOpen && (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-line pt-4 text-xs text-muted">
            <span>
              You've added {myItems.length} item{myItems.length === 1 ? '' : 's'} · {money(mySubtotal)}
            </span>
            <button onClick={() => setLeaveOpen(true)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
              <LogOut className="h-3.5 w-3.5" /> Leave pool
            </button>
          </div>
        )}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Cart */}
          <section className="card p-5" aria-labelledby="cart-heading">
            <div className="mb-4 flex items-center justify-between">
              <h2 id="cart-heading" className="text-base font-bold text-fg">
                Shared cart <span className="ml-1 text-xs font-medium text-faint">{items.length} item{items.length === 1 ? '' : 's'} · live</span>
              </h2>
              {canEditCart && (
                <Button size="sm" variant="secondary" onClick={() => setItemModal({ open: true, item: null })} icon={<Plus className="h-3.5 w-3.5" />}>
                  Add item
                </Button>
              )}
            </div>
            {!isOpen && items.length > 0 && (
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted">
                <Lock className="h-3.5 w-3.5" /> Cart is {effectiveStatus.toLowerCase()} — items can't be changed.
              </p>
            )}
            <CartItemList items={items} currentUserId={user?._id || ''} isHost={isHost} editable={canEditCart} onEdit={(it) => setItemModal({ open: true, item: it })} onDelete={setDeleteItem} />
          </section>

          {/* Payments */}
          {(isMember || isHost) && (
            <PaymentSection
              pool={pool}
              records={records}
              breakdown={detail.data?.costBreakdown || null}
              config={paymentConfig.data?.config || null}
              viewer={{ isHost, isParticipant: isMember, userId: user?._id || '' }}
              outstandingBalance={detail.data?.outstandingBalance || 0}
              onChanged={refetch}
            />
          )}
        </div>

        <aside className="space-y-5">
          {/* Host */}
          <section className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">Host</p>
            <div className="mt-2 flex items-center gap-3">
              <Avatar name={userName(pool.creator)} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-fg">{userName(pool.creator)}</p>
                <p className="truncate text-xs text-muted">{creator?.hostel}{creator?.roomNumber ? ` · ${creator.roomNumber}` : ''}</p>
              </div>
            </div>
            {creator?.phoneNumber && (
              <a href={`tel:${creator.phoneNumber}`} className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-lime hover:underline">
                <Phone className="h-4 w-4" /> {creator.phoneNumber}
              </a>
            )}
          </section>

          {/* Participants */}
          <section className="card p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-faint">
              Participants · {pool.participantCount}/{pool.participantLimit}
            </p>
            <ul className="mt-3 space-y-2">
              {participants.map((p) => {
                const sub = items.filter((i) => userId(i.userId) === p._id).reduce((s, i) => s + i.itemSubtotal, 0);
                return (
                  <li key={p._id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar name={p.fullName} size="sm" />
                      <span className="truncate text-fg">{p._id === user?._id ? 'You' : p.fullName}</span>
                      {p._id === userId(pool.creator) && <span className="text-[10px] font-bold uppercase text-faint">host</span>}
                    </span>
                    <span className="font-mono text-xs text-muted">{money(sub)}</span>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Order facts after ordering */}
          {(pool.status === 'ORDERED' || pool.status === 'DELIVERED') && (
            <section className="card p-5 text-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-faint">Retailer order</p>
              <dl className="mt-2 space-y-1.5">
                <div className="flex justify-between">
                  <dt className="text-muted">Placed</dt>
                  <dd className="text-fg">{formatDateTime(pool.orderPlacedAt)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Final bill</dt>
                  <dd className="font-mono font-bold text-fg">{money(pool.finalPayableAmount)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery fee</dt>
                  <dd className="font-mono text-fg">{money(pool.deliveryFee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Other charges</dt>
                  <dd className="font-mono text-fg">{money(pool.otherCharges)}</dd>
                </div>
                {pool.deliveredAt && (
                  <div className="flex justify-between">
                    <dt className="text-muted">Delivered</dt>
                    <dd className="text-fg">{formatDateTime(pool.deliveredAt)}</dd>
                  </div>
                )}
              </dl>
            </section>
          )}

          <ActivityTimeline events={detail.data?.auditEvents || []} />

          <p className="flex items-start gap-1.5 px-1 text-[11px] text-faint">
            <Info className="mt-0.5 h-3 w-3 shrink-0" /> NightOwl doesn't place orders with {retailerLabel(pool)}. The host orders in the retailer app and records the real bill here.
          </p>
        </aside>
      </div>

      {/* ---------------- dialogs ---------------- */}
      <ItemModal
        open={itemModal.open}
        onClose={() => setItemModal({ open: false, item: null })}
        onSubmit={saveItem}
        item={itemModal.item}
        contributionCap={pool.contributionCap}
        mySubtotalExcludingThis={mySubtotal - (itemModal.item?.itemSubtotal || 0)}
      />
      <ConfirmDialog
        open={Boolean(deleteItem)}
        onClose={() => setDeleteItem(null)}
        onConfirm={removeItem}
        loading={busy}
        danger
        title="Remove this item?"
        confirmLabel="Remove"
        description={deleteItem ? `${deleteItem.name} × ${deleteItem.quantity} (${money(deleteItem.itemSubtotal)}) will be removed from the shared cart.` : ''}
      />
      <Modal
        open={joinOpen}
        onClose={() => setJoinOpen(false)}
        title="Join this pool"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void join()} loading={busy} disabled={!joinConfirmed} icon={<UserPlus className="h-4 w-4" />}>
              Join pool
            </Button>
          </>
        }
      >
        <div className="space-y-4 text-sm text-muted">
          <div className="rounded-xl border border-line bg-surface p-3">
            <p className="font-semibold text-fg">{pool.deliveryZone}</p>
            <p className="text-xs">
              {pool.hostel} · {retailerLabel(pool)} · closes in {formatCountdown(seconds)}
            </p>
          </div>
          {user?.hostel !== pool.hostel && <Alert kind="warn">This pool delivers to {pool.hostel}, not your default hostel. Only join if you can collect there.</Alert>}
          <Checkbox checked={joinConfirmed} onChange={(e) => setJoinConfirmed(e.target.checked)} label={<>I can collect my items from this location and will pay my share once the host records the order.</>} />
        </div>
      </Modal>
      <ConfirmDialog open={leaveOpen} onClose={() => setLeaveOpen(false)} onConfirm={leave} loading={busy} danger title="Leave this pool?" confirmLabel="Leave" description="Your items will be removed from the shared cart." />
      <LockPoolModal open={lockOpen} onClose={() => setLockOpen(false)} pool={pool} items={items} onDone={() => { toast.success('Cart locked'); refetch(); }} />
      <OrderPlacedModal open={orderOpen} onClose={() => setOrderOpen(false)} pool={pool} onDone={() => { toast.success('Order recorded — participants can pay their share'); refetch(); }} />
      <ExtendPoolModal open={extendOpen} onClose={() => setExtendOpen(false)} pool={pool} onDone={() => { toast.success('Deadline extended'); refetch(); }} />
      <ReportModal open={reportOpen} onClose={() => setReportOpen(false)} pool={pool} participants={participants.filter((p) => p._id !== user?._id)} onDone={() => toast.success('Report submitted', 'A moderator will review it.')} />
      <ConfirmDialog
        open={confirm === 'reopen'}
        onClose={() => setConfirm(null)}
        onConfirm={() => transition('reopen', 'Cart reopened')}
        loading={busy}
        title="Reopen the cart?"
        confirmLabel="Reopen"
        description={
          <span className="inline-flex items-start gap-1.5">
            <RotateCcw className="mt-0.5 h-4 w-4 shrink-0" /> Participants can edit items again and the deadline is pushed out by at least 15 minutes. Only possible before any payment starts.
          </span>
        }
      />
      <ConfirmDialog
        open={confirm === 'deliver'}
        onClose={() => setConfirm(null)}
        onConfirm={() => transition('deliver', 'Marked as delivered')}
        loading={busy}
        title="Mark this order as delivered?"
        confirmLabel="Yes, it's here"
        description="Participants are notified to collect their items. Unpaid shares can still be paid afterwards."
      />
      <ConfirmDialog
        open={confirm === 'cancel'}
        onClose={() => setConfirm(null)}
        onConfirm={() => transition('cancel', 'Pool cancelled')}
        loading={busy}
        danger
        title="Cancel this pool?"
        confirmLabel="Cancel pool"
        description="Everyone is notified and the cart is closed for good. Pools with verified payments can't be cancelled."
      />
    </div>
  );
};
