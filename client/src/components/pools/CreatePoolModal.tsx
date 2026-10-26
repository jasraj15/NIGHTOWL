import React, { useState } from 'react';
import { Modal } from '../common/Modal.js';
import { RetailerType, HostelType, Pool } from '../../types/index.js';
import { apiFetch } from '../../services/api.js';
import { useAuth } from '../../context/AuthContext.js';
import { Sparkles } from 'lucide-react';

interface CreatePoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPoolCreated: (pool: Pool) => void;
}

export const CreatePoolModal: React.FC<CreatePoolModalProps> = ({
  isOpen,
  onClose,
  onPoolCreated,
}) => {
  const { user } = useAuth();

  const [title, setTitle] = useState('');
  const [retailer, setRetailer] = useState<RetailerType>('Blinkit');
  const [retailerCustomName, setRetailerCustomName] = useState('');
  const [hostel, setHostel] = useState<HostelType>(user?.hostel || 'Uniworld 1');
  const [deliveryZone, setDeliveryZone] = useState('');
  const [targetAmount, setTargetAmount] = useState<number>(500);
  const [contributionCap, setContributionCap] = useState<string>('');
  const [participantLimit, setParticipantLimit] = useState<number>(8);
  const [minutesAhead, setMinutesAhead] = useState<number>(30);
  const [notes, setNotes] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deliveryZonePresets = [
    'Block A Ground Lobby',
    'Main Gate Security Desk',
    'Tower B Common Room',
    'Mess / Cafeteria Entrance',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const closingDate = new Date(Date.now() + minutesAhead * 60 * 1000);

      const payload = {
        title: title.trim(),
        retailer,
        ...(retailer === 'Other' && { retailerCustomName: retailerCustomName.trim() }),
        hostel,
        deliveryZone: deliveryZone.trim(),
        targetAmount: Number(targetAmount),
        ...(contributionCap && { contributionCap: Number(contributionCap) }),
        participantLimit: Number(participantLimit),
        closingTime: closingDate.toISOString(),
        ...(notes.trim() && { notes: notes.trim() }),
      };

      const res = await apiFetch<{ success: boolean; pool: Pool }>('/api/pools', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.success && res.pool) {
        onPoolCreated(res.pool);
        onClose();
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create pool');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Group Order Pool 🦉"
      description="Gather orders from your hostel friends to hit minimums & split delivery fees."
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
            {error}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-ivory-300 mb-1">
            Pool Title / Craving
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Midnight Maggi & Red Bull Sprint ⚡"
            className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 placeholder-ivory-500 focus:outline-none focus:border-lime"
          />
        </div>

        {/* Retailer Selector */}
        <div>
          <label className="block text-xs font-semibold text-ivory-300 mb-1.5">
            Select Retailer
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(['Blinkit', 'Zepto', 'Flipkart Minutes', 'Other'] as RetailerType[]).map((r) => (
              <button
                type="button"
                key={r}
                onClick={() => setRetailer(r)}
                className={`py-2 px-3 text-xs font-semibold rounded-xl border transition-all ${
                  retailer === r
                    ? 'border-lime bg-lime/10 text-lime font-bold shadow-sm'
                    : 'border-navy-750 bg-navy-900 text-ivory-400 hover:text-ivory-200'
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        {retailer === 'Other' && (
          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Store Name
            </label>
            <input
              type="text"
              required
              value={retailerCustomName}
              onChange={(e) => setRetailerCustomName(e.target.value)}
              placeholder="e.g. Instamart, BigBasket, Local Store"
              className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
            />
          </div>
        )}

        {/* Hostel & Delivery Zone */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Hostel Location
            </label>
            <select
              value={hostel}
              onChange={(e) => setHostel(e.target.value as HostelType)}
              className="w-full px-3 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none"
            >
              <option value="Uniworld 1">Uniworld 1</option>
              <option value="Uniworld 2">Uniworld 2</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-300 mb-1">
              Target Order Amount (₹)
            </label>
            <input
              type="number"
              min={1}
              required
              value={targetAmount}
              onChange={(e) => setTargetAmount(Number(e.target.value))}
              className="w-full px-3 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none font-mono"
            />
          </div>
        </div>

        {/* Pickup Spot / Delivery Zone */}
        <div>
          <label className="block text-xs font-semibold text-ivory-300 mb-1">
            Hostel Pickup Spot / Delivery Zone
          </label>
          <input
            type="text"
            required
            value={deliveryZone}
            onChange={(e) => setDeliveryZone(e.target.value)}
            placeholder="e.g. Block A Lobby or Main Gate"
            className="w-full px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm focus:border-lime outline-none mb-1.5"
          />
          {/* Quick presets */}
          <div className="flex flex-wrap gap-1.5">
            {deliveryZonePresets.map((preset) => (
              <button
                type="button"
                key={preset}
                onClick={() => setDeliveryZone(preset)}
                className="text-[11px] px-2 py-0.5 rounded-md bg-navy-800 hover:bg-navy-750 text-ivory-400 hover:text-ivory-200 border border-navy-750"
              >
                + {preset}
              </button>
            ))}
          </div>
        </div>

        {/* Closing Time Quick Buttons */}
        <div>
          <label className="block text-xs font-semibold text-ivory-300 mb-1.5">
            Cart Closes In
          </label>
          <div className="flex gap-2">
            {[15, 30, 45, 60].map((mins) => (
              <button
                type="button"
                key={mins}
                onClick={() => setMinutesAhead(mins)}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-xl border transition-all ${
                  minutesAhead === mins
                    ? 'border-lime bg-lime/10 text-lime'
                    : 'border-navy-750 bg-navy-900 text-ivory-400 hover:text-ivory-200'
                }`}
              >
                {mins} mins
              </button>
            ))}
          </div>
        </div>

        {/* Advanced Options: Caps & Limit */}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div>
            <label className="block text-xs font-semibold text-ivory-400 mb-1">
              Per-Person Cap (Optional ₹)
            </label>
            <input
              type="number"
              min={1}
              value={contributionCap}
              onChange={(e) => setContributionCap(e.target.value)}
              placeholder="e.g. 300"
              className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 text-sm font-mono focus:border-lime outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-ivory-400 mb-1">
              Max Participants
            </label>
            <input
              type="number"
              min={2}
              max={30}
              value={participantLimit}
              onChange={(e) => setParticipantLimit(Number(e.target.value))}
              className="w-full px-3 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 text-sm font-mono focus:border-lime outline-none"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-semibold text-ivory-400 mb-1">
            Notes / Ordering Plan (Optional)
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. I will order promptly at 12:30 AM once target is reached."
            className="w-full px-3.5 py-2 rounded-xl bg-navy-900 border border-navy-750 text-ivory-100 text-sm focus:border-lime outline-none resize-none"
          />
        </div>

        {/* Submit */}
        <div className="pt-2 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-ivory-400 hover:text-ivory-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold rounded-xl bg-lime text-navy-950 hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4" />
            {loading ? 'Creating...' : 'Launch Order Pool'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
