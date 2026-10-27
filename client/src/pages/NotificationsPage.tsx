import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../context/NotificationContext.js';
import { NotificationItem } from '../components/notifications/NotificationBell.js';
import { EmptyState, PageHeader, Skeleton } from '../components/ui/Bits.js';
import { Button } from '../components/ui/Button.js';

export const NotificationsPage: React.FC = () => {
  const { notifications, unreadCount, loading, markRead, markAllRead, remove } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Joins, deadlines, payments and order updates for your pools. Tune what you receive in Settings → Notifications."
        actions={
          <Button variant="secondary" size="sm" onClick={() => void markAllRead()} disabled={unreadCount === 0} icon={<CheckCheck className="h-4 w-4" />}>
            Mark all read
          </Button>
        }
      />
      {loading && notifications.length === 0 ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-7 w-7" />} title="No notifications yet" description="When someone joins your pool, a deadline nears or a payment lands, it shows up here." />
      ) : (
        <div className="card divide-y divide-line p-1.5">
          {notifications.map((n) => (
            <NotificationItem
              key={n._id}
              n={n}
              onOpen={(x) => {
                void markRead(x._id);
                if (x.poolId) navigate(`/pools/${x.poolId}`);
              }}
              onRemove={(id) => void remove(id)}
            />
          ))}
        </div>
      )}
    </div>
  );
};
