/**
 * Thin fetch wrapper for the NightOwl REST API.
 * - Always sends the HttpOnly session cookie (credentials: 'include').
 * - Normalises error responses into an ApiError with the server's message.
 * - Base URL comes from VITE_API_URL in production; in dev, Vite proxies /api to the backend.
 */
const RAW_BASE = import.meta.env.VITE_API_URL || '';
export const API_BASE = RAW_BASE.replace(/\/+$/, '');
export const API_PREFIX = '/api/v1';

export class ApiError extends Error {
  status: number;
  code?: string;
  data: any;
  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
    this.code = data?.code;
  }
}

export interface ApiOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Query params appended to the URL (undefined/empty values are skipped). */
  query?: Record<string, string | number | boolean | undefined | null>;
}

function buildUrl(path: string, query?: ApiOptions['query']): string {
  const p = path.startsWith('/') ? path : `/${path}`;
  const url = `${API_BASE}${p.startsWith('/api') ? p : `${API_PREFIX}${p}`}`;
  if (!query) return url;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    params.set(k, String(v));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

export async function api<T = any>(path: string, options: ApiOptions = {}): Promise<T> {
  const { body, query, headers, ...rest } = options;
  const init: RequestInit = {
    ...rest,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(headers || {}),
    },
  };
  if (body !== undefined) init.body = JSON.stringify(body);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, query), init);
  } catch {
    throw new ApiError('Cannot reach the NightOwl server. Check your connection and try again.', 0);
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    const message =
      data?.error ||
      data?.details?.[0]?.message ||
      data?.message ||
      (res.status === 429 ? 'Too many requests — please slow down.' : `Request failed (${res.status})`);
    throw new ApiError(message, res.status, data);
  }
  return data as T;
}

export const get = <T = any>(path: string, query?: ApiOptions['query']) => api<T>(path, { method: 'GET', query });
export const post = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'POST', body: body ?? {} });
export const patch = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'PATCH', body: body ?? {} });
export const del = <T = any>(path: string, body?: unknown) => api<T>(path, { method: 'DELETE', body });

export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}
