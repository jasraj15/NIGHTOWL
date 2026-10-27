import { env } from '../config/env.js';

/** Allowed browser origins for CORS and Socket.IO (restrictive by default). */
export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([env.CLIENT_URL]);
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:5173');
    origins.add('http://127.0.0.1:5173');
    origins.add('http://localhost:4173');
  }
  if (env.EXTRA_ALLOWED_ORIGINS) {
    env.EXTRA_ALLOWED_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean)
      .forEach((o) => origins.add(o));
  }
  return Array.from(origins);
}
