import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { CheckCircle2, QrCode } from 'lucide-react';
import { apiFetch } from '../../services/api.js';
import { Pool, CostSplitBreakdown } from '../../types/index.js';

interface OrderPlacedModalProps {
  isOpen: boolean;
  onClose: () => void;
  pool: Pool;
  onOrderPlaced: (updatedPool: Pool, breakdown?: CostSplitBreakdown) => void;
}

export const OrderPlacedModal: React.FC<OrderPlacedModalProps> = ({
  isOpen,
  onClose,
  pool,
  onOrderPlaced,
}) => {
  const [finalPayableAmount, setFinalPayableAmount] = useState<number | ''>(
    pool.currentSubtotal || ''
  );
  const [deliveryFee, setDeliveryFee] = useState<number | ''>(0);
  const [otherCharges, setOtherCharges] = useState<number | ''>(0);
  const [upiId, setUpiId] = useState('');
  const [paymentInstructions, setPaymentInstructions] = useState(
    'Please pay your exact amount via UPI and submit the 12-digit UTR/Ref below.'
  );

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (typeof finalPayableAmount !== 'number' || finalPayableAmount <= 0) {
      setError('Please enter a valid final payable amount from your retailer receipt.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const payload = {
        finalPayableAmount: Number(finalPayableAmount),
        deliveryFee: Number(deliveryFee) || 0,
        otherCharges: Number(otherCharges) || 0,
        upiId: upiId.trim(),
        paymentInstructions: paymentInstructions.trim(),
      };

      const res = await apiFetch<{
        success: boolean;
        pool: Pool;
        costBreakdown: CostSplitBreakdown;
      }>(`/api/pools/${pool._id}/order-placed`, {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.pool) {
        onOrderPlaced(res.pool, res.costBreakdown);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to confirm order placement');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Confirm Order Placed 📦"
      description={`Record the final bill details from ${pool.retailer} to calculate exact proportional splits.`}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Final Billed Total (₹) *
            </label>
            <input
              type="number"
              min={1}
              step="any"
              required
              value={finalPayableAmount}
              onChange={(e) =>
                setFinalPayableAmount(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="Total paid on app"
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 font-mono text-sm focus:border-lime outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Your UPI ID for Reimbursement *
            </label>
            <input
              type="text"
              required
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="e.g. yourname@okaxis"
              className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ivory-400 mb-1">
              Delivery Fee (Shared ₹)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={deliveryFee}
              onChange={(e) => setDeliveryFee(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="0 if free delivery"
              className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 font-mono text-sm focus:border-lime outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-400 mb-1">
              Handling / Surge Fee (₹)
            </label>
            <input
              type="number"
              min={0}
              step="any"
              value={otherCharges}
              onChange={(e) =>
                setOtherCharges(e.target.value === '' ? '' : Number(e.target.value))
              }
              placeholder="0 if none"
              className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 font-mono text-sm focus:border-lime outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-ivory-400 mb-1">
            Payment Note / Instructions
          </label>
          <textarea
            rows={2}
            value={paymentInstructions}
            onChange={(e) => setPaymentInstructions(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 text-sm focus:border-lime outline-none resize-none"
          />
        </div>

        <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-750 text-xs text-ivory-400 flex items-center gap-2">
          <QrCode className="w-4 h-4 text-lime" />
          <span>
            Fees will be proportionally allocated based on each student&apos;s cart subtotal with exact rounding preservation.
          </span>
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
            type="submit"
            disabled={loading || !upiId.trim() || typeof finalPayableAmount !== 'number'}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-lime text-navy-950 hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {loading ? 'Confirming...' : 'Confirm & Calculate Splits'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
