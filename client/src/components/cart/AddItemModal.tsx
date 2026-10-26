import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { Plus, Minus, ShoppingCart } from 'lucide-react';
import { apiFetch } from '../../services/api.js';
import { PoolItem } from '../../types/index.js';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  poolId: string;
  onItemAdded: (item: PoolItem) => void;
}

export const AddItemModal: React.FC<AddItemModalProps> = ({
  isOpen,
  onClose,
  poolId,
  onItemAdded,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState<number | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = typeof unitPrice === 'number' && unitPrice > 0 ? unitPrice * quantity : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || typeof unitPrice !== 'number' || unitPrice <= 0) {
      setError('Please provide a valid item name and unit price.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await apiFetch<{ success: boolean; item: PoolItem }>(
        `/api/pools/${poolId}/items`,
        {
          method: 'POST',
          body: JSON.stringify({
            name: name.trim(),
            quantity,
            unitPrice: Number(unitPrice),
            ...(note.trim() && { note: note.trim() }),
          }),
        }
      );

      if (res.success && res.item) {
        onItemAdded(res.item);
        setName('');
        setQuantity(1);
        setUnitPrice('');
        setNote('');
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to add item to cart');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Item to Cart 🛒"
      description="Enter the item name and retailer price as shown in the quick-commerce app."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Item Name */}
        <div>
          <label className="block text-xs font-semibold text-ivory-300 mb-1">
            Item Name & Brand
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Red Bull Energy Drink (250ml) or Lays Classic"
            className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
          />
        </div>

        {/* Quantity & Unit Price */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Quantity
            </label>
            <div className="flex items-center rounded-xl bg-navy-900 border border-navy-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="px-3 py-2 text-ivory-300 hover:text-lime hover:bg-navy-800 transition-colors"
                aria-label="Decrease quantity"
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                min={1}
                max={99}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full text-center bg-transparent text-ivory-100 font-mono text-sm focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(99, q + 1))}
                className="px-3 py-2 text-ivory-300 hover:text-lime hover:bg-navy-800 transition-colors"
                aria-label="Increase quantity"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Unit Price (₹)
            </label>
            <input
              type="number"
              min={1}
              step="any"
              required
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 125"
              className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm font-mono focus:border-lime outline-none"
            />
          </div>
        </div>

        {/* Note */}
        <div>
          <label className="block text-xs font-semibold text-ivory-400 mb-1">
            Preference Note (Optional)
          </label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Chilled if available / Sugar free"
            className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
          />
        </div>

        {/* Subtotal Preview */}
        <div className="flex items-center justify-between p-3 rounded-xl bg-navy-900/80 border border-navy-750">
          <span className="text-xs text-ivory-400">Item Total Contribution:</span>
          <span className="text-base font-bold font-mono text-lime">₹{subtotal}</span>
        </div>

        {/* Buttons */}
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
            disabled={loading || !name.trim() || typeof unitPrice !== 'number' || unitPrice <= 0}
            className="flex items-center gap-2 px-5 py-2 text-sm font-bold rounded-xl bg-lime text-navy-950 hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
          >
            <ShoppingCart className="w-4 h-4" />
            {loading ? 'Adding...' : 'Add to Group Cart'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
