import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PlusCircle, Search, Filter, RefreshCw, Sparkles, Building2 } from 'lucide-react';
import { Pool } from '../types/index.js';
import { apiFetch } from '../services/api.js';
import { PoolCard } from '../components/pools/PoolCard.js';
import { CreatePoolModal } from '../components/pools/CreatePoolModal.js';
import { useAuth } from '../context/AuthContext.js';
import { getSocket } from '../services/socket.js';

export const DashboardPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [hostelFilter, setHostelFilter] = useState<string>(
    searchParams.get('hostel') || user?.hostel || 'ALL'
  );
  const [retailerFilter, setRetailerFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modal
  const [createModalOpen, setCreateModalOpen] = useState(
    searchParams.get('create') === 'true'
  );

  const fetchPools = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (hostelFilter !== 'ALL') params.set('hostel', hostelFilter);
      if (retailerFilter !== 'ALL') params.set('retailer', retailerFilter);
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (searchQuery.trim()) params.set('search', searchQuery.trim());

      const res = await apiFetch<{ success: boolean; pools: Pool[] }>(
        `/api/pools?${params.toString()}`
      );
      if (res.success) {
        setPools(res.pools || []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch pools');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPools();
  }, [hostelFilter, retailerFilter, statusFilter]);

  // Handle search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchPools();
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  // Socket listener for pool updates across campus
  useEffect(() => {
    const socket = getSocket();

    const handlePoolUpdate = () => {
      fetchPools();
    };

    socket.on('pool:updated', handlePoolUpdate);
    socket.on('pool:status_changed', handlePoolUpdate);

    return () => {
      socket.off('pool:updated', handlePoolUpdate);
      socket.off('pool:status_changed', handlePoolUpdate);
    };
  }, []);

  const handlePoolCreated = (newPool: Pool) => {
    setPools((prev) => [newPool, ...prev]);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Header Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-navy-850 p-6 rounded-3xl border border-navy-750 shadow-xl">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold text-lime uppercase tracking-wider">
              Hostel Order Discovery
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-ivory-50">
            Active Midnight Pools
          </h1>
          <p className="text-xs sm:text-sm text-ivory-400 mt-1">
            Combine purchases with students in your hostel to waive delivery fees & unlock retailer targets.
          </p>
        </div>

        <button
          onClick={() => setCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-3 rounded-2xl bg-lime text-navy-950 font-extrabold text-sm hover:bg-lime-400 shadow-glow-lime transition-all duration-200 hover:scale-[1.02] flex-shrink-0"
        >
          <PlusCircle className="w-5 h-5" />
          Start New Pool
        </button>
      </div>

      {/* Hostel Filter Tabs */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-navy-850 border border-navy-750 overflow-x-auto">
        <button
          onClick={() => setHostelFilter('ALL')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            hostelFilter === 'ALL'
              ? 'bg-lime text-navy-950 shadow-sm'
              : 'text-ivory-400 hover:text-ivory-100 hover:bg-navy-800'
          }`}
        >
          All Campus Hostels
        </button>
        <button
          onClick={() => setHostelFilter('Uniworld 1')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            hostelFilter === 'Uniworld 1'
              ? 'bg-lime text-navy-950 shadow-sm'
              : 'text-ivory-400 hover:text-ivory-100 hover:bg-navy-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Uniworld 1 Pools
        </button>
        <button
          onClick={() => setHostelFilter('Uniworld 2')}
          className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap ${
            hostelFilter === 'Uniworld 2'
              ? 'bg-lime text-navy-950 shadow-sm'
              : 'text-ivory-400 hover:text-ivory-100 hover:bg-navy-800'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Uniworld 2 Pools
        </button>
      </div>

      {/* Filter Toolbar: Retailer + Status + Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
        {/* Retailer Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          <span className="text-xs text-ivory-400 font-semibold mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5 text-lime" /> Retailer:
          </span>
          {['ALL', 'Blinkit', 'Zepto', 'Flipkart Minutes', 'Other'].map((r) => (
            <button
              key={r}
              onClick={() => setRetailerFilter(r)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl border transition-all whitespace-nowrap ${
                retailerFilter === r
                  ? 'border-lime bg-lime/10 text-lime font-bold'
                  : 'border-navy-750 bg-navy-850 text-ivory-400 hover:text-ivory-200'
              }`}
            >
              {r === 'ALL' ? 'All Stores' : r}
            </button>
          ))}
        </div>

        {/* Status + Search */}
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-xl bg-navy-850 border border-navy-750 text-ivory-300 text-xs font-semibold outline-none focus:border-lime"
          >
            <option value="ALL">All Statuses</option>
            <option value="OPEN">Open Carts</option>
            <option value="LOCKED">Locked</option>
            <option value="ORDERED">Order Placed</option>
            <option value="DELIVERED">Delivered</option>
          </select>

          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-ivory-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search cravings or spot..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl bg-navy-850 border border-navy-750 text-ivory-100 placeholder-ivory-500 outline-none focus:border-lime"
            />
          </div>

          <button
            onClick={fetchPools}
            className="p-2 rounded-xl bg-navy-850 border border-navy-750 text-ivory-400 hover:text-lime transition-colors"
            title="Refresh pools"
            aria-label="Refresh pools"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pools Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-4">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div
              key={n}
              className="h-64 rounded-2xl bg-navy-850/60 border border-navy-750 animate-pulse"
            />
          ))}
        </div>
      ) : error ? (
        <div className="p-8 text-center rounded-2xl bg-navy-850 border border-rose-500/30 text-rose-300">
          <p className="text-sm">{error}</p>
          <button
            onClick={fetchPools}
            className="mt-3 px-4 py-2 text-xs font-bold rounded-xl bg-navy-800 text-ivory-100 border border-navy-700"
          >
            Retry Loading
          </button>
        </div>
      ) : pools.length === 0 ? (
        <div className="text-center py-20 px-4 rounded-3xl bg-navy-850 border border-dashed border-navy-750">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-navy-800 border border-navy-750 flex items-center justify-center p-3">
            <Sparkles className="w-8 h-8 text-lime" />
          </div>
          <h3 className="text-xl font-bold text-ivory-50">No pools match your filters</h3>
          <p className="mt-1 text-sm text-ivory-400 max-w-md mx-auto">
            Got late-night cravings? Be the hero your hostel floor needs and launch a new pool!
          </p>
          <button
            onClick={() => setCreateModalOpen(true)}
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all"
          >
            <PlusCircle className="w-4 h-4" />
            Create the First Pool
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {pools.map((pool) => (
            <PoolCard key={pool._id} pool={pool} />
          ))}
        </div>
      )}

      {/* Create Pool Modal */}
      <CreatePoolModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onPoolCreated={handlePoolCreated}
      />
    </div>
  );
};
