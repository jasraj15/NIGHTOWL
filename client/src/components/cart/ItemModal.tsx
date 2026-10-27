import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { PoolItem } from '../../types/index.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input, Textarea } from '../ui/Field.js';
import { money, cx } from '../../utils/format.js';

export interface ItemInput {
  name: string;
  quantity: number;
  unitPrice: number;
  note?: string;
}

interface Row {
  id: number;
  name: string;
  quantity: string;
  unitPrice: string;
}

interface ItemModalProps {
  open: boolean;
  onClose: () => void;
  /** Called once per item; the modal adds them one after another. */
  onSubmit: (data: ItemInput) => Promise<void>;
  /** Fired once after all rows were saved successfully (not on cancel). */
  onAdded?: (count: number) => void;
  /** When set, the modal edits this single item instead of adding new ones. */
  item?: PoolItem | null;
  contributionCap?: number;
  mySubtotalExcludingThis?: number;
}

let rowId = 0;
const blankRow = (): Row => ({ id: ++rowId, name: '', quantity: '1', unitPrice: '' });

const rowSubtotal = (r: Row) => {
  const q = parseInt(r.quantity, 10);
  const p = Number(r.unitPrice);
  return Number.isFinite(q) && Number.isFinite(p) ? Math.round(q * p * 100) / 100 : 0;
};

export const ItemModal: React.FC<ItemModalProps> = ({ open, onClose, onSubmit, onAdded, item, contributionCap, mySubtotalExcludingThis = 0 }) => {
  const editing = Boolean(item);
  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(item ? [{ id: ++rowId, name: item.name, quantity: String(item.quantity), unitPrice: String(item.unitPrice) }] : [blankRow()]);
    setNote(item?.note || '');
    setErrors({});
    setProgress(null);
  }, [open, item]);

  const update = (id: number, patch: Partial<Row>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const addRow = () => setRows((rs) => [...rs, blankRow()]);
  const removeRow = (id: number) => setRows((rs) => (rs.length === 1 ? rs : rs.filter((r) => r.id !== id)));

  const filled = rows.filter((r) => r.name.trim() || r.unitPrice);
  const total = filled.reduce((s, r) => s + rowSubtotal(r), 0);
  const projected = mySubtotalExcludingThis + total;
  const overCap = contributionCap ? projected > contributionCap : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    const toSave = editing ? rows : filled;
    if (toSave.length === 0) er.form = 'Add at least one item';
    toSave.forEach((r) => {
      const q = parseInt(r.quantity, 10);
      const p = Number(r.unitPrice);
      if (!r.name.trim()) er[`name-${r.id}`] = 'Name';
      if (!(Number.isInteger(q) && q >= 1 && q <= 99)) er[`qty-${r.id}`] = '1–99';
      if (!(p >= 1 && p <= 25000)) er[`price-${r.id}`] = '₹1+';
    });
    if (overCap) er.form = `This would take you over the ₹${contributionCap} per-person cap`;
    setErrors(er);
    if (Object.keys(er).length) return;

    setSaving(true);
    let done = 0;
    try {
      for (const r of toSave) {
        setProgress({ done, total: toSave.length });
        await onSubmit({ name: r.name.trim(), quantity: parseInt(r.quantity, 10), unitPrice: Number(r.unitPrice), note: note.trim() || undefined });
        done++;
        // Drop rows that were saved so a mid-way failure leaves only the unsaved ones in the form.
        setRows((rs) => rs.filter((x) => x.id !== r.id));
      }
      onAdded?.(done);
      onClose();
    } catch (err: any) {
      setErrors({ form: `${err?.message || 'Could not save item'}${done ? ` (${done} of ${toSave.length} added — the rest are still below)` : ''}` });
      if (rows.length === done) setRows([blankRow()]);
    } finally {
      setSaving(false);
      setProgress(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? 'Edit item' : 'Add your items'}
      description={editing ? 'Update the details for this line.' : 'List everything you want from this order — one line per item, with the price shown in the retailer app.'}
      size={editing ? 'sm' : 'lg'}
      locked={saving}
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {saving && progress ? `Adding ${progress.done + 1} of ${progress.total}…` : editing ? 'Save changes' : filled.length > 1 ? `Add ${filled.length} items · ${money(total)}` : 'Add to cart'}
          </Button>
        </>
      }
    >
      <form id="item-form" onSubmit={submit} className="space-y-4" noValidate>
        {errors.form && (
          <p role="alert" className="rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
            {errors.form}
          </p>
        )}

        <div className="space-y-2">
          <div className="hidden grid-cols-[1fr_72px_110px_auto] gap-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-faint sm:grid">
            <span>Item</span>
            <span>Qty</span>
            <span>Unit price</span>
            <span className="w-8" />
          </div>
          {rows.map((r, idx) => (
            <div key={r.id} className={cx('grid grid-cols-[1fr_auto] gap-2 rounded-2xl border p-2 sm:grid-cols-[1fr_72px_110px_auto] sm:items-start sm:border-0 sm:p-0', errors[`name-${r.id}`] || errors[`qty-${r.id}`] || errors[`price-${r.id}`] ? 'border-danger/40' : 'border-line')}>
              <Input
                aria-label={`Item ${idx + 1} name`}
                value={r.name}
                onChange={(e) => update(r.id, { name: e.target.value })}
                placeholder={idx === 0 ? 'Lays Magic Masala (big pack)' : idx === 1 ? 'Coke 750ml' : 'Another item'}
                maxLength={100}
                error={errors[`name-${r.id}`]}
                wrapClassName="col-span-2 sm:col-span-1"
                autoFocus={!editing && idx === rows.length - 1 && idx > 0}
              />
              <Input aria-label={`Item ${idx + 1} quantity`} type="number" inputMode="numeric" min={1} max={99} value={r.quantity} onChange={(e) => update(r.id, { quantity: e.target.value })} error={errors[`qty-${r.id}`]} wrapClassName="w-24 sm:w-auto" />
              <Input aria-label={`Item ${idx + 1} unit price`} type="number" inputMode="decimal" min={1} step="0.01" value={r.unitPrice} onChange={(e) => update(r.id, { unitPrice: e.target.value })} placeholder="₹" error={errors[`price-${r.id}`]} wrapClassName="flex-1 sm:w-auto" />
              <div className="flex h-11 items-center justify-end gap-1 sm:justify-start">
                <span className="font-mono text-xs text-muted sm:hidden">{money(rowSubtotal(r))}</span>
                {!editing && (
                  <button type="button" onClick={() => removeRow(r.id)} disabled={rows.length === 1} className="rounded-md p-1.5 text-faint hover:bg-danger/10 hover:text-danger disabled:opacity-30" aria-label={`Remove item ${idx + 1}`}>
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {!editing && (
          <button type="button" onClick={addRow} className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-line-strong/60 px-3.5 py-2 text-sm font-semibold text-fg hover:bg-overlay">
            <Plus className="h-4 w-4" /> Add another item
          </button>
        )}

        <Textarea label={editing ? 'Note (optional)' : 'Note for the host (optional, applies to all items)'} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chilled, please · any flavour is fine" maxLength={150} className="min-h-[64px]" />

        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
          <span className="text-muted">{editing ? 'Item subtotal' : `${filled.length || 0} item${filled.length === 1 ? '' : 's'} · your total`}</span>
          <span className="font-mono font-bold text-fg">{money(total)}</span>
        </div>
        {contributionCap && (
          <p className={overCap ? 'text-xs font-semibold text-danger' : 'text-xs text-faint'}>
            Your total would be {money(projected)} of the {money(contributionCap)} per-person cap.
          </p>
        )}
      </form>
    </Modal>
  );
};
