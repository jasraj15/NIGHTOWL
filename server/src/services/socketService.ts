import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Pool } from '../models/Pool.js';
import { User } from '../models/User.js';
import { getAllowedOrigins } from '../utils/origins.js';

let io: SocketIOServer | null = null;

interface JwtPayload {
  userId: string;
  email: string;
  hostel: string;
}

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

function parseCookieHeader(header: string | undefined): Record<string, string> {
  if (!header) return {};
  return header.split(';').reduce((acc: Record<string, string>, c) => {
    const idx = c.indexOf('=');
    if (idx > -1) {
      const key = c.slice(0, idx).trim();
      const val = c.slice(idx + 1).trim();
      if (key) acc[key] = decodeURIComponent(val);
    }
    return acc;
  }, {});
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: getAllowedOrigins(),
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Authenticate every socket from the HttpOnly cookie (or an explicit handshake token).
  io.use(async (socket: Socket, next) => {
    try {
      let token: string | undefined = socket.handshake.auth?.token;
      if (!token) {
        token = parseCookieHeader(socket.handshake.headers.cookie)['nightowl_token'];
      }
      if (!token) return next(new Error('Authentication token required'));

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      const user = await User.findById(decoded.userId).select('status isEmailVerified').lean();
      if (!user || user.status !== 'active') return next(new Error('Account not active'));

      socket.data.user = decoded;
      next();
    } catch {
      next(new Error('Invalid or expired socket credentials'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;

    // Private per-user room for notifications & payment events.
    socket.join(`user:${user.userId}`);

    // Pool rooms: any verified student may watch an open pool's cart (it is discoverable),
    // but payment/contribution events are only ever emitted to user rooms.
    socket.on('pool:join_room', async (poolId: string, ack?: (res: any) => void) => {
      try {
        if (!poolId || typeof poolId !== 'string') {
          ack?.({ success: false, error: 'Invalid pool ID' });
          return;
        }
        const pool = await Pool.findById(poolId).select('_id status participants creator').lean();
        if (!pool) {
          ack?.({ success: false, error: 'Pool not found' });
          return;
        }
        const roomName = `pool:${poolId}`;
        socket.join(roomName);
        ack?.({ success: true, room: roomName, poolId });
      } catch (err: any) {
        ack?.({ success: false, error: err.message || 'Error joining pool room' });
      }
    });

    socket.on('pool:leave_room', (poolId: string) => {
      if (poolId && typeof poolId === 'string') socket.leave(`pool:${poolId}`);
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

/** Broadcast to everyone watching a pool room. */
export function broadcastPoolUpdate(poolId: string, event: string, data: any): void {
  if (io) {
    io.to(`pool:${poolId}`).emit(event, { ...data, timestamp: new Date().toISOString() });
  }
}

/** Emit only to one user's private room. */
export function emitToUser(userId: string, event: string, data: any): void {
  if (io) {
    io.to(`user:${userId}`).emit(event, { ...data, timestamp: new Date().toISOString() });
  }
}
