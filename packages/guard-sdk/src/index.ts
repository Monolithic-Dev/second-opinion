import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** Anything that can call a Second Opinion tool and return its structured result. Tests and other transports plug in here. */
export interface Caller {
  call(name: string, args: Record<string, unknown>): Promise<Record<string, any>>;
}

/** Second Opinion could not be reached, or answered unexpectedly. */
export class GuardError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'GuardError';
  }
}

export interface ActionDescription {
  actionType: 'payment' | 'purchase' | 'transfer';
  amountCents?: number;
  payee?: string;
  /** What the person said or the order note, verbatim. Scored for scam language. */
  text: string;
  /** Short human description shown to the family, e.g. "5 x $200 gift cards". */
  description?: string;
}

export interface GuardOptions {
  /** Second Opinion MCP endpoint, e.g. http://localhost:8787/mcp. Ignored when `caller` is given. */
  url?: string;
  token?: string;
  caller?: Caller;
  householdId: string;
  /** 'closed' (default): if the guard cannot answer, the action does NOT run. 'open' runs it anyway (unsafe). */
  failMode?: 'closed' | 'open';
  timeoutMs?: number;
  /** How long `release` can still run a held action. Default 24 hours. */
  pendingTtlMs?: number;
  now?: () => number;
}

export type GuardStatus = 'held' | 'blocked' | 'unverified';
export interface ToolResultLike {
  [key: string]: unknown;
  content: Array<{ type: 'text'; text: string }>;
  structuredContent: Record<string, unknown>;
  isError?: boolean;
}

export interface ProtectOptions<A> {
  describe: (args: A) => ActionDescription;
}

export type ReleaseResult =
  | { status: 'executed'; result: unknown }
  | { status: 'already_executed'; result: unknown }
  | { status: 'pending' | 'denied' | 'expired' | 'unknown' };

/** Tool result for an action that did NOT run. Only a hold is a normal outcome; blocked and unverified are tool errors. */
function notRun(status: GuardStatus, message: string, extra: Record<string, unknown> = {}): ToolResultLike {
  const r: ToolResultLike = { content: [{ type: 'text', text: message }], structuredContent: { status, message, ...extra } };
  if (status !== 'held') r.isError = true;
  return r;
}

export function createGuard(opts: GuardOptions) {
  const failOpen = opts.failMode === 'open';
  const now = opts.now ?? Date.now;
  const ttl = opts.pendingTtlMs ?? 24 * 60 * 60 * 1000;
  let client: Client | null = null;

  const caller: Caller =
    opts.caller ??
    {
      async call(name, args) {
        if (!opts.url) throw new GuardError('CONFIG', 'createGuard needs `url` or `caller`');
        try {
          if (!client) {
            const c = new Client({ name: 'second-opinion-guard', version: '0.1.0' });
            await c.connect(new StreamableHTTPClientTransport(new URL(opts.url), { requestInit: { headers: { Authorization: `Bearer ${opts.token ?? ''}` } } }));
            client = c;
          }
          const res = (await client.callTool({ name, arguments: args }, undefined, { timeout: opts.timeoutMs ?? 3000 })) as {
            isError?: boolean;
            structuredContent?: Record<string, any>;
          };
          if (res.isError) throw new GuardError(String(res.structuredContent?.code ?? 'INTERNAL'), String(res.structuredContent?.message ?? 'tool error'));
          if (!res.structuredContent) throw new GuardError('UNAVAILABLE', 'empty tool result');
          return res.structuredContent;
        } catch (e) {
          if (e instanceof GuardError) throw e;
          const c = client;
          client = null;
          await c?.close().catch(() => {});
          throw new GuardError('UNAVAILABLE', e instanceof Error ? e.message : String(e));
        }
      },
    };

  const pending = new Map<string, { run: () => Promise<unknown>; expiresAt: number }>();
  const done = new Map<string, unknown>();

  /** Wrap a tool handler. It runs only when Second Opinion says allow; otherwise the caller gets a held / blocked / unverified result. */
  function protect<A, R>(handler: (args: A, extra?: unknown) => Promise<R> | R, popts: ProtectOptions<A>) {
    return async (args: A, extra?: unknown): Promise<R | ToolResultLike> => {
      const unverified = async (why: string): Promise<R | ToolResultLike> =>
        failOpen ? handler(args, extra) : notRun('unverified', `I could not check this with the family safety service (${why}), so I did not do it.`);
      let action: ActionDescription;
      try {
        action = popts.describe(args);
      } catch (e) {
        return unverified(`could not describe the action: ${e instanceof Error ? e.message : e}`);
      }
      let check: Record<string, any>;
      try {
        check = await caller.call('check_message', {
          householdId: opts.householdId,
          text: action.text || action.description || action.actionType,
          context: { actionType: action.actionType, amountCents: action.amountCents, payee: action.payee },
        });
      } catch (e) {
        return unverified(e instanceof Error ? e.message : String(e));
      }
      const outcome: string = check.decision?.outcome;
      const reasons: string[] = check.decision?.reasonText ?? [];
      // Run the real handler outside the guard's try/catch: its own errors are not guard failures.
      if (check.verdict === 'allow' && outcome === 'allow') return handler(args, extra);
      if (outcome === 'block') return notRun('blocked', `This is not allowed by the family rules: ${reasons.join('; ') || 'blocked'}.`, { reasons });
      try {
        const hold = await caller.call('place_hold', {
          householdId: opts.householdId,
          checkId: check.checkId,
          actionType: action.actionType,
          amountCents: action.amountCents,
          payee: action.payee,
          description: (action.description ?? action.text).slice(0, 200),
        });
        await caller.call('request_family_approval', { holdId: hold.holdId });
        pending.set(hold.holdId, { run: async () => handler(args, extra), expiresAt: now() + ttl });
        const flags: string[] = check.card?.flags ?? [];
        return notRun('held', `I paused this and asked a family member to review it${flags[0] ? `: ${flags[0].toLowerCase()}` : ''}. Nothing was done.`, {
          holdId: hold.holdId,
          reasons: [...flags, ...reasons],
        });
      } catch (e) {
        if (e instanceof GuardError && e.code === 'FORBIDDEN') return notRun('blocked', 'This is not allowed by the family rules; a family member must act.', { reasons });
        return unverified(e instanceof Error ? e.message : String(e));
      }
    };
  }

  /** Run a held action once, only if a family approver has released it. Safe to call again: it never runs twice. */
  async function release(holdId: string): Promise<ReleaseResult> {
    if (done.has(holdId)) return { status: 'already_executed', result: done.get(holdId) };
    const p = pending.get(holdId);
    if (!p) return { status: 'unknown' };
    if (now() > p.expiresAt) {
      pending.delete(holdId);
      return { status: 'expired' };
    }
    const hold = await caller.call('get_hold', { holdId });
    const status: string = hold.hold?.status;
    if (status === 'released') {
      pending.delete(holdId); // claim before running so a concurrent release cannot run it twice
      const result = await p.run();
      done.set(holdId, result);
      return { status: 'executed', result };
    }
    if (status === 'pending') return { status: 'pending' };
    pending.delete(holdId);
    return { status: status === 'expired' ? 'expired' : 'denied' };
  }

  return {
    protect,
    release,
    caller,
    get pendingCount() {
      return pending.size;
    },
    async close() {
      await client?.close().catch(() => {});
      client = null;
    },
  };
}

export type Guard = ReturnType<typeof createGuard>;
