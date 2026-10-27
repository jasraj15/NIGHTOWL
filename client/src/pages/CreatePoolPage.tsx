import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Clock, Info, Plus, Trash2, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext.js';
import { useToast } from '../context/ToastContext.js';
import { get, post, errorMessage, ApiError } from '../services/api.js';
import { COUNTDOWN_PRESETS, DraftItem, Pool, PoolDraft, RETAILERS, RetailerType } from '../types/index.js';
import { Button } from '../components/ui/Button.js';
import { Input, Select, Textarea, Checkbox } from '../components/ui/Field.js';
import { Alert, PageHeader, HostelBadge, Progress } from '../components/ui/Bits.js';
import { money, cx } from '../utils/format.js';

const MIN_DURATION = 5;
const MAX_DURATION = 180;

interface FormState {
  title: string;
  retailer: RetailerType;
  retailerCustomName: string;
  deliveryZone: string;
  deliveryConfirmed: boolean;
  targetAmount: string;
  initialItemsAmount: string;
  durationPreset: string; // minutes or 'custom'
  customDuration: string;
  notes: string;
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
    deliveryZone: '',
    deliveryConfirmed: false,
    targetAmount: '',
    initialItemsAmount: '',
    durationPreset: '20',
    customDuration: '',
    notes: '',
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
          deliveryZone: d.deliveryZone,
          targetAmount: String(d.targetAmount),
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

  const target = Number(form.targetAmount) || 0;
  const mine = Number(form.initialItemsAmount) || 0;
  const draftTotal = draftItems.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const alreadyIn = Math.round((mine + draftTotal) * 100) / 100;
  const remaining = Math.max(0, Math.round((target - alreadyIn) * 100) / 100);
  const progress = target > 0 ? Math.min(100, Math.round((alreadyIn / target) * 100)) : 0;

  const validate = () => {
    const e: Record<string, string> = {};
    if (form.title.trim().length < 3) e.title = 'Give the pool a title (at least 3 characters)';
    if (form.retailer === 'Other' && !form.retailerCustomName.trim()) e.retailerCustomName = 'Name the retailer';
    if (form.deliveryZone.trim().length < 2) e.deliveryZone = 'Where should people meet you to collect their stuff?';
    if (!form.deliveryConfirmed) e.deliveryConfirmed = 'Please confirm the meeting spot';
    if (!(target >= 1 && target <= 50000)) e.targetAmount = 'Enter the amount needed for free delivery (₹1 – ₹50,000)';
    if (form.initialItemsAmount && !(mine >= 0 && mine <= 50000)) e.initialItemsAmount = 'Enter a valid amount';
    if (mine > target && target > 0) e.initialItemsAmount = 'Your items already exceed the minimum — you can order on your own!';
    if (!(Number.isInteger(durationMinutes) && durationMinutes >= MIN_DURATION && durationMinutes <= MAX_DURATION))
      e.duration = `Choose between ${MIN_DURATION} and ${MAX_DURATION} minutes`;
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
        deliveryZone: form.deliveryZone.trim(),
        deliveryConfirmed: true,
        targetAmount: target,
        initialItemsAmount: mine > 0 ? mine : undefined,
        durationMinutes,
        notes: form.notes.trim() || undefined,
      });
      const pool = res.pool;
      let added = 0;
      for (const it of draftItems) {
        try {
          await post(`/pools/${pool._id}/items`, it);
          added++;
        } catch {
          /* reported via toast below */
        }
      }
      toast.success('Pool created', added ? `${added} item${added === 1 ? '' : 's'} carried over from your previous order.` : `Closes at ${new Date(pool.closingTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`);
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

  const retailerName = form.retailer === 'Other' ? form.retailerCustomName || 'the retailer' : form.retailer;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link to="/dashboard" className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-4 w-4" /> Back to discover
      </Link>
      <div className="mt-4">
        <PageHeader
          eyebrow="New pool"
          title="Start a group order"
          description="Tell your hostel what you're ordering and how much is still needed for free delivery. Others add their items until the gap is filled."
        />
      </div>

      {loadingDraft ? (
        <div className="card mt-6 p-8 text-center text-sm text-muted">Preparing your draft…</div>
      ) : (
        <form onSubmit={submit} className="mt-6 space-y-6" noValidate>
          {serverError && <Alert kind="danger">{serverError}</Alert>}

          <section className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-fg">What & where</h2>
              {user && <HostelBadge hostel={user.hostel} />}
            </div>
            <Input label="Pool title" required value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Late-night chips & Coke run" maxLength={100} error={errors.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="Retailer" required value={form.retailer} onChange={(e) => set('retailer', e.target.value as RetailerType)} options={RETAILERS.map((r) => ({ value: r, label: r }))} />
              {form.retailer === 'Other' ? (
                <Input label="Retailer name" required value={form.retailerCustomName} onChange={(e) => set('retailerCustomName', e.target.value)} placeholder="e.g. Dunzo" error={errors.retailerCustomName} />
              ) : (
                <Input label="Delivering to" value={user?.hostel || ''} readOnly hint="Your hostel from onboarding. Change it in Settings if you've moved." />
              )}
            </div>
            <Input
              label="Where should people collect their stuff?"
              required
              value={form.deliveryZone}
              onChange={(e) => set('deliveryZone', e.target.value)}
              placeholder="Meet at reception · front gate · near the lift on floor 3"
              maxLength={100}
              error={errors.deliveryZone}
            />
            <Checkbox
              checked={form.deliveryConfirmed}
              onChange={(e) => set('deliveryConfirmed', e.target.checked)}
              error={errors.deliveryConfirmed}
              label={
                <>
                  I'll be at this spot when the <span className="font-semibold text-fg">{retailerName}</span> order arrives so people can collect their items.
                </>
              }
            />
            <Textarea label="Note for participants (optional)" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Ping me on WhatsApp when you add items · I'll wait at the gate for 10 min" maxLength={300} />
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <h2 className="font-bold text-fg">How much is needed?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Minimum order for free delivery (₹)"
                required
                type="number"
                inputMode="decimal"
                min={1}
                value={form.targetAmount}
                onChange={(e) => set('targetAmount', e.target.value)}
                placeholder="300"
                error={errors.targetAmount}
                hint={`Check ${retailerName}'s app — the free-delivery threshold for our address.`}
              />
              <Input
                label="Your items so far (₹)"
                type="number"
                inputMode="decimal"
                min={0}
                value={form.initialItemsAmount}
                onChange={(e) => set('initialItemsAmount', e.target.value)}
                placeholder="120"
                error={errors.initialItemsAmount}
                hint="The value of what's already in your cart. It becomes your first line in the shared cart."
              />
            </div>

            <div className={cx('rounded-2xl p-4 transition-colors', target > 0 ? 'bg-sun' : 'bg-overlay')}>
              {target > 0 ? (
                <>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">Others need to add</p>
                      <p className="display text-3xl font-black text-fg">{remaining <= 0 ? 'Nothing — you’re there!' : money(remaining)}</p>
                    </div>
                    <p className="text-right text-xs text-muted">
                      {money(alreadyIn)} in · target {money(target)}
                    </p>
                  </div>
                  <Progress value={progress} className="mt-3 h-2.5 bg-white/60" label="Progress toward free delivery" />
                  <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                    <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" /> This is what your hostel sees on the pool card. Anyone can join and add items until it hits zero.
                  </p>
                </>
              ) : (
                <p className="flex items-start gap-1.5 text-xs text-muted">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Enter the minimum to see how much others need to add.
                </p>
              )}
            </div>
          </section>

          <section className="card space-y-4 p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-fg">Countdown</h2>
              {closesAt && Number.isFinite(durationMinutes) && (
                <span className="inline-flex items-center gap-1.5 text-xs text-muted">
                  <Clock className="h-3.5 w-3.5" /> closes ≈ {closesAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
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
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> The countdown starts from the server's clock when the pool is created. If it runs out before the gap is filled, you can extend it, cancel it, or go ahead anyway.
            </p>
          </section>

          {draftItems.length > 0 && (
            <section className="card space-y-3 p-5 sm:p-6">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-fg">Items carried over</h2>
                <span className="text-xs text-muted">{money(draftTotal)} total</span>
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
