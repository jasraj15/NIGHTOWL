import React, { useState } from 'react';
import { CreditCard, Receipt, CheckCircle2, Copy, ShieldCheck, Info } from 'lucide-react';
import { CostSplitBreakdown, PaymentConfig, PaymentRecord, Pool, PublicUser, userId, userName } from '../../types/index.js';
import { post, errorMessage } from '../../services/api.js';
import { openRazorpayCheckout } from '../../services/razorpay.js';
import { useToast } from '../../context/ToastContext.js';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Field.js';
import { Alert, Avatar, PaymentBadge, payLabels } from '../ui/Bits.js';
import { ConfirmDialog } from '../ui/Modal.js';
import { money, formatDateTime, cx } from '../../utils/format.js';

interface Props {
  pool: Pool;
  records: PaymentRecord[];
  breakdown: CostSplitBreakdown | null;
  config: PaymentConfig | null;
  viewer: { isHost: boolean; isParticipant: boolean; userId: string };
  outstandingBalance: number;
  onChanged: () => void;
}

/** Transparent fee table: item subtotal → allocated fee → total, for each participant. */
const BreakdownTable: React.FC<{ breakdown: CostSplitBreakdown; records: PaymentRecord[]; viewerId: string; participants: (PublicUser | string)[] }> = ({ breakdown, records, viewerId, participants }) => {
  const nameOf = (id: string) => {
    const r = records.find((x) => userId(x.userId) === id);
    if (r) return userName(r.userId);
    const p = participants.find((x) => userId(x) === id);
    return userName(p);
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-line">
      <table className="w-full text-left text-xs">
        <thead className="bg-surface text-[11px] uppercase tracking-wide text-faint">
          <tr>
            <th className="px-3 py-2 font-semibold">Participant</th>
            <th className="px-3 py-2 text-right font-semibold">Items</th>
            <th className="px-3 py-2 text-right font-semibold">Share of fees</th>
            <th className="px-3 py-2 text-right font-semibold">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {breakdown.splits.map((s) => (
            <tr key={s.userId} className={cx(s.userId === viewerId && 'bg-lime/5')}>
              <td className="px-3 py-2 font-medium text-fg">
                {s.userId === viewerId ? 'You' : nameOf(s.userId)} <span className="text-faint">({s.proportionPercent}%)</span>
              </td>
              <td className="px-3 py-2 text-right font-mono text-muted">{money(s.itemSubtotal)}</td>
              <td className="px-3 py-2 text-right font-mono text-muted">{money(s.allocatedFee)}</td>
              <td className="px-3 py-2 text-right font-mono font-bold text-fg">{money(s.totalDue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-surface text-fg">
          <tr>
            <td className="px-3 py-2 font-semibold">Total</td>
            <td className="px-3 py-2 text-right font-mono">{money(breakdown.itemsSubtotal)}</td>
            <td className="px-3 py-2 text-right font-mono">{money(breakdown.totalSharedFees)}</td>
            <td className="px-3 py-2 text-right font-mono font-bold">{money(breakdown.finalPayableAmount)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};

export const PaymentSection: React.FC<Props> = ({ pool, records, breakdown, config, viewer, outstandingBalance, onChanged }) => {
  const toast = useToast();
  const [paying, setPaying] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [reference, setReference] = useState('');
  const [submittingRef, setSubmittingRef] = useState(false);
  const [review, setReview] = useState<{ record: PaymentRecord; status: 'PAID' | 'FAILED' } | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showManual, setShowManual] = useState(false);

  const payable = pool.status === 'ORDERED' || pool.status === 'DELIVERED';
  const myRecord = records.find((r) => userId(r.userId) === viewer.userId) || null;
  const razorpayAvailable = config?.provider === 'razorpay' && Boolean(config.keyId);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Could not copy');
    }
  };

  /** Steps 1–10 of the Razorpay flow (see README → Payments). */
  const payWithRazorpay = async () => {
    if (!myRecord) return;
    setPaying(true);
    try {
      const res = await post<{ order: { id: string; amount: number; currency: string }; keyId: string; payer: { name: string; email: string; contact?: string } }>(
        `/pools/${pool._id}/payments/razorpay/order`
      );
      await openRazorpayCheckout({
        keyId: res.keyId,
        order: res.order,
        payer: res.payer,
        description: `${pool.title} — your share`,
        onSuccess: async (resp) => {
          setVerifying(true);
          try {
            const v = await post<{ pending?: boolean; message: string }>(`/pools/${pool._id}/payments/razorpay/verify`, resp);
            if (v.pending) toast.info('Payment received — confirming with Razorpay', v.message);
            else toast.success('Payment verified', 'Your contribution is marked as paid.');
            onChanged();
          } catch (err) {
            toast.error('Verification failed', errorMessage(err));
            onChanged();
          } finally {
            setVerifying(false);
            setPaying(false);
          }
        },
        onDismiss: () => {
          setPaying(false);
          toast.info('Checkout closed', 'You can try again whenever you like.');
          onChanged();
        },
        onFailure: (reason) => {
          setPaying(false);
          toast.error('Payment failed', reason);
          onChanged();
        },
      });
    } catch (err) {
      setPaying(false);
      toast.error('Could not start payment', errorMessage(err));
    }
  };

  const submitReference = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reference.trim().length < 3) {
      toast.error('Enter the UPI transaction reference (UTR)');
      return;
    }
    setSubmittingRef(true);
    try {
      await post(`/pools/${pool._id}/payments/manual`, { paymentReference: reference.trim() });
      toast.success('Reference submitted', 'The host will confirm once they see the money in their UPI app.');
      setReference('');
      setShowManual(false);
      onChanged();
    } catch (err) {
      toast.error('Could not submit', errorMessage(err));
    } finally {
      setSubmittingRef(false);
    }
  };

  const doReview = async () => {
    if (!review) return;
    setReviewing(true);
    try {
      await post(`/pools/${pool._id}/payments/${review.record._id}/review`, { status: review.status });
      toast.success(review.status === 'PAID' ? 'Marked as paid' : 'Marked as failed');
      setReview(null);
      onChanged();
    } catch (err) {
      toast.error('Could not update', errorMessage(err));
    } finally {
      setReviewing(false);
    }
  };

  if (!payable) {
    return (
      <section className="card p-5">
        <h3 className="flex items-center gap-2 text-sm font-bold text-fg">
          <CreditCard className="h-4 w-4 text-lime" /> Payments
        </h3>
        <p className="mt-2 text-sm text-muted">
          {pool.status === 'LOCKED'
            ? 'The host is placing the retailer order. Once they record the real bill, your exact share (items + proportional fees) appears here.'
            : 'Payment opens after the host locks the cart and records the retailer order.'}
        </p>
        {breakdown && breakdown.splits.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-faint">Provisional split based on current items{pool.deliveryFee ? ` and an expected ${money(pool.deliveryFee)} delivery fee` : ''}:</p>
            <BreakdownTable breakdown={breakdown} records={records} viewerId={viewer.userId} participants={pool.participants} />
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="card space-y-5 p-5" aria-labelledby="payments-heading">
      <div className="flex items-center justify-between gap-3">
        <h3 id="payments-heading" className="flex items-center gap-2 text-sm font-bold text-fg">
          <CreditCard className="h-4 w-4 text-lime" /> Payments
        </h3>
        {config && (
          <span className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-faint">
            <ShieldCheck className="h-3 w-3" />
            {razorpayAvailable ? (config.testMode ? 'Razorpay · test mode' : 'Razorpay') : 'Manual UPI · host-verified'}
          </span>
        )}
      </div>

      {/* ----- Participant: my share ----- */}
      {viewer.isParticipant && !viewer.isHost && myRecord && (
        <div className="rounded-2xl border border-lime/30 bg-lime/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-lime">Your share</p>
              <p className="mt-1 text-3xl font-extrabold text-fg">{money(myRecord.totalDue)}</p>
              <p className="mt-1 text-xs text-muted">
                {money(myRecord.itemSubtotal)} items + {money(myRecord.allocatedFee)} share of fees
              </p>
            </div>
            <PaymentBadge status={myRecord.paymentStatus} />
          </div>

          {myRecord.paymentStatus === 'PAID' ? (
            <div className="mt-4 rounded-xl border border-line bg-surface p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-lime">
                <CheckCircle2 className="h-4 w-4" /> Paid {myRecord.paidAt ? formatDateTime(myRecord.paidAt) : ''}
              </p>
              {myRecord.paymentMethod === 'RAZORPAY' ? (
                <dl className="mt-2 space-y-1 font-mono text-muted">
                  <div className="flex justify-between gap-3">
                    <dt>Payment ID</dt>
                    <dd className="flex items-center gap-1 truncate text-fg">
                      {myRecord.razorpayPaymentId}
                      <button onClick={() => void copy(myRecord.razorpayPaymentId || '')} aria-label="Copy payment id" className="text-faint hover:text-fg">
                        <Copy className="h-3 w-3" />
                      </button>
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Order ID</dt>
                    <dd className="truncate text-fg">{myRecord.razorpayOrderId}</dd>
                  </div>
                  {myRecord.providerConfirmedAt && <p className="pt-1 font-sans text-[11px] text-faint">Confirmed by Razorpay · signature verified on the server.</p>}
                </dl>
              ) : (
                <p className="mt-1 text-muted">
                  Manual UPI reference <span className="font-mono text-fg">{myRecord.paymentReference}</span> confirmed by the host.
                </p>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {myRecord.paymentStatus === 'FAILED' && myRecord.failureReason && <Alert kind="danger">{myRecord.failureReason}</Alert>}
              {myRecord.paymentStatus === 'PROCESSING' && myRecord.paymentMethod === 'MANUAL_UPI' && (
                <Alert kind="info" title="Waiting for the host">
                  You submitted reference <span className="font-mono text-fg">{myRecord.paymentReference}</span>. The host confirms it after checking their UPI app.
                </Alert>
              )}
              {myRecord.paymentStatus === 'PROCESSING' && myRecord.paymentMethod === 'RAZORPAY' && (
                <Alert kind="info" title="Confirming with Razorpay">
                  Your payment is being confirmed. This updates automatically when Razorpay's webhook arrives. If checkout was closed early, you can pay again — the same order is reused.
                </Alert>
              )}

              {razorpayAvailable && (
                <Button block size="lg" loading={paying || verifying} onClick={() => void payWithRazorpay()} icon={<CreditCard className="h-4 w-4" />}>
                  {verifying ? 'Verifying payment…' : `Pay ${money(myRecord.totalDue)} with Razorpay`}
                </Button>
              )}

              {(!razorpayAvailable || showManual) && (
                <form onSubmit={submitReference} className="space-y-3 rounded-xl border border-line bg-surface p-4">
                  <p className="text-xs font-semibold text-fg">Pay the host directly, then submit the UPI reference</p>
                  {pool.upiId ? (
                    <p className="flex items-center gap-2 text-sm">
                      <span className="text-muted">Host UPI:</span>
                      <span className="font-mono font-semibold text-fg">{pool.upiId}</span>
                      <button type="button" onClick={() => void copy(pool.upiId || '')} className="text-faint hover:text-fg" aria-label="Copy UPI id">
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-muted">The host hasn't shared a UPI ID — ask them for payment details.</p>
                  )}
                  {pool.paymentInstructions && <p className="text-xs text-muted">{pool.paymentInstructions}</p>}
                  <Input label="UPI transaction reference (UTR)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. 3290XXXXXXXX" maxLength={100} className="font-mono" />
                  <Button type="submit" variant="secondary" block loading={submittingRef} icon={<Receipt className="h-4 w-4" />}>
                    Submit reference for host verification
                  </Button>
                  <p className="flex items-start gap-1.5 text-[11px] text-faint">
                    <Info className="mt-0.5 h-3 w-3 shrink-0" /> NightOwl cannot verify UPI transfers itself. Your status becomes “Paid” only when the host confirms receipt.
                  </p>
                </form>
              )}
              {razorpayAvailable && !showManual && (
                <button onClick={() => setShowManual(true)} className="w-full text-center text-xs font-semibold text-muted hover:text-fg">
                  Paid the host directly? Submit a UPI reference instead
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ----- Host: who owes what ----- */}
      {viewer.isHost && (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-fg">Participants</p>
            <p className="text-xs text-muted">
              Outstanding: <span className="font-mono font-bold text-warn">{money(outstandingBalance)}</span>
            </p>
          </div>
          <ul className="space-y-2">
            {records
              .filter((r) => userId(r.userId) !== viewer.userId)
              .map((r) => (
                <li key={r._id} className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={userName(r.userId)} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-fg">{userName(r.userId)}</p>
                      <p className="text-xs text-muted">
                        {money(r.itemSubtotal)} + {money(r.allocatedFee)} fees ={' '}
                        <span className="font-mono font-semibold text-fg">{money(r.totalDue)}</span>
                      </p>
                      {r.paymentMethod === 'RAZORPAY' && r.razorpayPaymentId && <p className="font-mono text-[11px] text-faint">{r.razorpayPaymentId}</p>}
                      {r.paymentMethod === 'MANUAL_UPI' && r.paymentReference && <p className="font-mono text-[11px] text-faint">UTR {r.paymentReference}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PaymentBadge status={r.paymentStatus} />
                    {r.paymentMethod === 'MANUAL_UPI' && r.paymentStatus === 'PROCESSING' && (
                      <>
                        <Button size="sm" onClick={() => setReview({ record: r, status: 'PAID' })}>
                          Confirm
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => setReview({ record: r, status: 'FAILED' })}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            {records.filter((r) => userId(r.userId) !== viewer.userId).length === 0 && <li className="text-sm text-muted">No other participants added items.</li>}
          </ul>
          {records.some((r) => userId(r.userId) === viewer.userId) && (
            <p className="mt-3 text-xs text-faint">Your own items ({money(records.find((r) => userId(r.userId) === viewer.userId)?.totalDue)}) are not collected through NightOwl.</p>
          )}
        </div>
      )}

      {/* ----- Everyone: transparent breakdown ----- */}
      {breakdown && (
        <details className="group" open={viewer.isHost}>
          <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-fg">How the {money(breakdown.finalPayableAmount)} total is split</summary>
          <div className="mt-3 space-y-2">
            <BreakdownTable breakdown={breakdown} records={records} viewerId={viewer.userId} participants={pool.participants} />
            <p className="text-[11px] text-faint">
              {breakdown.allocationMethod}. Delivery {money(breakdown.deliveryFee)} · other charges {money(breakdown.otherCharges)}
              {pool.actualRetailerMinimum ? ` · retailer minimum recorded as ${money(pool.actualRetailerMinimum)}` : ''}.
            </p>
          </div>
        </details>
      )}

      {/* Other participants' status (non-sensitive) */}
      {viewer.isParticipant && !viewer.isHost && records.length > 1 && (
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Everyone's status</p>
          <ul className="flex flex-wrap gap-2">
            {records.map((r) => (
              <li key={r._id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs">
                <span className="font-medium text-fg">{userId(r.userId) === viewer.userId ? 'You' : userName(r.userId).split(' ')[0]}</span>
                <span className={cx('text-[10px] font-bold', r.paymentStatus === 'PAID' ? 'text-lime' : 'text-faint')}>{payLabels[r.paymentStatus]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(review)}
        onClose={() => setReview(null)}
        onConfirm={doReview}
        loading={reviewing}
        danger={review?.status === 'FAILED'}
        title={review?.status === 'PAID' ? 'Confirm you received this payment?' : 'Reject this payment reference?'}
        confirmLabel={review?.status === 'PAID' ? 'Yes, I received it' : 'Reject'}
        description={
          review ? (
            <>
              {userName(review.record.userId)} · {money(review.record.totalDue)} · reference <span className="font-mono text-fg">{review.record.paymentReference}</span>
              <br />
              <span className="text-xs">Check your UPI app first. This is recorded in the pool's audit trail.</span>
            </>
          ) : null
        }
      />
    </section>
  );
};
