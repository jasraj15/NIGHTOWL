import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { Pool } from '../models/Pool.js';

let io: SocketIOServer | null = null;

interface JwtPayload {
  userId: string;
  email: string;
  hostel: string;
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Socket middleware for authentication (from cookie or handshake auth token)
  io.use((socket: Socket, next) => {
    try {
      let token: string | undefined = undefined;

      // Check auth header or handshake token
      if (socket.handshake.auth && socket.handshake.auth.token) {
        token = socket.handshake.auth.token;
      }

      // Check cookie in handshake headers
      if (!token && socket.handshake.headers.cookie) {
        const cookies = socket.handshake.headers.cookie
          .split(';')
          .reduce((acc: Record<string, string>, c) => {
            const [key, val] = c.trim().split('=');
            if (key && val) acc[key] = decodeURIComponent(val);
            return acc;
          }, {});
        token = cookies['nightowl_token'];
      }

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Invalid or expired socket credentials'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as JwtPayload;

    // Join pool room with authorization check
    socket.on('pool:join_room', async (poolId: string, ack?: (res: any) => void) => {
      try {
        if (!poolId) {
          if (ack) ack({ success: false, error: 'Invalid pool ID' });
          return;
        }

        const pool = await Pool.findById(poolId);
        if (!pool) {
          if (ack) ack({ success: false, error: 'Pool not found' });
          return;
        }

        // Room name format: pool:<poolId>
        const roomName = `pool:${poolId}`;
        socket.join(roomName);

        if (ack) ack({ success: true, room: roomName, poolId });
      } catch (err: any) {
        if (ack) ack({ success: false, error: err.message || 'Error joining pool room' });
      }
    });

    // Leave pool room
    socket.on('pool:leave_room', (poolId: string) => {
      if (poolId) {
        socket.leave(`pool:${poolId}`);
      }
    });

    socket.on('disconnect', () => {
      // Clean disconnect
    });
  });

  return io;
}

export function getSocketIO(): SocketIOServer | null {
  return io;
}

export function broadcastPoolUpdate(poolId: string, event: string, data: any): void {
  if (io) {
    io.to(`pool:${poolId}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
}
