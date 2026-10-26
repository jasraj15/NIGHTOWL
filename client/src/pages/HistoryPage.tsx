import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { History, ShoppingBag, ArrowRight } from 'lucide-react';
import { Pool } from '../types/index.js';
import { apiFetch } from '../services/api.js';
import { StatusBadge, RetailerBadge, HostelBadge } from '../components/common/Badge.js';

export const HistoryPage: React.FC = () => {
  const [createdPools, setCreatedPools] = useState<Pool[]>([]);
  const [joinedPools, setJoinedPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'joined' | 'created'>('joined');

  useEffect(() => {
    async function loadHistory() {
      try {
        const res = await apiFetch<{
          success: boolean;
          createdPools: Pool[];
          joinedPools: Pool[];
        }>('/api/pools/history/my');
        if (res.success) {
          setCreatedPools(res.createdPools || []);
          setJoinedPools(res.joinedPools || []);
        }
      } catch (err) {
        // fail silently or show error
      } finally {
        setLoading(false);
      }
    }
    loadHistory();
  }, []);

  const displayList = activeTab === 'joined' ? joinedPools : createdPools;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-navy-850 border border-navy-750 flex items-center justify-center text-lime">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-ivory-50">My Order History</h1>
          <p className="text-xs text-ivory-400">
            View past hostel pools you created or joined.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-2xl bg-navy-850 p-1.5 border border-navy-750 max-w-sm">
        <button
          onClick={() => setActiveTab('joined')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'joined'
              ? 'bg-lime text-navy-950 shadow-sm'
              : 'text-ivory-400 hover:text-ivory-200'
          }`}
        >
          Joined Pools ({joinedPools.length})
        </button>
        <button
          onClick={() => setActiveTab('created')}
          className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
            activeTab === 'created'
              ? 'bg-lime text-navy-950 shadow-sm'
              : 'text-ivory-400 hover:text-ivory-200'
          }`}
        >
          Hosted Pools ({createdPools.length})
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-24 rounded-2xl bg-navy-850/60 animate-pulse border border-navy-750" />
          ))}
        </div>
      ) : displayList.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-navy-850 border border-dashed border-navy-750">
          <ShoppingBag className="w-10 h-10 text-ivory-500 mx-auto mb-2" />
          <p className="text-sm font-semibold text-ivory-200">
            No {activeTab === 'joined' ? 'joined pools' : 'hosted pools'} found
          </p>
          <Link
            to="/dashboard"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-lime hover:underline"
          >
            Explore live pools <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {displayList.map((pool) => {
            const dateStr = new Date(pool.createdAt).toLocaleDateString([], {
              month: 'short',
              day: 'numeric',
            });

            return (
              <Link
                key={pool._id}
                to={`/pools/${pool._id}`}
                className="block p-4 rounded-2xl bg-navy-850 hover:bg-navy-800 border border-navy-750 hover:border-lime/30 transition-all group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <RetailerBadge retailer={pool.retailer} customName={pool.retailerCustomName} />
                      <HostelBadge hostel={pool.hostel} />
                      <StatusBadge status={pool.status} />
                    </div>
                    <h3 className="text-base font-bold text-ivory-50 group-hover:text-lime transition-colors">
                      {pool.title}
                    </h3>
                    <p className="text-xs text-ivory-400">
                      Pickup Spot: {pool.deliveryZone} • Created on {dateStr}
                    </p>
                  </div>

                  <div className="text-right sm:self-center flex items-center justify-between sm:justify-end gap-4">
                    <div>
                      <span className="text-xs text-ivory-400 block">Total Cart</span>
                      <span className="text-base font-extrabold font-mono text-lime">
                        ₹{pool.finalPayableAmount || pool.currentSubtotal}
                      </span>
                    </div>
                    <ArrowRight className="w-5 h-5 text-ivory-400 group-hover:text-lime group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};
