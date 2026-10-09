import type { AppState, HoldDetail, Insights, Policy, TurnResult, VoteResult } from './types';

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Init {
  method?: string;
  body?: unknown;
}

/** One place for fetch: JSON in/out, same-origin cookies, the CSRF header on writes, errors as ApiError. */
async function request<T>(path: string, init: Init = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const headers: Record<string, string> = {};
  if (init.body !== undefined) headers['content-type'] = 'application/json';
  if (method !== 'GET') headers['x-requested-with'] = 'so';
  let res: Response;
  try {
    res = await fetch(path, { method, headers, credentials: 'same-origin', body: init.body === undefined ? undefined : JSON.stringify(init.body) });
  } catch {
    throw new ApiError(0, 'NETWORK', "Can't reach the server. Is `npm run demo` running?");
  }
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    const e = (json as { error?: { code?: string; message?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? 'ERROR', e?.message ?? res.statusText);
  }
  return json as T;
}

export const HOUSEHOLD = 'hh_demo';

export const api = {
  health: () => request<{ ok: boolean; mcp: boolean }>('/healthz'),
  state: (householdId = HOUSEHOLD) => request<AppState>(`/api/state?householdId=${encodeURIComponent(householdId)}`),
  utter: (text: string, speaker: 'elder' | 'family' = 'elder', householdId = HOUSEHOLD) =>
    request<TurnResult>('/api/utter', { method: 'POST', body: { householdId, speaker, text } }),
  me: () => request<{ personId: string | null }>('/api/auth/me'),
  login: (personId: string, pin: string) => request<{ personId: string }>('/api/auth/login', { method: 'POST', body: { personId, pin } }),
  logout: () => request<{ ok: boolean }>('/api/auth/logout', { method: 'POST', body: {} }),
  vote: (holdId: string, decision: 'approve' | 'deny', note?: string) =>
    request<VoteResult>(`/api/family/holds/${encodeURIComponent(holdId)}/vote`, { method: 'POST', body: { decision, ...(note ? { note } : {}) } }),
  holdDetail: (holdId: string) => request<HoldDetail>(`/api/family/holds/${encodeURIComponent(holdId)}`),
  insights: (days = 30, householdId = HOUSEHOLD) => request<Insights>(`/api/family/insights?householdId=${householdId}&days=${days}`),
  setPolicy: (patch: Partial<Policy>, householdId = HOUSEHOLD) =>
    request<{ policy: Policy; changed: string[] }>('/api/family/policy', { method: 'PUT', body: { householdId, patch } }),
  addPayee: (name: string, kind: string, householdId = HOUSEHOLD) =>
    request<{ payees: AppState['payees'] }>('/api/family/payees', { method: 'POST', body: { householdId, name, kind } }),
  removePayee: (name: string, householdId = HOUSEHOLD) =>
    request<{ payees: AppState['payees'] }>('/api/family/payees', { method: 'DELETE', body: { householdId, name } }),
  reset: () => request<{ ok: boolean }>('/api/reset', { method: 'POST', body: {} }),
};
