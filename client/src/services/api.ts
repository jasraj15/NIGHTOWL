const API_BASE = import.meta.env.VITE_API_URL || '';

export interface ApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  details?: any[];
  [key: string]: any;
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers || {}),
    },
    credentials: 'include', // Sends HttpOnly session cookies
  };

  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({
    success: false,
    error: `HTTP ${response.status}: Unexpected server response`,
  }));

  if (!response.ok || data.success === false) {
    const errorMessage =
      data.error ||
      (data.details && data.details[0]?.message) ||
      `Request failed with status ${response.status}`;
    const err = new Error(errorMessage);
    (err as any).data = data;
    (err as any).status = response.status;
    throw err;
  }

  return data as T;
}
