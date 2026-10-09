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

export function clampScore(raw: number): number {
  return Math.max(0, Math.min(100, Math.round(raw)));
}

export function verdictFor(score: number): Verdict {
  if (score >= HOLD_THRESHOLD) return 'hold';
  if (score >= CAUTION_THRESHOLD) return 'caution';
  return 'allow';
}

/** Decisive rules: they can only raise the verdict to `hold`, and negative signals never override them. */
export function hardRuleOf(signals: Signal[], pack: 'v1' | 'v2' | 'v3' = 'v3'): string | undefined {
  const has = (id: SignalId) => signals.some((s) => s.id === id);
  const positiveOthers = (except: SignalId) => signals.some((s) => s.id !== except && isPositive(s.id) && s.weight > 0);
  if (has('GIFT_CARD') && positiveOthers('GIFT_CARD')) return 'GIFT_CARD_PLUS_ANY';
  if (has('REMOTE_ACCESS') && has('AUTHORITY_IMPERSONATION')) return 'REMOTE_ACCESS_PLUS_AUTHORITY';
  if (has('VERIFICATION_CODE') && has('UNSOLICITED_CONTACT')) return 'CODE_PLUS_UNSOLICITED';
  if (pack !== 'v1' && has('CREDENTIAL_REQUEST') && (has('URGENCY') || has('AUTHORITY_IMPERSONATION') || has('UNSOLICITED_CONTACT') || has('SECRECY'))) return 'CREDENTIAL_PLUS_PRESSURE';
  // Pack v3: a fee demanded up front, from someone with an official-sounding or pressuring approach.
  if (pack === 'v3' && has('ADVANCE_FEE') && (has('PRIZE_OR_LOTTERY') || has('AUTHORITY_IMPERSONATION') || has('UNSOLICITED_CONTACT') || has('URGENCY') || has('SECRECY'))) return 'ADVANCE_FEE_PLUS_PRESSURE';
  return undefined;
}

/** Single-layer scoring (sum, clamp, thresholds, hard rules). Kept for the rules-only rule set and for tests. */
export function scoreSignals(signals: Signal[]): Scored {
  const score = clampScore(signals.reduce((acc, s) => acc + s.weight, 0));
  const hardRule = hardRuleOf(signals);
  const verdict = hardRule ? 'hold' : verdictFor(score);
  return hardRule ? { score, verdict, hardRule } : { score, verdict };
}
