import { io, Socket } from 'socket.io-client';
import { API_BASE } from './api.js';

/**
 * One authenticated Socket.IO connection per browser session.
 * Auth is carried by the HttpOnly cookie (withCredentials). The server verifies
 * it in the handshake and places the socket in its private `user:<id>` room.
 */
let socket: Socket | null = null;

export const SOCKET_EVENTS = {
  PARTICIPANT_JOINED: 'pool:participant_joined',
  PARTICIPANT_LEFT: 'pool:participant_left',
  ITEM_ADDED: 'cart:item_added',
  ITEM_UPDATED: 'cart:item_updated',
  ITEM_REMOVED: 'cart:item_deleted',
  TOTAL_CHANGED: 'pool:total_changed',
  POOL_UPDATED: 'pool:updated',
  POOL_STATUS_CHANGED: 'pool:status_changed',
  POOL_LOCKED: 'pool:locked',
  POOL_EXPIRED: 'pool:expired',
  PAYMENT_STATUS_CHANGED: 'payment:status_changed',
  PAYMENT_RECORD_UPDATED: 'payment:record_updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  NOTIFICATION_NEW: 'notification:new',
} as const;

export function connectSocket(): Socket {
  if (socket) {
    if (!socket.connected) socket.connect();
    return socket;
  }
  socket = io(API_BASE || window.location.origin, {
    withCredentials: true,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 800,
    reconnectionDelayMax: 8000,
    autoConnect: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}

export function joinPoolRoom(poolId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const s = connectSocket();
    const emit = () => s.emit('pool:join_room', poolId, (ack: any) => resolve(Boolean(ack?.success)));
    if (s.connected) emit();
    else s.once('connect', emit);
  });
}

export function leavePoolRoom(poolId: string): void {
  socket?.emit('pool:leave_room', poolId);
}
