import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api';
import { useAppState } from './useAppState';

/**
 * Load a resource and reload it when anything changes on the server (any live event), debounced.
 * `deps` identify the resource (e.g. a hold id); changing them reloads immediately.
 */
export function useLive<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const { subscribe } = useAppState();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alive = useRef(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try {
      const next = await fetcher();
      if (alive.current) { setData(next); setError(null); }
    } catch (e) {
      if (alive.current) setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      if (alive.current) setLoading(false);
    }
  }, deps);

  useEffect(() => {
    alive.current = true;
    setLoading(true);
    void load();
    return () => { alive.current = false; };
  }, [load]);

  useEffect(
    () =>
      subscribe(() => {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void load(), 200);
      }),
    [subscribe, load],
  );
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return { data, error, loading, reload: load };
}
