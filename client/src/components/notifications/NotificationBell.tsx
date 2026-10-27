import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, CheckCheck, Trash2 } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext.js';
import { AppNotification } from '../../types/index.js';
import { relativeTime, cx } from '../../utils/format.js';

const typeDot: Record<AppNotification['type'], string> = {
  POOL_INVITATION: 'bg-info',
  PARTICIPANT_JOINED: 'bg-lime',
  POOL_NEARLY_FULL: 'bg-warn',
  DEADLINE_APPROACHING: 'bg-warn',
  PAYMENT_UPDATE: 'bg-ok',
  ORDER_UPDATE: 'bg-info',
  SYSTEM: 'bg-faint',
};

export const NotificationItem: React.FC<{ n: AppNotification; onOpen: (n: AppNotification) => void; onRemove?: (id: string) => void; compact?: boolean }> = ({
  n,
  onOpen,
  onRemove,
  compact,
}) => (
  <div className={cx('group flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-overlay', !n.read && 'bg-lime/5')}>
    <span className={cx('mt-2 h-2 w-2 shrink-0 rounded-full', typeDot[n.type], n.read && 'opacity-30')} aria-hidden />
    <button onClick={() => onOpen(n)} className="min-w-0 flex-1 text-left">
      <p className={cx('text-sm', n.read ? 'font-medium text-muted' : 'font-semibold text-fg')}>{n.title}</p>
      <p className={cx('mt-0.5 text-xs text-muted', compact && 'line-clamp-2')}>{n.message}</p>
      <p className="mt-1 text-[11px] text-faint">{relativeTime(n.createdAt)}</p>
    </button>
    {onRemove && (
      <button
        onClick={() => onRemove(n._id)}
        className="rounded-md p-1 text-faint opacity-0 transition-opacity hover:text-danger focus:opacity-100 group-hover:opacity-100"
        aria-label="Delete notification"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    )}
  </div>
);

export const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markRead, markAllRead, remove } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const openItem = (n: AppNotification) => {
    void markRead(n._id);
    setOpen(false);
    if (n.poolId) navigate(`/pools/${n.poolId}`);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl border border-line bg-surface p-2.5 text-muted transition-colors hover:text-fg"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <Bell className="h-[18px] w-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-lime px-1 text-[10px] font-extrabold text-lime-ink">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-line bg-raised shadow-2xl animate-fade-up"
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-fg">Notifications</p>
            <button onClick={() => void markAllRead()} disabled={unreadCount === 0} className="inline-flex items-center gap-1 text-xs font-semibold text-lime disabled:opacity-40">
              <CheckCheck className="h-3.5 w-3.5" /> Mark all read
            </button>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-1.5">
            {notifications.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted">You're all caught up.</p>
            ) : (
              notifications.slice(0, 12).map((n) => <NotificationItem key={n._id} n={n} onOpen={openItem} onRemove={(id) => void remove(id)} compact />)
            )}
          </div>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-muted hover:text-fg">
            View all notifications
          </Link>
        </div>
      )}
    </div>
  );
};
