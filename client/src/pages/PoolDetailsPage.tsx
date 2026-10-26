import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  ArrowLeft,
  Users,
  Clock,
  MapPin,
  Lock,
  Package,
  CheckCircle2,
  Plus,
  UserPlus,
  LogOut,
  Sparkles,
} from 'lucide-react';
import {
  Pool,
  PoolItem,
  PaymentRecord,
  CostSplitBreakdown,
  AuditEvent,
} from '../types/index.js';
import { apiFetch } from '../services/api.js';
import { useAuth } from '../context/AuthContext.js';
import { getSocket } from '../services/socket.js';

import { StatusBadge, RetailerBadge, HostelBadge } from '../components/common/Badge.js';
import { CartItemList } from '../components/cart/CartItemList.js';
import { AddItemModal } from '../components/cart/AddItemModal.js';
import { LockPoolModal } from '../components/pools/LockPoolModal.js';
import { OrderPlacedModal } from '../components/pools/OrderPlacedModal.js';
import { PaymentSection } from '../components/payment/PaymentSection.js';
import { AuditTimeline } from '../components/audit/AuditTimeline.js';

export const PoolDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [pool, setPool] = useState<Pool | null>(null);
  const [items, setItems] = useState<PoolItem[]>([]);
  const [paymentRecords, setPaymentRecords] = useState<PaymentRecord[]>([]);
  const [costBreakdown, setCostBreakdown] = useState<CostSplitBreakdown | null>(null);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [orderPlacedOpen, setOrderPlacedOpen] = useState(false);

  // Action loaders
  const [actionLoading, setActionLoading] = useState(false);

  const fetchPoolData = async () => {
    if (!id) return;
    try {
      const res = await apiFetch<{
        success: boolean;
        pool: Pool;
        items: PoolItem[];
        paymentRecords: PaymentRecord[];
        costBreakdown: CostSplitBreakdown;
        auditEvents: AuditEvent[];
      }>(`/api/pools/${id}`);

      if (res.success) {
        setPool(res.pool);
        setItems(res.items || []);
        setPaymentRecords(res.paymentRecords || []);
        setCostBreakdown(res.costBreakdown || null);
        setAuditEvents(res.auditEvents || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load order pool');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPoolData();
  }, [id]);

  // Socket.IO Room Integration
  useEffect(() => {
    if (!id) return;
    const socket = getSocket();

    // Join room
    socket.emit('pool:join_room', id);

    // Listen to real-time events
    const handleItemAdded = (data: any) => {
      if (data.poolId === id) {
        setItems((prev) => [data.item, ...prev.filter((i) => i._id !== data.item._id)]);
        setPool((prev) =>
          prev
            ? {
                ...prev,
                currentSubtotal: data.currentSubtotal,
                remainingAmount: data.remainingAmount,
                progressPercent: data.progressPercent,
              }
            : null
        );
      }
    };

    const handleItemUpdated = (data: any) => {
      if (data.poolId === id) {
        setItems((prev) =>
          prev.map((i) => (i._id === data.item._id ? data.item : i))
        );
        setPool((prev) =>
          prev
            ? {
                ...prev,
                currentSubtotal: data.currentSubtotal,
                remainingAmount: data.remainingAmount,
                progressPercent: data.progressPercent,
              }
            : null
        );
      }
    };

    const handleItemDeleted = (data: any) => {
      if (data.poolId === id) {
        setItems((prev) => prev.filter((i) => i._id !== data.itemId));
        setPool((prev) =>
          prev
            ? {
                ...prev,
                currentSubtotal: data.currentSubtotal,
                remainingAmount: data.remainingAmount,
                progressPercent: data.progressPercent,
              }
            : null
        );
      }
    };

    const handleStatusChanged = (data: any) => {
      if (data.poolId === id) {
        setPool((prev) => (prev ? { ...prev, status: data.status, ...data } : null));
        if (data.status === 'ORDERED' || data.status === 'DELIVERED') {
          confetti({ particleCount: 75, spread: 60, origin: { y: 0.7 } });
        }
        fetchPoolData(); // refresh full state
      }
    };

    const handlePaymentRecordUpdated = (data: any) => {
      if (data.poolId === id && data.record) {
        setPaymentRecords((prev) =>
          prev.map((r) => (r._id === data.record._id ? data.record : r))
        );
      }
    };

    socket.on('cart:item_added', handleItemAdded);
    socket.on('cart:item_updated', handleItemUpdated);
    socket.on('cart:item_deleted', handleItemDeleted);
    socket.on('pool:status_changed', handleStatusChanged);
    socket.on('payment:record_updated', handlePaymentRecordUpdated);

    return () => {
      socket.emit('pool:leave_room', id);
      socket.off('cart:item_added', handleItemAdded);
      socket.off('cart:item_updated', handleItemUpdated);
      socket.off('cart:item_deleted', handleItemDeleted);
      socket.off('pool:status_changed', handleStatusChanged);
      socket.off('payment:record_updated', handlePaymentRecordUpdated);
    };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-16 text-center">
        <div className="w-10 h-10 border-4 border-lime border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-ivory-400">Loading pool & synchronizing live cart...</p>
      </div>
    );
  }

  if (error || !pool) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="p-8 rounded-3xl bg-navy-850 border border-rose-500/30 text-rose-300">
          <p className="text-base font-semibold">{error || 'Pool not found'}</p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-navy-800 text-ivory-100 border border-navy-700 text-sm font-semibold"
          >
            <ArrowLeft className="w-4 h-4" /> Return to Discover Pools
          </Link>
        </div>
      </div>
    );
  }

  const poolCreatorId =
    typeof pool.creator === 'object' && pool.creator !== null
      ? pool.creator._id
      : pool.creator;

  const poolCreatorName =
    typeof pool.creator === 'object' && pool.creator !== null
      ? pool.creator.fullName
      : 'Hostel Student';

  const isOwner = user && user._id === poolCreatorId;
  const isParticipant =
    user &&
    pool.participants.some((p) => {
      const pId = typeof p === 'object' && p !== null ? p._id : p;
      return pId === user._id;
    });

  const isClosed = pool.status !== 'OPEN';
  const progressPercent = Math.min(
    100,
    Math.round(((pool.currentSubtotal || 0) / pool.targetAmount) * 100)
  );
  const remainingAmount = Math.max(0, pool.targetAmount - (pool.currentSubtotal || 0));

  // Time remaining
  const closingDate = new Date(pool.closingTime);
  const now = new Date();
  const diffMinutes = Math.max(0, Math.round((closingDate.getTime() - now.getTime()) / 60000));

  // Actions
  const handleJoinPool = async () => {
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; pool: Pool }>(`/api/pools/${pool._id}/join`, {
        method: 'POST',
      });
      if (res.success) {
        await fetchPoolData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to join pool');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLeavePool = async () => {
    if (!confirm('Leave this pool? Any items you added will be removed from the cart.')) return;
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean }>(`/api/pools/${pool._id}/leave`, {
        method: 'POST',
      });
      if (res.success) {
        await fetchPoolData();
      }
    } catch (err: any) {
      alert(err.message || 'Failed to leave pool');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkDelivered = async () => {
    if (!confirm('Confirm that this group order has arrived and was handed over to participants?'))
      return;
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; pool: Pool }>(
        `/api/pools/${pool._id}/deliver`,
        { method: 'POST' }
      );
      if (res.success && res.pool) {
        setPool(res.pool);
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err: any) {
      alert(err.message || 'Failed to mark as delivered');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancelPool = async () => {
    if (!confirm('Are you sure you want to cancel this order pool?')) return;
    setActionLoading(true);
    try {
      const res = await apiFetch<{ success: boolean; pool: Pool }>(`/api/pools/${pool._id}/cancel`, {
        method: 'POST',
      });
      if (res.success && res.pool) {
        setPool(res.pool);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to cancel pool');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    try {
      await apiFetch(`/api/pools/${pool._id}/items/${itemId}`, { method: 'DELETE' });
    } catch (err: any) {
      alert(err.message || 'Failed to delete item');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Back button & Room Status */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-ivory-400 hover:text-ivory-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Discover Pools
        </button>

        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-navy-850 border border-navy-700 text-xs">
          <span className="w-2 h-2 rounded-full bg-lime animate-pulse" />
          <span className="text-ivory-300 font-mono text-[11px]">Live Cart Room</span>
        </div>
      </div>

      {/* Main Pool Header Card */}
      <div className="bg-navy-850 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-80 h-40 bg-lime/5 blur-3xl pointer-events-none rounded-full" />

        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 relative z-10">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <RetailerBadge retailer={pool.retailer} customName={pool.retailerCustomName} />
              <HostelBadge hostel={pool.hostel} />
              <StatusBadge status={pool.status} />
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-ivory-50 tracking-tight">
              {pool.title}
            </h1>

            {pool.notes && (
              <p className="text-sm text-ivory-300 bg-navy-900/60 p-3 rounded-xl border border-navy-750">
                &ldquo;{pool.notes}&rdquo;
              </p>
            )}

            <div className="flex flex-wrap items-center gap-4 text-xs text-ivory-400 pt-1">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-lime" />
                <span className="text-ivory-200 font-medium">Spot: {pool.deliveryZone}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Users className="w-4 h-4 text-ivory-400" />
                <span>
                  Host: <strong className="text-ivory-200">{poolCreatorName}</strong> (
                  {pool.participants?.length || 1}/{pool.participantLimit} joined)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-ivory-400" />
                <span>
                  {isClosed
                    ? 'Cart closed'
                    : diffMinutes > 0
                    ? `Closes in ~${diffMinutes}m`
                    : 'Closing soon'}
                </span>
              </div>
            </div>
          </div>

          {/* Action Button Strip */}
          <div className="flex flex-wrap sm:flex-col items-stretch gap-2.5 flex-shrink-0">
            {/* If Pool is OPEN */}
            {pool.status === 'OPEN' && (
              <>
                {!isParticipant ? (
                  <button
                    onClick={handleJoinPool}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" /> Join Pool
                  </button>
                ) : (
                  <button
                    onClick={() => setAddItemOpen(true)}
                    className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all"
                  >
                    <Plus className="w-4 h-4" /> Add My Items
                  </button>
                )}

                {isOwner && items.length > 0 && (
                  <button
                    onClick={() => setLockModalOpen(true)}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-400 text-navy-950 font-bold text-sm hover:bg-amber-300 transition-all"
                  >
                    <Lock className="w-4 h-4" /> Lock Cart & Review
                  </button>
                )}

                {!isOwner && isParticipant && (
                  <button
                    onClick={handleLeavePool}
                    disabled={actionLoading}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl text-rose-400 hover:bg-rose-500/10 border border-navy-750 transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" /> Leave Pool
                  </button>
                )}
              </>
            )}

            {/* If Pool is LOCKED -> Owner places retailer order */}
            {pool.status === 'LOCKED' && isOwner && (
              <button
                onClick={() => setOrderPlacedOpen(true)}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-sky-400 text-navy-950 font-bold text-sm hover:bg-sky-300 shadow-lg transition-all"
              >
                <Package className="w-4 h-4" /> Order Placed on Retailer
              </button>
            )}

            {/* If Pool is ORDERED -> Owner marks delivered */}
            {pool.status === 'ORDERED' && isOwner && (
              <button
                onClick={handleMarkDelivered}
                disabled={actionLoading}
                className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-400 text-navy-950 font-bold text-sm hover:bg-emerald-300 shadow-lg transition-all"
              >
                <CheckCircle2 className="w-4 h-4" /> Mark Order Delivered
              </button>
            )}

            {/* Cancel option for host */}
            {isOwner && pool.status !== 'DELIVERED' && pool.status !== 'CANCELLED' && (
              <button
                onClick={handleCancelPool}
                disabled={actionLoading}
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline py-1 text-center"
              >
                Cancel Pool
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar towards Target minimum order value */}
        <div className="mt-6 pt-6 border-t border-navy-750/80 space-y-2">
          <div className="flex items-center justify-between text-xs sm:text-sm">
            <span className="text-ivory-300 font-semibold flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-lime" /> Target Free Delivery Minimum
            </span>
            <span className="font-mono font-bold text-ivory-100">
              ₹{pool.currentSubtotal} <span className="text-ivory-500">/ ₹{pool.targetAmount}</span>
            </span>
          </div>

          <div className="w-full bg-navy-950 rounded-full h-3 overflow-hidden border border-navy-700">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                progressPercent >= 100
                  ? 'bg-gradient-to-r from-lime to-emerald-400 shadow-glow-lime'
                  : 'bg-lime'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs pt-1">
            {progressPercent >= 100 ? (
              <span className="text-lime font-bold">
                🎉 Free delivery threshold unlocked! Ready for host to lock and place.
              </span>
            ) : (
              <span className="text-amber-300 font-medium">
                Add ₹{remainingAmount} more to unlock free delivery requirement.
              </span>
            )}
            <span className="font-mono text-ivory-400">{progressPercent}%</span>
          </div>
        </div>
      </div>

      {/* Collaborative Cart Items List */}
      <div className="bg-navy-850 border border-navy-750 rounded-3xl p-6 sm:p-8 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-ivory-50">Group Cart Items ({items.length})</h2>
            <p className="text-xs text-ivory-400 mt-0.5">
              Live updates synchronize automatically across all roommates.
            </p>
          </div>

          {!isClosed && isParticipant && (
            <button
              onClick={() => setAddItemOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-lime/10 text-lime hover:bg-lime/20 border border-lime/30 text-xs font-bold transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Add Items
            </button>
          )}
        </div>

        <CartItemList
          items={items}
          isLocked={isClosed}
          onDeleteItem={handleDeleteItem}
          poolCreatorId={poolCreatorId}
        />
      </div>

      {/* Cost Splitting & Payment Panel (Active once locked or ordered) */}
      {(pool.status === 'LOCKED' ||
        pool.status === 'ORDERED' ||
        pool.status === 'DELIVERED') && (
        <PaymentSection
          pool={pool}
          records={paymentRecords}
          costBreakdown={costBreakdown}
          onPaymentRecordUpdated={(rec) => {
            setPaymentRecords((prev) =>
              prev.map((r) => (r._id === rec._id ? rec : r))
            );
          }}
        />
      )}

      {/* Audit Timeline */}
      <AuditTimeline events={auditEvents} />

      {/* Modals */}
      <AddItemModal
        isOpen={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        poolId={pool._id}
        onItemAdded={(item) => {
          setItems((prev) => [item, ...prev]);
        }}
      />

      <LockPoolModal
        isOpen={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        pool={pool}
        onPoolLocked={(updatedPool) => {
          setPool(updatedPool);
          fetchPoolData();
        }}
      />

      <OrderPlacedModal
        isOpen={orderPlacedOpen}
        onClose={() => setOrderPlacedOpen(false)}
        pool={pool}
        onOrderPlaced={(updatedPool, breakdown) => {
          setPool(updatedPool);
          if (breakdown) setCostBreakdown(breakdown);
          fetchPoolData();
        }}
      />
    </div>
  );
};
