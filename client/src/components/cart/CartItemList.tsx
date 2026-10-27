import React from 'react';
import { Pencil, Trash2, ShoppingBag } from 'lucide-react';
import { PoolItem, userId, userName } from '../../types/index.js';
import { Avatar, EmptyState } from '../ui/Bits.js';
import { money, cx } from '../../utils/format.js';

interface Props {
  items: PoolItem[];
  currentUserId: string;
  isHost: boolean;
  editable: boolean;
  onEdit: (item: PoolItem) => void;
  onDelete: (item: PoolItem) => void;
}

export const CartItemList: React.FC<Props> = ({ items, currentUserId, isHost, editable, onEdit, onDelete }) => {
  if (items.length === 0) {
    return <EmptyState icon={<ShoppingBag className="h-7 w-7" />} title="The cart is empty" description="Add the first item — everyone in the pool sees it instantly." className="py-10" />;
  }

  // Group by participant so contributions are obvious.
  const groups = new Map<string, { name: string; items: PoolItem[]; subtotal: number }>();
  for (const it of items) {
    const id = userId(it.userId);
    const g = groups.get(id) || { name: userName(it.userId), items: [], subtotal: 0 };
    g.items.push(it);
    g.subtotal = Math.round((g.subtotal + it.itemSubtotal) * 100) / 100;
    groups.set(id, g);
  }
  const ordered = Array.from(groups.entries()).sort(([a], [b]) => (a === currentUserId ? -1 : b === currentUserId ? 1 : 0));

  return (
    <div className="space-y-4">
      {ordered.map(([id, g]) => {
        const mine = id === currentUserId;
        return (
          <div key={id} className={cx('rounded-2xl border p-3 sm:p-4', mine ? 'border-lime/30 bg-lime/5' : 'border-line bg-surface')}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Avatar name={g.name} size="sm" />
                <div>
                  <p className="text-sm font-bold text-fg">
                    {mine ? 'You' : g.name}
                    <span className="ml-1.5 text-xs font-medium text-faint">
                      · {g.items.length} item{g.items.length === 1 ? '' : 's'}
                    </span>
                  </p>
                </div>
              </div>
              <span className="font-mono text-sm font-bold text-fg">{money(g.subtotal)}</span>
            </div>
            <ul className="mt-3 divide-y divide-line/70">
              {g.items.map((it) => {
                const canEdit = editable && mine;
                const canDelete = editable && (mine || isHost);
                return (
                  <li key={it._id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-fg">
                        {it.name} <span className="text-faint">× {it.quantity}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {money(it.unitPrice)} each{it.note ? ` · ${it.note}` : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <span className="font-mono text-sm text-fg">{money(it.itemSubtotal)}</span>
                      {canEdit && (
                        <button onClick={() => onEdit(it)} className="rounded-md p-1.5 text-faint hover:bg-overlay hover:text-fg" aria-label={`Edit ${it.name}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button onClick={() => onDelete(it)} className="rounded-md p-1.5 text-faint hover:bg-danger/10 hover:text-danger" aria-label={`Remove ${it.name}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
};
