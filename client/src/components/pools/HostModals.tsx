import React, { useEffect, useMemo, useState } from 'react';
import { Lock, Package, Clock, Flag } from 'lucide-react';
import { Pool, PoolItem, retailerLabel } from '../../types/index.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input, Textarea, Checkbox, Select } from '../ui/Field.js';
import { Alert } from '../ui/Bits.js';
import { money } from '../../utils/format.js';
import { post, errorMessage, ApiError } from '../../services/api.js';

/* ------------------------------- Lock ------------------------------- */

export const LockPoolModal: React.FC<{ open: boolean; onClose: () => void; pool: Pool; items: PoolItem[]; onDone: () => void }> = ({ open, onClose, pool, items, onDone }) => {
  const [confirmBelow, setConfirmBelow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const belowTarget = pool.currentSubtotal < pool.targetAmount;

  useEffect(() => {
    if (open) {
      setConfirmBelow(false);
      setError(null);
    }
  }, [open]);

  const lock = async () => {
    setLoading(true);
    setError(null);
    try {
      await post(`/pools/${pool._id}/lock`, { proceedBelowTargetConfirmed: belowTarget ? confirmBelow : undefined });
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Lock the cart"
      description="Participants can no longer add or edit items. You can reopen it until someone has paid."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void lock()} loading={loading} disabled={belowTarget && !confirmBelow} icon={<Lock className="h-4 w-4" />}>
            Lock cart
          </Button>
        </>
      }
    >
      {error && (
        <Alert kind="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <div className="rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Items</span>
          <span className="font-semibold text-fg">{items.length}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Cart subtotal</span>
          <span className="font-mono font-bold text-fg">{money(pool.currentSubtotal)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-muted">Pool target</span>
          <span className="font-mono text-fg">{money(pool.targetAmount)}</span>
        </div>
      </div>
      {belowTarget ? (
        <div className="mt-4 space-y-3">
          <Alert kind="warn" title={`${money(pool.targetAmount - pool.currentSubtotal)} short of the target`}>
            The target is only your estimate of the retailer's minimum. You can extend the countdown to let more people join, cancel, or proceed if you have checked the real requirement in the {retailerLabel(pool)} app.
          </Alert>
          <Checkbox checked={confirmBelow} onChange={(e) => setConfirmBelow(e.target.checked)} label={<>I've confirmed in the {retailerLabel(pool)} app that this cart can be ordered as-is (minimum order, delivery availability).</>} />
        </div>
      ) : (
        <p className="mt-4 text-xs text-faint">Reaching the pool target does not guarantee the retailer will accept the order — check the app before placing it.</p>
      )}
    </Modal>
  );
};

/* ---------------------------- Order placed ---------------------------- */

export const OrderPlacedModal: React.FC<{ open: boolean; onClose: () => void; pool: Pool; onDone: () => void }> = ({ open, onClose, pool, onDone }) => {
  const [finalPayableAmount, setFinal] = useState('');
  const [actualMin, setActualMin] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [otherCharges, setOther] = useState('');
  const [upiId, setUpi] = useState('');
  const [instructions, setInstructions] = useState('');
  const [reference, setReference] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFinal('');
    setActualMin(String(pool.targetAmount));
    setDeliveryFee(pool.deliveryFee ? String(pool.deliveryFee) : '0');
    setOther('0');
    setUpi(pool.upiId || '');
    setInstructions(pool.paymentInstructions || '');
    setReference('');
    setErrors({});
    setServerError(null);
  }, [open, pool]);

  const computed = useMemo(() => Math.round((pool.currentSubtotal + Number(deliveryFee || 0) + Number(otherCharges || 0)) * 100) / 100, [pool.currentSubtotal, deliveryFee, otherCharges]);
  useEffect(() => {
    if (open && !finalPayableAmount) setFinal(String(computed));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computed, open]);

  const submit = async () => {
    const e: Record<string, string> = {};
    const total = Number(finalPayableAmount);
    if (!(total >= 1)) e.finalPayableAmount = 'Enter the total you were billed';
    if (total < pool.currentSubtotal - 0.009) e.finalPayableAmount = `Cannot be less than the items subtotal (${money(pool.currentSubtotal)})`;
    if (Number(deliveryFee) < 0) e.deliveryFee = 'Cannot be negative';
    if (Number(otherCharges) < 0) e.otherCharges = 'Cannot be negative';
    if (upiId && !/^[\w.\-]{2,}@[a-zA-Z]{2,}$/.test(upiId)) e.upiId = 'Enter a UPI ID like name@bank';
    setErrors(e);
    if (Object.keys(e).length) return;
    setLoading(true);
    setServerError(null);
    try {
      await post(`/pools/${pool._id}/order-placed`, {
        finalPayableAmount: total,
        actualRetailerMinimum: actualMin ? Number(actualMin) : undefined,
        deliveryFee: Number(deliveryFee || 0),
        otherCharges: Number(otherCharges || 0),
        upiId: upiId || '',
        paymentInstructions: instructions || undefined,
        retailerOrderReference: reference || undefined,
      });
      onDone();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.data?.details) {
        const fe: Record<string, string> = {};
        for (const d of err.data.details) if (d.path) fe[String(d.path)] = d.message;
        setErrors(fe);
      }
      setServerError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const extra = Math.round((Number(finalPayableAmount || 0) - pool.currentSubtotal) * 100) / 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Record the retailer order"
      description={`Copy the real figures from your ${retailerLabel(pool)} receipt. Shared fees are split in proportion to each person's items.`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={loading} icon={<Package className="h-4 w-4" />}>
            Confirm order placed
          </Button>
        </>
      }
    >
      {serverError && (
        <Alert kind="danger" className="mb-4">
          {serverError}
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Items subtotal (from NightOwl)" value={money(pool.currentSubtotal)} readOnly className="font-mono" />
        <Input label="Retailer's actual minimum (₹)" type="number" inputMode="decimal" min={0} value={actualMin} onChange={(e) => setActualMin(e.target.value)} hint="What the app required for this address." />
        <Input label="Delivery fee (₹)" type="number" inputMode="decimal" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} error={errors.deliveryFee} />
        <Input label="Platform / handling / other (₹)" type="number" inputMode="decimal" min={0} value={otherCharges} onChange={(e) => setOther(e.target.value)} error={errors.otherCharges} />
        <Input
          label="Final total billed (₹)"
          required
          type="number"
          inputMode="decimal"
          min={1}
          value={finalPayableAmount}
          onChange={(e) => setFinal(e.target.value)}
          error={errors.finalPayableAmount}
          hint={`Items + fees = ${money(computed)}. Edit if your receipt differs (discounts, surge).`}
          className="font-mono"
        />
        <Input label="Retailer order reference (optional)" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Order #" maxLength={60} />
        <Input label="Your UPI ID for manual payments (optional)" value={upiId} onChange={(e) => setUpi(e.target.value)} placeholder="name@upi" error={errors.upiId} hint="Shown to participants only if online payment isn't available." className="font-mono" />
        <Textarea label="Payment / pickup instructions (optional)" value={instructions} onChange={(e) => setInstructions(e.target.value)} maxLength={300} className="min-h-[60px]" wrapClassName="sm:col-span-2" />
      </div>
      <div className="mt-4 rounded-xl border border-line bg-surface p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-muted">Shared fees to split</span>
          <span className="font-mono font-bold text-fg">{money(Math.max(0, extra))}</span>
        </div>
        <p className="mt-1 text-xs text-faint">Split proportionally by item subtotal, rounded to the paisa so the shares add up exactly to the total.</p>
      </div>
    </Modal>
  );
};

/* ------------------------------- Extend ------------------------------- */

export const ExtendPoolModal: React.FC<{ open: boolean; onClose: () => void; pool: Pool; onDone: () => void }> = ({ open, onClose, pool, onDone }) => {
  const [minutes, setMinutes] = useState('15');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const extend = async () => {
    setLoading(true);
    setError(null);
    try {
      await post(`/pools/${pool._id}/extend`, { additionalMinutes: Number(minutes) });
      onDone();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={pool.status === 'EXPIRED' ? 'Revive this pool' : 'Extend the deadline'}
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={() => void extend()} loading={loading} icon={<Clock className="h-4 w-4" />}>
            Extend by {minutes} min
          </Button>
        </>
      }
    >
      {error && (
        <Alert kind="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <Select label="Add time" value={minutes} onChange={(e) => setMinutes(e.target.value)} options={[5, 10, 15, 20, 30, 45, 60].map((m) => ({ value: String(m), label: `${m} minutes` }))} />
      <p className="mt-3 text-xs text-faint">A pool can be extended at most 3 times ({pool.extensionCount || 0} used). Participants are notified of the new closing time.</p>
    </Modal>
  );
};

/* ------------------------------- Report ------------------------------- */

export const ReportModal: React.FC<{ open: boolean; onClose: () => void; pool: Pool; participants: { _id: string; fullName: string }[]; onDone: () => void }> = ({
  open,
  onClose,
  pool,
  participants,
  onDone,
}) => {
  const [reason, setReason] = useState('SUSPICIOUS_PAYMENT');
  const [details, setDetails] = useState('');
  const [reportedUserId, setReported] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (details.trim().length < 5) {
      setError('Please describe the issue (at least 5 characters).');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await post(`/pools/${pool._id}/report`, { reason, details: details.trim(), reportedUserId: reportedUserId || undefined });
      onDone();
      onClose();
      setDetails('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Report a problem"
      description="Reports go to moderators. The host and other participants are not notified."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => void submit()} loading={loading} icon={<Flag className="h-4 w-4" />}>
            Submit report
          </Button>
        </>
      }
    >
      {error && (
        <Alert kind="danger" className="mb-4">
          {error}
        </Alert>
      )}
      <div className="space-y-4">
        <Select
          label="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: 'SUSPICIOUS_PAYMENT', label: 'Suspicious payment claim' },
            { value: 'ABUSIVE_PARTICIPANT', label: 'Abusive participant' },
            { value: 'INAPPROPRIATE_CONTENT', label: 'Inappropriate content' },
            { value: 'OTHER', label: 'Something else' },
          ]}
        />
        <Select label="Who is this about? (optional)" value={reportedUserId} onChange={(e) => setReported(e.target.value)} options={[{ value: '', label: 'The pool in general' }, ...participants.map((p) => ({ value: p._id, label: p.fullName }))]} />
        <Textarea label="What happened?" required value={details} onChange={(e) => setDetails(e.target.value)} maxLength={500} placeholder="Describe the issue with as much detail as you can." />
      </div>
    </Modal>
  );
};
