import type { Signal, SignalId, Verdict } from '@second-opinion/shared';

export const HOLD_THRESHOLD = 60;
export const CAUTION_THRESHOLD = 30;

export interface Scored {
  score: number;
  verdict: Verdict;
  hardRule?: string;
}

const NEGATIVE: ReadonlySet<SignalId> = new Set<SignalId>(['TRUSTED_PAYEE', 'OFFICIAL_CHANNEL_ADVICE']);

export function isPositive(id: SignalId): boolean {
  return !NEGATIVE.has(id);
}

function fromScore(score: number): Verdict {
  if (score >= HOLD_THRESHOLD) return 'hold';
  if (score >= CAUTION_THRESHOLD) return 'caution';
  return 'allow';
}

/** Sum weights, clamp 0-100, apply thresholds, then hard rules (which can only raise to `hold`). */
export function scoreSignals(signals: Signal[]): Scored {
  const raw = signals.reduce((acc, s) => acc + s.weight, 0);
  const score = Math.max(0, Math.min(100, Math.round(raw)));
  let verdict = fromScore(score);
  let hardRule: string | undefined;

  const has = (id: SignalId) => signals.some((s) => s.id === id);
  const positiveOthers = (except: SignalId) => signals.some((s) => s.id !== except && isPositive(s.id) && s.weight > 0);

  if (has('GIFT_CARD') && positiveOthers('GIFT_CARD')) hardRule = 'GIFT_CARD_PLUS_ANY';
  else if (has('REMOTE_ACCESS') && has('AUTHORITY_IMPERSONATION')) hardRule = 'REMOTE_ACCESS_PLUS_AUTHORITY';
  else if (has('VERIFICATION_CODE') && has('UNSOLICITED_CONTACT')) hardRule = 'CODE_PLUS_UNSOLICITED';

  if (hardRule) verdict = 'hold';
  return hardRule ? { score, verdict, hardRule } : { score, verdict };
}
