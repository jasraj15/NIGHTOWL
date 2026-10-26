import React, { useState } from 'react';
import {
  CreditCard,
  QrCode,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Send,
  HelpCircle,
} from 'lucide-react';
import { Pool, PaymentRecord, CostSplitBreakdown } from '../../types/index.js';
import { PaymentBadge } from '../common/Badge.js';
import { useAuth } from '../../context/AuthContext.js';
import { apiFetch } from '../../services/api.js';

interface PaymentSectionProps {
  pool: Pool;
  records: PaymentRecord[];
  costBreakdown?: CostSplitBreakdown | null;
  onPaymentRecordUpdated: (updatedRecord: PaymentRecord) => void;
}

export const PaymentSection: React.FC<PaymentSectionProps> = ({
  pool,
  records,
  costBreakdown,
  onPaymentRecordUpdated,
}) => {
  const { user } = useAuth();
  const [copiedUpi, setCopiedUpi] = useState(false);
  const [paymentReference, setPaymentReference] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [refError, setRefError] = useState<string | null>(null);
  const [refSuccess, setRefSuccess] = useState<string | null>(null);

  // Review state
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  const poolCreatorId =
    typeof pool.creator === 'object' && pool.creator !== null
      ? pool.creator._id
      : pool.creator;

  const isPoolOwner = user && user._id === poolCreatorId;

  // Find current user's payment record
  const myRecord = records.find((r) => {
    const rUserId = typeof r.userId === 'object' && r.userId !== null ? r.userId._id : r.userId;
    return user && rUserId === user._id;
  });

  const handleCopyUpi = () => {
    if (pool.upiId) {
      navigator.clipboard.writeText(pool.upiId);
      setCopiedUpi(true);
      setTimeout(() => setCopiedUpi(false), 2000);
    }
  };

  const handleSubmitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentReference.trim()) return;

    setRefError(null);
    setRefSuccess(null);
    setSubmittingRef(true);

    try {
      const res = await apiFetch<{ success: boolean; record: PaymentRecord }>(
        `/api/pools/${pool._id}/payment`,
        {
          method: 'POST',
          body: JSON.stringify({ paymentReference: paymentReference.trim() }),
        }
      );

      if (res.success && res.record) {
        onPaymentRecordUpdated(res.record);
        setRefSuccess('Payment reference submitted! The host will verify receipt in their UPI app.');
        setPaymentReference('');
      }
    } catch (err: any) {
      setRefError(err.message || 'Failed to submit payment reference');
    } finally {
      setSubmittingRef(false);
    }
  };

  const handleReviewPayment = async (paymentId: string, status: 'CONFIRMED' | 'REJECTED') => {
    try {
      const res = await apiFetch<{ success: boolean; record: PaymentRecord }>(
        `/api/pools/${pool._id}/payment/${paymentId}/review`,
        {
          method: 'POST',
          body: JSON.stringify({
            status,
            reviewNote: reviewNote.trim() || undefined,
          }),
        }
      );

      if (res.success && res.record) {
        onPaymentRecordUpdated(res.record);
        setReviewingId(null);
        setReviewNote('');
      }
    } catch (err: any) {
      alert(err.message || 'Error updating payment review');
    }
  };

  return (
    <div className="space-y-6">
      {/* Financial Summary Card */}
      <div className="bg-navy-850 border border-navy-750 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-lime" />
            <h3 className="text-lg font-bold text-ivory-50">Cost Split & Payment Details</h3>
          </div>
          <span className="text-xs text-ivory-400 font-mono">
            Deterministic Proportional Split
          </span>
        </div>

        {/* Bill Breakdown Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div className="bg-navy-900 p-3.5 rounded-xl border border-navy-750">
            <span className="text-xs text-ivory-400 block mb-0.5">Items Subtotal</span>
            <span className="text-base font-bold font-mono text-ivory-100">
              ₹{costBreakdown?.itemsSubtotal || pool.currentSubtotal}
            </span>
          </div>

          <div className="bg-navy-900 p-3.5 rounded-xl border border-navy-750">
            <span className="text-xs text-ivory-400 block mb-0.5">Delivery Fee</span>
            <span className="text-base font-bold font-mono text-amber-300">
              ₹{pool.deliveryFee || 0}
            </span>
          </div>

          <div className="bg-navy-900 p-3.5 rounded-xl border border-navy-750">
            <span className="text-xs text-ivory-400 block mb-0.5">Other Charges</span>
            <span className="text-base font-bold font-mono text-amber-300">
              ₹{pool.otherCharges || 0}
            </span>
          </div>

          <div className="bg-navy-900 p-3.5 rounded-xl border border-lime/30 bg-lime/5">
            <span className="text-xs text-lime block mb-0.5 font-semibold">Final Billed Total</span>
            <span className="text-lg font-extrabold font-mono text-lime">
              ₹{pool.finalPayableAmount || pool.currentSubtotal}
            </span>
          </div>
        </div>

        {/* Explanation Alert */}
        <div className="p-3 rounded-xl bg-navy-900/60 border border-navy-750 text-xs text-ivory-400 flex items-start gap-2.5">
          <HelpCircle className="w-4 h-4 text-lime mt-0.5 flex-shrink-0" />
          <div>
            <span className="font-semibold text-ivory-200">How is this calculated? </span>
            Eligible delivery and handling charges (₹{(pool.deliveryFee || 0) + (pool.otherCharges || 0)}) are allocated strictly in proportion to each person&apos;s item subtotal. Any fractional remainder is reconciled to preserve exact mathematical equality to the retailer receipt.
          </div>
        </div>
      </div>

      {/* Student's Payment Action Banner (If not owner and has amount due) */}
      {myRecord && !isPoolOwner && (
        <div className="bg-gradient-to-br from-navy-850 to-navy-800 border-2 border-lime/30 rounded-2xl p-6 shadow-glow-subtle">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-navy-750">
            <div>
              <span className="text-xs font-semibold text-lime uppercase tracking-wider">
                Your Share of Order
              </span>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-extrabold font-mono text-ivory-50">
                  ₹{myRecord.totalDue}
                </span>
                <span className="text-xs text-ivory-400">
                  (₹{myRecord.itemSubtotal} items + ₹{myRecord.allocatedFee} fees)
                </span>
              </div>
            </div>

            <PaymentBadge status={myRecord.paymentStatus} />
          </div>

          {/* UPI Payment Instructions */}
          <div className="pt-4 space-y-4">
            {pool.upiId ? (
              <div className="p-3.5 rounded-xl bg-navy-900 border border-navy-700 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <QrCode className="w-5 h-5 text-lime" />
                  <div>
                    <span className="text-[11px] text-ivory-400 block">Host UPI ID:</span>
                    <span className="font-mono text-sm font-bold text-ivory-100 select-all">
                      {pool.upiId}
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleCopyUpi}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-750 text-xs font-semibold text-ivory-200 border border-navy-700 transition-colors"
                >
                  {copiedUpi ? <Check className="w-3.5 h-3.5 text-lime" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedUpi ? 'Copied!' : 'Copy UPI ID'}
                </button>
              </div>
            ) : null}

            {pool.paymentInstructions && (
              <p className="text-xs text-ivory-300 bg-navy-900/50 p-3 rounded-lg border border-navy-750">
                <span className="font-semibold text-ivory-200">Host Instructions: </span>
                {pool.paymentInstructions}
              </p>
            )}

            {/* Reference Submission Form */}
            {myRecord.paymentStatus !== 'CONFIRMED' && (
              <form onSubmit={handleSubmitReference} className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-ivory-300 mb-1">
                    Submitted UPI Transaction ID / UTR
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder="e.g. 409823194821 or UPI Ref"
                      className="flex-1 px-3.5 py-2.5 rounded-xl bg-navy-900 border border-navy-700 text-ivory-100 text-sm font-mono focus:border-lime outline-none"
                    />
                    <button
                      type="submit"
                      disabled={submittingRef || !paymentReference.trim()}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-lime text-navy-950 font-bold text-sm hover:bg-lime-400 shadow-glow-lime transition-all disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                      {submittingRef ? 'Sending...' : 'Submit'}
                    </button>
                  </div>
                  <span className="text-[11px] text-ivory-400 mt-1 block">
                    Never send UPI PINs or card information. The host manually verifies payment in their bank app.
                  </span>
                </div>

                {refSuccess && (
                  <div className="p-2.5 rounded-lg bg-lime/10 border border-lime/30 text-lime text-xs">
                    {refSuccess}
                  </div>
                )}
                {refError && (
                  <div className="p-2.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                    {refError}
                  </div>
                )}
              </form>
            )}
          </div>
        </div>
      )}

      {/* Participants Split & Payment Status List */}
      <div className="bg-navy-850 border border-navy-750 rounded-2xl p-6 shadow-xl">
        <h4 className="text-base font-bold text-ivory-50 mb-4">
          All Participants & Reimbursement Status
        </h4>

        <div className="space-y-3">
          {records.map((record) => {
            const rUserName =
              typeof record.userId === 'object' && record.userId !== null
                ? record.userId.fullName
                : 'Student';

            const rUserId =
              typeof record.userId === 'object' && record.userId !== null
                ? record.userId._id
                : record.userId;

            const isUserOwner = rUserId === poolCreatorId;
            const isMe = user && rUserId === user._id;

            return (
              <div
                key={record._id}
                className="p-4 rounded-xl bg-navy-900 border border-navy-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                {/* Participant Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-ivory-100">{rUserName}</span>
                    {isUserOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-lime/15 text-lime font-semibold border border-lime/30">
                        Host
                      </span>
                    )}
                    {isMe && !isUserOwner && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-navy-750 text-ivory-300 font-medium">
                        You
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-ivory-400 font-mono">
                    Items: ₹{record.itemSubtotal} + Fee share: ₹{record.allocatedFee}
                  </div>

                  {/* Privacy: only show payment reference to host or the student themselves */}
                  {(isPoolOwner || isMe) && record.paymentReference && (
                    <div className="text-xs text-sky-400 font-mono flex items-center gap-1 mt-1">
                      <span>Ref / UTR:</span>
                      <span className="bg-navy-950 px-2 py-0.5 rounded border border-navy-800">
                        {record.paymentReference}
                      </span>
                    </div>
                  )}

                  {record.reviewNote && (
                    <p className="text-xs text-ivory-400 italic">
                      Host note: {record.reviewNote}
                    </p>
                  )}
                </div>

                {/* Status + Owner Actions */}
                <div className="flex items-center gap-3 self-end sm:self-center">
                  <div className="text-right">
                    <div className="text-base font-bold font-mono text-ivory-50">
                      ₹{record.totalDue}
                    </div>
                    <PaymentBadge status={record.paymentStatus} />
                  </div>

                  {/* Owner review buttons */}
                  {isPoolOwner && !isUserOwner && (
                    <div className="flex items-center gap-1 ml-2">
                      {reviewingId === record._id ? (
                        <div className="flex items-center gap-1.5 bg-navy-950 p-1.5 rounded-lg border border-navy-700">
                          <input
                            type="text"
                            placeholder="Optional note"
                            value={reviewNote}
                            onChange={(e) => setReviewNote(e.target.value)}
                            className="text-xs px-2 py-1 rounded bg-navy-900 border border-navy-750 text-ivory-100 outline-none w-28"
                          />
                          <button
                            onClick={() => handleReviewPayment(record._id, 'CONFIRMED')}
                            className="p-1 rounded bg-lime text-navy-950 hover:bg-lime-400"
                            title="Confirm received"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReviewPayment(record._id, 'REJECTED')}
                            className="p-1 rounded bg-rose-500 text-ivory-50 hover:bg-rose-400"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setReviewingId(record._id);
                            setReviewNote('');
                          }}
                          className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-navy-800 hover:bg-navy-750 text-ivory-200 border border-navy-700 transition-colors"
                        >
                          Review
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
