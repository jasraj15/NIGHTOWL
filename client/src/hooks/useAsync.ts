import React, { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../services/api.js';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | null>>;
}

/**
 * Minimal server-state hook: fetch on mount / when deps change, expose refetch.
 * (Stands in for TanStack Query — kept dependency-free; see README "Deviations".)
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[] = [], options: { enabled?: boolean } = {}): AsyncState<T> {
  const enabled = options.enabled ?? true;
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const run = useCallback(async () => {
    const id = ++seq.current;
    setError(null);
    try {
      const result = await fetcherRef.current();
      if (id === seq.current) setData(result);
    } catch (err) {
      if (id === seq.current) setError(errorMessage(err));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);

  return { data, loading, error, refetch: run, setData };
}
