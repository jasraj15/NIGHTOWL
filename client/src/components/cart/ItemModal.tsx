import React, { useEffect, useState } from 'react';
import { PoolItem } from '../../types/index.js';
import { Modal } from '../ui/Modal.js';
import { Button } from '../ui/Button.js';
import { Input, Textarea } from '../ui/Field.js';
import { money } from '../../utils/format.js';

interface ItemModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; quantity: number; unitPrice: number; note?: string }) => Promise<void>;
  item?: PoolItem | null;
  contributionCap?: number;
  mySubtotalExcludingThis?: number;
}

export const ItemModal: React.FC<ItemModalProps> = ({ open, onClose, onSubmit, item, contributionCap, mySubtotalExcludingThis = 0 }) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitPrice, setUnitPrice] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(item?.name || '');
    setQuantity(String(item?.quantity || 1));
    setUnitPrice(item ? String(item.unitPrice) : '');
    setNote(item?.note || '');
    setErrors({});
  }, [open, item]);

  const qty = parseInt(quantity, 10);
  const price = Number(unitPrice);
  const subtotal = Number.isFinite(qty) && Number.isFinite(price) ? Math.round(qty * price * 100) / 100 : 0;
  const projected = mySubtotalExcludingThis + subtotal;
  const overCap = contributionCap ? projected > contributionCap : false;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!name.trim()) er.name = 'Item name is required';
    if (!(Number.isInteger(qty) && qty >= 1 && qty <= 99)) er.quantity = 'Quantity must be 1–99';
    if (!(price >= 1 && price <= 25000)) er.unitPrice = 'Enter the unit price (₹1 – ₹25,000)';
    if (overCap) er.unitPrice = `This would take you over the ₹${contributionCap} per-person cap`;
    setErrors(er);
    if (Object.keys(er).length) return;
    setSaving(true);
    try {
      await onSubmit({ name: name.trim(), quantity: qty, unitPrice: price, note: note.trim() || undefined });
      onClose();
    } catch (err: any) {
      setErrors({ form: err?.message || 'Could not save item' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item ? 'Edit item' : 'Add an item'}
      description="Enter the price shown in the retailer app. Totals are calculated on the server."
      size="sm"
      footer={
        <>
          <Button variant="ghost" type="button" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" form="item-form" loading={saving}>
            {item ? 'Save changes' : 'Add to cart'}
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
        <Input label="Item name" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Lays Magic Masala (big pack)" maxLength={100} error={errors.name} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Quantity" required type="number" inputMode="numeric" min={1} max={99} value={quantity} onChange={(e) => setQuantity(e.target.value)} error={errors.quantity} />
          <Input label="Unit price (₹)" required type="number" inputMode="decimal" min={1} step="0.01" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="40" error={errors.unitPrice} />
        </div>
        <Textarea label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Chilled, please · any flavour is fine" maxLength={150} className="min-h-[64px]" />
        <div className="flex items-center justify-between rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm">
          <span className="text-muted">Item subtotal</span>
          <span className="font-mono font-bold text-fg">{money(subtotal)}</span>
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
