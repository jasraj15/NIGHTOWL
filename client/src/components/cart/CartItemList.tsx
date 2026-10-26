import React from 'react';
import { Trash2, ShoppingBag } from 'lucide-react';
import { PoolItem } from '../../types/index.js';
import { useAuth } from '../../context/AuthContext.js';

interface CartItemListProps {
  items: PoolItem[];
  isLocked: boolean;
  onDeleteItem: (itemId: string) => void;
  poolCreatorId: string;
}

export const CartItemList: React.FC<CartItemListProps> = ({
  items,
  isLocked,
  onDeleteItem,
  poolCreatorId,
}) => {
  const { user } = useAuth();

  if (items.length === 0) {
    return (
      <div className="text-center py-12 px-4 rounded-2xl bg-navy-850 border border-dashed border-navy-750">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-navy-800 flex items-center justify-center text-ivory-400">
          <ShoppingBag className="w-6 h-6" />
        </div>
        <h4 className="text-base font-bold text-ivory-100">Cart is empty</h4>
        <p className="text-xs text-ivory-400 max-w-sm mx-auto mt-1">
          Be the first to add your snacks or essentials to get this order pool rolling!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item) => {
        const itemUserId =
          typeof item.userId === 'object' && item.userId !== null
            ? item.userId._id
            : item.userId;

        const itemUserName =
          typeof item.userId === 'object' && item.userId !== null
            ? item.userId.fullName
            : 'Hostel Student';

        const isOwnItem = user && user._id === itemUserId;
        const isPoolOwner = user && user._id === poolCreatorId;
        const canDelete = !isLocked && (isOwnItem || isPoolOwner);

        return (
          <div
            key={item._id}
            className="flex items-center justify-between p-3.5 rounded-xl bg-navy-850 hover:bg-navy-800/80 border border-navy-750 transition-colors"
          >
            {/* Left: Name, user tag, note */}
            <div className="space-y-1 min-w-0 pr-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold text-ivory-100 line-clamp-1">
                  {item.name}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    isOwnItem
                      ? 'bg-lime/15 text-lime border border-lime/30'
                      : 'bg-navy-750 text-ivory-300'
                  }`}
                >
                  {isOwnItem ? 'You' : itemUserName}
                </span>
              </div>

              {item.note && (
                <p className="text-xs text-ivory-400 italic">
                  Note: {item.note}
                </p>
              )}
            </div>

            {/* Right: Quantity x Price, Total, and Delete */}
            <div className="flex items-center gap-4 flex-shrink-0">
              <div className="text-right">
                <div className="text-sm font-bold font-mono text-ivory-50">
                  ₹{item.itemSubtotal}
                </div>
                <div className="text-[11px] text-ivory-400 font-mono">
                  {item.quantity} × ₹{item.unitPrice}
                </div>
              </div>

              {canDelete && (
                <button
                  onClick={() => onDeleteItem(item._id)}
                  className="p-1.5 text-ivory-500 hover:text-rose-400 rounded-lg hover:bg-navy-750 transition-colors"
                  title="Remove item"
                  aria-label="Remove item"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
