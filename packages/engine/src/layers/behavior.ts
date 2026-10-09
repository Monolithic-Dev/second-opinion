import type { Context, DeniedItem, PaymentItem, Signal } from '@second-opinion/shared';
import { normalize } from '../normalize';
import { jaccard } from '../fingerprint';
import { parseAmountCents } from '../amount';

/** Layer 3: household behavior signals from recent payments and denied holds. Pure; time comes from `now`. */
export const BEHAVIOR_WEIGHTS = { AMOUNT_ANOMALY: 20, PAYEE_VELOCITY: 15, QUIET_HOURS: 10, RETRY_AFTER_DENY: 30 } as const;
export const MIN_PAYMENTS_FOR_ANOMALY = 5;
export const ANOMALY_MIN_CENTS = 20_000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface BehaviorInput {
  text: string;
  ctx: Context;
  payments: PaymentItem[];
  denied: DeniedItem[];
  /** fingerprint of the positive rule/playbook signals found so far */
  baseFingerprint: string;
  now: Date;
  timezone: string;
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Local hour (0-23) in an IANA timezone; falls back to UTC for an invalid zone. */
export function localHour(now: Date, timezone: string): number {
  try {
    const h = new Intl.DateTimeFormat('en-US', { hour: 'numeric', hourCycle: 'h23', timeZone: timezone }).format(now);
    return Number(h) % 24;
  } catch {
    return now.getUTCHours();
  }
}

export function isQuietHour(hour: number, start = 22, end = 6): boolean {
  return start > end ? hour >= start || hour < end : hour >= start && hour < end;
}

export function detectBehaviorSignals(input: BehaviorInput): Signal[] {
  const { ctx, payments, denied, now } = input;
  const out: Signal[] = [];
  const acting = ctx.actionType !== undefined && ctx.actionType !== 'none';
  const amount = ctx.amountCents ?? parseAmountCents(normalize(input.text));

  // Amount far above this household's normal payments
  const amounts = payments.map((p) => p.amountCents).filter((n) => Number.isFinite(n) && n > 0);
  if (acting && amount !== undefined && amount >= ANOMALY_MIN_CENTS && amounts.length >= MIN_PAYMENTS_FOR_ANOMALY) {
    const m = mean(amounts);
    const sd = stdev(amounts);
    if (amount > m + 3 * sd || amount > 5 * median(amounts)) {
      out.push({ id: 'AMOUNT_ANOMALY', weight: BEHAVIOR_WEIGHTS.AMOUNT_ANOMALY, evidence: `$${(amount / 100).toFixed(0)} vs usual ~$${(median(amounts) / 100).toFixed(0)}` });
    }
  }

  // Several brand-new payees in the last 7 days
  if (acting && ctx.payee) {
    const firstSeen = new Map<string, number>();
    for (const p of payments) {
      if (!p.payee) continue;
      const key = normalize(p.payee);
      const t = Date.parse(p.at);
      if (Number.isNaN(t)) continue;
      firstSeen.set(key, Math.min(firstSeen.get(key) ?? Infinity, t));
    }
    const recentNew = [...firstSeen.values()].filter((t) => now.getTime() - t <= 7 * DAY_MS && t <= now.getTime()).length;
    const isNewNow = !firstSeen.has(normalize(ctx.payee));
    if (recentNew + (isNewNow ? 1 : 0) >= 3 && isNewNow) {
      out.push({ id: 'PAYEE_VELOCITY', weight: BEHAVIOR_WEIGHTS.PAYEE_VELOCITY, evidence: `${recentNew + 1} new payees in 7 days` });
    }
  }

  // Money moving at an unusual hour
  if (acting && isQuietHour(localHour(now, input.timezone))) {
    out.push({ id: 'QUIET_HOURS', weight: BEHAVIOR_WEIGHTS.QUIET_HOURS, evidence: `${String(localHour(now, input.timezone)).padStart(2, '0')}:00 local time` });
  }

  // The same kind of request family already said no to within 24h
  if (input.baseFingerprint !== 'NONE') {
    const mine = input.baseFingerprint.split('|');
    const retry = denied.find(
      (d) => now.getTime() - Date.parse(d.at) <= DAY_MS && now.getTime() >= Date.parse(d.at) && jaccard(mine, d.fingerprint.split('|')) >= 0.75,
    );
    if (retry) out.push({ id: 'RETRY_AFTER_DENY', weight: BEHAVIOR_WEIGHTS.RETRY_AFTER_DENY, evidence: 'repeat of a request family declined' });
  }

  return out;
}
