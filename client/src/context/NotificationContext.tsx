import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppNotification } from '../types/index.js';
import { get, post, patch, del } from '../services/api.js';
import { getSocket, SOCKET_EVENTS } from '../services/socket.js';
import { useAuth } from './AuthContext.js';
import { useToast } from './ToastContext.js';

interface NotificationApi {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NotificationContext = createContext<NotificationApi | null>(null);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, unreadNotifications, setUnreadNotifications } = useAuth();
  const toast = useToast();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await get<{ notifications: AppNotification[]; unreadCount: number }>('/notifications', { limit: 30 });
      setNotifications(res.notifications);
      setUnreadNotifications(res.unreadCount);
    } finally {
      setLoading(false);
    }
  }, [user, setUnreadNotifications]);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    void refresh();
  }, [user?._id, refresh]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live push: the DB is the source of truth; the socket event is a hint to prepend.
  useEffect(() => {
    if (!user) return;
    const socket = getSocket();
    if (!socket) return;
    const onNew = (payload: { notification: AppNotification }) => {
      const n = payload.notification;
      setNotifications((prev) => (prev.some((x) => x._id === n._id) ? prev : [n, ...prev].slice(0, 50)));
      setUnreadNotifications((c) => c + 1);
      toast.info(n.title, n.message);
    };
    socket.on(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    return () => {
      socket.off(SOCKET_EVENTS.NOTIFICATION_NEW, onNew);
    };
  }, [user?._id, setUnreadNotifications, toast]); // eslint-disable-line react-hooks/exhaustive-deps

  const api = useMemo<NotificationApi>(
    () => ({
      notifications,
      unreadCount: unreadNotifications,
      loading,
      refresh,
      markRead: async (id) => {
        const target = notifications.find((n) => n._id === id);
        if (!target || target.read) return;
        setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
        setUnreadNotifications((c) => Math.max(0, c - 1));
        try {
          const res = await patch<{ unreadCount: number }>(`/notifications/${id}/read`);
          setUnreadNotifications(res.unreadCount);
        } catch {
          /* optimistic; refresh will reconcile */
        }
      },
      markAllRead: async () => {
        setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        setUnreadNotifications(0);
        await post('/notifications/read-all');
      },
      remove: async (id) => {
        const target = notifications.find((n) => n._id === id);
        setNotifications((prev) => prev.filter((n) => n._id !== id));
        if (target && !target.read) setUnreadNotifications((c) => Math.max(0, c - 1));
        await del(`/notifications/${id}`);
      },
    }),
    [notifications, unreadNotifications, loading, refresh, setUnreadNotifications]
  );

  return <NotificationContext.Provider value={api}>{children}</NotificationContext.Provider>;
};

export function useNotifications(): NotificationApi {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
