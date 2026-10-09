import type { Adapter, Notification, OutboxPort } from './types';

/** Retry delays after attempt 1, 2, 3. After the 4th failed attempt the notification is marked failed. */
export const BACKOFF_MS = [5_000, 20_000, 80_000] as const;
export const MAX_ATTEMPTS = BACKOFF_MS.length + 1;

export interface DispatchResult {
  sent: number;
  retried: number;
  failed: number;
}

export function backoffFor(attemptsSoFar: number): number | null {
  return attemptsSoFar >= 1 && attemptsSoFar <= BACKOFF_MS.length ? (BACKOFF_MS[attemptsSoFar - 1] as number) : null;
}

/**
 * Deliver due notifications through their channel adapters. At-least-once: a crash between send and markSent re-sends,
 * so adapters must be idempotent (the email adapter overwrites the same file). Failures back off 5s/20s/80s, then fail.
 */
export async function dispatchDue(port: OutboxPort, adapters: Adapter[], now: Date, limit = 50): Promise<DispatchResult> {
  const byChannel = new Map(adapters.map((a) => [a.channel, a]));
  const result: DispatchResult = { sent: 0, retried: 0, failed: 0 };
  for (const n of port.due(now.toISOString(), limit)) {
    const attempts = n.attempts + 1;
    const adapter = byChannel.get(n.channel);
    try {
      if (!adapter) throw new Error(`no adapter for channel ${n.channel}`);
      await adapter.send(n);
      port.markSent(n.id, now.toISOString());
      result.sent++;
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 300);
      const delay = backoffFor(attempts);
      if (delay === null) {
        port.fail(n.id, attempts, message);
        result.failed++;
      } else {
        port.retry(n.id, attempts, new Date(now.getTime() + delay).toISOString(), message);
        result.retried++;
      }
    }
  }
  return result;
}

export type { Notification };
