import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Info, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { get, post, errorMessage, ApiError } from '../services/api.js';
import { COUNTDOWN_PRESETS, DraftItem, HOSTELS, Pool, PoolDraft, RETAILERS, RetailerType, HostelType } from '../types/index.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select, Textarea, Checkbox } from '../components/ui/Field.js';
import { Alert, PageHeader } from '../components/ui/Bits.js';
import { money, cx } from '../utils/format.js';

const MIN_DURATION = 5;
const MAX_DURATION = 180;

interface FormState {
  title: string;
  retailer: RetailerType;
  retailerCustomName: string;
  hostel: HostelType;
  deliveryZone: string;
  deliveryConfirmed: boolean;
  targetAmount: string;
  contributionCap: string;
  participantLimit: string;
  durationPreset: string; // minutes or 'custom'
  customDuration: string;
  notes: string;
  expectedDeliveryFee: string;
  feeNotes: string;
}

export const CreatePoolPage: React.FC = () => {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const duplicateFrom = params.get('duplicate');

  const [form, setForm] = useState<FormState>({
    title: '',
    retailer: 'Blinkit',
    retailerCustomName: '',
    hostel: user?.hostel || 'Uniworld 1',
    deliveryZone: '',
    deliveryConfirmed: false,
    targetAmount: '',
    contributionCap: '',
    participantLimit: '8',
    durationPreset: '20',
    customDuration: '',
    notes: '',
    expectedDeliveryFee: '',
    feeNotes: '',
  });
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingDraft, setLoadingDraft] = useState(Boolean(duplicateFrom));

  // Duplicate a previous order into a fresh draft (never touches the original).
  useEffect(() => {
    if (!duplicateFrom) return;
    (async () => {
      try {
        const res = await get<{ draft: PoolDraft; items: DraftItem[] }>(`/pools/${duplicateFrom}/duplicate-draft`);
        const d = res.draft;
        setForm((f) => ({
          ...f,
          title: d.title,
          retailer: d.retailer,
          retailerCustomName: d.retailerCustomName || '',
          hostel: d.hostel,
          deliveryZone: d.deliveryZone,
          targetAmount: String(d.targetAmount),
          contributionCap: d.contributionCap ? String(d.contributionCap) : '',
          participantLimit: String(d.participantLimit),
          durationPreset: COUNTDOWN_PRESETS.includes(d.durationMinutes as any) ? String(d.durationMinutes) : 'custom',
          customDuration: COUNTDOWN_PRESETS.includes(d.durationMinutes as any) ? '' : String(d.durationMinutes),
          notes: d.notes || '',
        }));
        setDraftItems(res.items);
        toast.info('Draft prepared from your previous order', 'Review the details — nothing is saved until you create the pool.');
      } catch (err) {
        toast.error('Could not load the previous order', errorMessage(err));
      } finally {
        setLoadingDraft(false);
      }
    })();
  }, [duplicateFrom]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  const durationMinutes = useMemo(() => (form.durationPreset === 'custom' ? parseInt(form.customDuration, 10) : parseInt(form.durationPreset, 10)), [form]);
  const closesAt = useMemo(() => (Number.isFinite(durationMinutes) ? new Date(Date.now() + durationMinutes * 60000) : null), [durationMinutes]);

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = 'Give the pool a title (at least 3 characters)';
    if (form.retailer === 'Other' && !form.retailerCustomName.trim()) e.retailerCustomName = 'Name the retailer';
    if (form.deliveryZone.trim().length < 2) e.deliveryZone = 'Where will the order be collected?';
    if (!form.deliveryConfirmed) e.deliveryConfirmed = 'Confirm the delivery location is valid for this hostel';
    const target = Number(form.targetAmount);
    if (!(target >= 1 && target <= 50000)) e.targetAmount = 'Enter the retailer minimum (₹1 – ₹50,000)';
    if (form.contributionCap && !(Number(form.contributionCap) >= 1)) e.contributionCap = 'Cap must be at least ₹1';
    const limit = Number(form.participantLimit);
    if (!(Number.isInteger(limit) && limit >= 2 && limit <= 30)) e.participantLimit = 'Between 2 and 30 participants';
    if (!(Number.isInteger(durationMinutes) && durationMinutes >= MIN_DURATION && durationMinutes <= MAX_DURATION))
      e.duration = `Choose between ${MIN_DURATION} and ${MAX_DURATION} minutes`;
    if (form.expectedDeliveryFee && Number(form.expectedDeliveryFee) < 0) e.expectedDeliveryFee = 'Fee cannot be negative';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await post<{ pool: Pool }>('/pools', {
        title: form.title.trim(),
        retailer: form.retailer,
        retailerCustomName: form.retailer === 'Other' ? form.retailerCustomName.trim() : undefined,
        hostel: form.hostel,
        deliveryZone: form.deliveryZone.trim(),
        deliveryConfirmed: true,
        targetAmount: Number(form.targetAmount),
        contributionCap: form.contributionCap ? Number(form.contributionCap) : undefined,
        participantLimit: Number(form.participantLimit),
        durationMinutes,
        notes: form.notes.trim() || undefined,
        expectedDeliveryFee: form.expectedDeliveryFee ? Number(form.expectedDeliveryFee) : undefined,
        feeNotes: form.feeNotes.trim() || undefined,
      });
      const pool = res.pool;
      // Add duplicated items (owner is already a participant).
      let added = 0;
      for (const it of draftItems) {
        try {
          await post(`/pools/${pool._id}/items`, it);
          added++;
        } catch {
          /* report below */
        }
      }
      toast.success('Pool created', added ? `${added} item${added === 1 ? '' : 's'} carried over from your previous order.` : `Closes at ${pool.closingTime ? new Date(pool.closingTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}`);
      navigate(`/pools/${pool._id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && err.data?.details?.length) {
        const fieldErrors: Record<string, string> = {};
        for (const d of err.data.details) if (d.path) fieldErrors[String(d.path)] = d.message;
        setErrors((prev) => ({ ...prev, ...fieldErrors }));
      }
      setServerError(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to discover
      </Link>
      <div className="mt-4">
        <PageHeader eyebrow="New pool" title="Start a group order" description="You'll be the host: you lock the cart, place the retailer order yourself, and record the real bill so everyone pays their exact share." />
      </div>

      {loadingDraft ? (
        <div className="card mt-6 p-8 text-center text-sm text-muted">Preparing your draft…</div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
          {serverError && <Alert kind="danger">{serverError}</Alert>}

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-bold text-fg">What & where</h2>
            <Input label="Pool title" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Late-night Maggi run · Tower B" maxLength={100} error={errors.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Retailer" required value={form.retailer} onChange={(e) => set('retailer', e.target.value as RetailerType)} options={RETAILERS.map((r) => ({ value: r, label: r }))} />
              {form.retailer === 'Other' ? (
                <Input label="Retailer name" required value={form.retailerCustomName} onChange={(e) => set('retailerCustomName', e.target.value)} placeholder="e.g. Swiggy Instamart" error={errors.retailerCustomName} />
              ) : (
                <Select label="Delivery hostel" required value={form.hostel} onChange={(e) => set('hostel', e.target.value as HostelType)} options={HOSTELS.map((h) => ({ value: h, label: h }))} />
              )}
            </div>
            {form.retailer === 'Other' && (
              <Select label="Delivery hostel" required value={form.hostel} onChange={(e) => set('hostel', e.target.value as HostelType)} options={HOSTELS.map((h) => ({ value: h, label: h }))} />
            )}
            <Input
              label="Confirmed delivery location / pickup spot"
              required
              value={form.deliveryZone}
              onChange={(e) => set('deliveryZone', e.target.value)}
              placeholder="e.g. Tower B lobby, near the guard desk"
              maxLength={100}
              error={errors.deliveryZone}
              hint="Participants collect their items here. Be specific — the retailer rider needs one address."
            />
            <Checkbox
              checked={form.deliveryConfirmed}
              onChange={(e) => set('deliveryConfirmed', e.target.checked)}
              error={errors.deliveryConfirmed}
              label={
                <>
                  I've checked that <span className="font-semibold text-fg">{form.retailer === 'Other' ? form.retailerCustomName || 'this retailer' : form.retailer}</span> delivers to{' '}
                  <span className="font-semibold text-fg">{form.hostel}</span> at this location. One retailer address can't serve both hostels.
                </>
              }
            />
            <Textarea label="Notes for participants (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Cash not accepted · I'll wait at the lobby for 10 min after delivery" maxLength={300} />
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-bold text-fg">Target & limits</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Minimum order value (₹)"
                required
                type="number"
                inputMode="decimal"
                min={1}
                value={form.targetAmount}
                onChange={(e) => set('targetAmount', e.target.value)}
                placeholder="300"
                error={errors.targetAmount}
                hint="The retailer's minimum for this address."
              />
              <Input label="Max participants" type="number" inputMode="numeric" min={2} max={30} value={form.participantLimit} onChange={(e) => set('participantLimit', e.target.value)} error={errors.participantLimit} />
              <Input label="Per-person cap (₹, optional)" type="number" inputMode="decimal" min={1} value={form.contributionCap} onChange={(e) => set('contributionCap', e.target.value)} placeholder="None" error={errors.contributionCap} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Expected delivery fee (₹, optional)"
                type="number"
                inputMode="decimal"
                min={0}
                value={form.expectedDeliveryFee}
                onChange={(e) => set('expectedDeliveryFee', e.target.value)}
                placeholder="0"
                error={errors.expectedDeliveryFee}
                hint="Only if you know it. The real fee is recorded when you place the order."
              />
              <Input label="Fee notes (optional)" value={form.feeNotes} onChange={(e) => set('feeNotes', e.target.value)} placeholder="e.g. surge fee likely after 1 am" maxLength={200} />
            </div>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-fg">Countdown</h2>
              {closesAt && Number.isFinite(durationMinutes) && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Clock className="h-3.5 w-3.5 text-lime" /> closes ≈ {closesAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
            <div role="radiogroup" aria-label="Pool duration" className="flex flex-wrap gap-2">
              {COUNTDOWN_PRESETS.map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={form.durationPreset === String(m)}
                  onClick={() => set('durationPreset', String(m))}
                  className={cx('chip', form.durationPreset === String(m) ? 'border-lime bg-lime text-lime-ink' : 'border-line bg-surface text-muted hover:text-fg')}
                >
                  {m} min
                </button>
              ))}
              <button
                type="button"
                role="radio"
                aria-checked={form.durationPreset === 'custom'}
                onClick={() => set('durationPreset', 'custom')}
                className={cx('chip', form.durationPreset === 'custom' ? 'border-lime bg-lime text-lime-ink' : 'border-line bg-surface text-muted hover:text-fg')}
              >
                Custom
              </button>
            </div>
            {form.durationPreset === 'custom' && (
              <Input label={`Custom duration (${MIN_DURATION}–${MAX_DURATION} minutes)`} type="number" inputMode="numeric" min={MIN_DURATION} max={MAX_DURATION} value={form.customDuration} onChange={(e) => set('customDuration', e.target.value)} wrapClassName="max-w-xs" />
            )}
            {errors.duration && (
              <p role="alert" className="text-xs font-medium text-danger">
                {errors.duration}
              </p>
            )}
            <p className="flex items-start gap-2 text-xs text-faint">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The countdown starts from the server's clock when the pool is created. If it expires before the target is met, you can extend it, cancel it, or proceed after confirming the retailer's real requirement.
            </p>
          </section>

          {draftItems.length > 0 && (
            <section className="card space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-fg">Items carried over</h2>
                <span className="text-xs text-muted">{money(draftItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0))} total</span>
              </div>
              <ul className="divide-y divide-line">
                {draftItems.map((it, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="text-fg">
                      {it.name} <span className="text-faint">× {it.quantity}</span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="font-mono text-muted">{money(it.quantity * it.unitPrice)}</span>
                      <button type="button" onClick={() => setDraftItems((d) => d.filter((_, i) => i !== idx))} className="rounded-md p-1 text-faint hover:text-danger" aria-label={`Remove ${it.name}`}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-faint">These are added to the new pool as your items after it is created. The original order is not modified.</p>
            </section>
          )}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => navigate(-1)}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={submitting} icon={<Plus className="h-4 w-4" />}>
              Create pool
            </Button>
          </div>
        </form>
      )}
    </div>
  );
};
