import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, ApiError } from '../api';

interface Ctx {
  personId: string | null;
  ready: boolean;
  login: (personId: string, pin: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<Ctx | null>(null);

/** Who is signed in as a family member (a signed, HttpOnly cookie on the server; the browser never sees the secret). */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [personId, setPersonId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    api.me().then((r) => setPersonId(r.personId)).catch(() => setPersonId(null)).finally(() => setReady(true));
  }, []);

  /** Returns an error message, or null on success. */
  const login = useCallback(async (id: string, pin: string) => {
    try {
      const r = await api.login(id, pin);
      setPersonId(r.personId);
      return null;
    } catch (e) {
      return e instanceof ApiError ? e.message : 'Could not sign in.';
    }
  }, []);

  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setPersonId(null);
  }, []);

  const value = useMemo(() => ({ personId, ready, login, logout }), [personId, ready, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): Ctx {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
