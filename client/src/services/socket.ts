import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || window.location.origin;

let socket: Socket | null = null;

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

export function getSocket(authToken?: string): Socket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      auth: {
        token: authToken,
      },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      // connected
    });

    socket.on('disconnect', () => {
      // disconnected
    });
  }

  // Update token if provided
  if (authToken && socket.auth) {
    (socket.auth as any).token = authToken;
  }

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
