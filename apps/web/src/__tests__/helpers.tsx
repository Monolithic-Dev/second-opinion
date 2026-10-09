import { vi } from 'vitest';
import type { AppState, HoldRow, TurnResult } from '../types';

export function makeHold(over: Partial<HoldRow> = {}): HoldRow {
  return {
    holdId: 'hold_aaa', status: 'pending', description: 'Purchase of $1,000 to gift cards', amountCents: 100_000, payee: 'gift cards',
    flags: ['Asks for gift cards', 'Pressure to act right now'], reasonText: ['The request looks like a scam'], approverId: 'p_priya',
    quorumRequired: 1, votes: { approve: 0, deny: 0 }, escalationLevel: 0,
    createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 8 * 60_000).toISOString(), ...over,
  };
}

export function makeState(over: Partial<AppState> = {}): AppState {
  return {
    household: { id: 'hh_demo', name: "Dorothy's household" },
    people: [
      { id: 'p_dorothy', name: 'Dorothy', role: 'elder', canApprove: false, approverRank: 1, contactLabel: 'Echo' },
      { id: 'p_priya', name: 'Priya', role: 'family', canApprove: true, approverRank: 1, contactLabel: "Priya's phone" },
      { id: 'p_arjun', name: 'Arjun', role: 'family', canApprove: true, approverRank: 2, contactLabel: "Arjun's phone" },
    ],
    holds: [],
    payees: [{ id: 'pay_1', name: 'greenleaf pharmacy', kind: 'pharmacy' }],
    policy: {
      maxSingleCents: 50_000, dailyCapCents: 150_000, newPayeeCooloffMin: 60, requireApprovalAboveCents: 20_000, quietHoursStart: '22:00',
      quietHoursEnd: '06:00', timezone: 'America/Chicago', quorum: 1, escalateAfterMin: 5, holdTtlMin: 10,
    },
    isDefault: true,
    notifications: [],
    ...over,
  };
}

export const HOLD_TURN: TurnResult = {
  intent: 'PURCHASE_OR_PAY',
  reply: "I've paused this. This matches a common scam: gift cards. I've asked Priya to check.",
  spoken: "I've paused this. This matches a common scam: gift cards. I've asked Priya to check.",
  card: { title: 'Held: possible scam', level: 'hold', flags: ['Asks for gift cards'], advice: 'Real banks never ask for gift cards.' },
  verdict: 'hold', holdId: 'hold_aaa', executed: false,
  trace: [{ tool: 'check_message', args: {}, ok: true, ms: 7, summary: 'hold 100 · policy require_approval' }],
  traceId: '11111111-2222-3333-4444-555555555555',
};

type Handler = (init: { method: string; body: unknown }) => { status?: number; json: unknown } | Promise<{ status?: number; json: unknown }>;

/** Replace fetch with a router keyed by "METHOD /path". Unknown routes fail the test loudly. */
export function mockFetch(routes: Record<string, Handler>) {
  const calls: Array<{ method: string; path: string; body: unknown; headers: Record<string, string> }> = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), 'http://localhost');
    const method = (init.method ?? 'GET').toUpperCase();
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: url.pathname, body, headers: (init.headers ?? {}) as Record<string, string> });
    const handler = routes[`${method} ${url.pathname}`];
    if (!handler) throw new Error(`unmocked request: ${method} ${url.pathname}`);
    const out = await handler({ method, body });
    const status = out.status ?? 200;
    return new Response(JSON.stringify(out.json), { status, headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fn);
  return { fn, calls };
}

type Listener = (e: MessageEvent<string>) => void;
export class FakeEventSource {
  static instances: FakeEventSource[] = [];
  listeners = new Map<string, Listener[]>();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeEventSource.instances.push(this);
    queueMicrotask(() => this.onopen?.());
  }
  addEventListener(type: string, fn: Listener) { this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]); }
  close() { this.listeners.clear(); }
  emit(type: string, data: Record<string, unknown>) {
    for (const fn of this.listeners.get(type) ?? []) fn({ data: JSON.stringify(data) } as MessageEvent<string>);
  }
  static reset() { FakeEventSource.instances = []; }
}
