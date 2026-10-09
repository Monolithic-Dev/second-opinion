import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';
import type { AppState } from '../types';
import { useEvents, type EventName } from './useEvents';

interface Ctx {
  state: AppState | null;
  error: string | null;
  loading: boolean;
  live: boolean;
  refresh: () => Promise<void>;
  /** Components can listen to live events (e.g. the elder device announcing a decision). */
  subscribe: (fn: (type: EventName, data: Record<string, unknown>) => void) => () => void;
}

const StateContext = createContext<Ctx | null>(null);

/** Server state for the household, refreshed whenever a live event arrives (debounced so a burst is one request). */
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const listeners = useRef(new Set<(type: EventName, data: Record<string, unknown>) => void>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = useEvents((type, data) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void refresh(), 120);
    for (const fn of listeners.current) fn(type, data);
  });

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const subscribe = useCallback((fn: (type: EventName, data: Record<string, unknown>) => void) => {
    listeners.current.add(fn);
    return () => { listeners.current.delete(fn); };
  }, []);

  const value = useMemo(() => ({ state, error, loading, live, refresh, subscribe }), [state, error, loading, live, refresh, subscribe]);
  return <StateContext.Provider value={value}>{children}</StateContext.Provider>;
}

export function useAppState(): Ctx {
  const ctx = useContext(StateContext);
  if (!ctx) throw new Error('useAppState must be used inside AppStateProvider');
  return ctx;
}
