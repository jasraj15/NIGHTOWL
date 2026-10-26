import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Lock, AlertTriangle } from 'lucide-react';
import { apiFetch } from '../../services/api.js';
import { Pool } from '../../types/index.js';

interface LockPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: Pool;
  onPoolLocked: (updatedPool: Pool) => void;
}

export const LockPoolModal: React.FC<LockPoolModalProps> = ({
  isOpen,
  onClose,
  pool,
  onPoolLocked,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLock = async () => {
    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{ success: boolean; pool: Pool }>(
        `/api/pools/${pool._id}/lock`,
        { method: 'POST' }
      );

      if (res.success && res.pool) {
        onPoolLocked(res.pool);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to lock pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lock Order Cart 🔒"
      description="Prepare to place the retailer order. No more items can be added after locking."
    >
      <div className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-200 text-xs flex gap-3 items-start">
          <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-300">Are you ready to place the order?</p>
            <p className="mt-1 text-ivory-300">
              Locking prevents participants from editing or removing items. You will then proceed to order on {pool.retailer} and confirm the final billed receipt.
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-navy-900 border border-navy-750 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-ivory-400">Current Items Total:</span>
            <span className="font-bold text-lime font-mono">₹{pool.currentSubtotal}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ivory-400">Target Minimum:</span>
            <span className="font-mono text-ivory-300">₹{pool.targetAmount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ivory-400">Total Participants:</span>
            <span className="font-medium text-ivory-200">
              {pool.participantCount || pool.participants?.length || 1} students
            </span>
          </div>
        </div>

        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-ivory-400 hover:text-ivory-200"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLock}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl bg-amber-400 text-navy-950 hover:bg-amber-300 transition-all disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {loading ? 'Locking...' : 'Lock Cart Now'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
