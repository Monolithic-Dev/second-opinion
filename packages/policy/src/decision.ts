import type { ActionType, Verdict } from '@second-opinion/shared';
import type { Policy } from './policy';
import { inQuietHours } from './time';

export type Outcome = 'allow' | 'require_approval' | 'block';
export type ReasonCode =
  | 'RISK_HOLD'
  | 'RISK_CAUTION_AMOUNT'
  | 'OVER_SINGLE_LIMIT'
  | 'NEW_PAYEE_COOLOFF'
  | 'QUIET_HOURS'
  | 'DAILY_CAP';

export interface DecisionInput {
  /** Verdict from the risk engine. */
  risk: Verdict;
  actionType: ActionType;
  amountCents?: number | undefined;
  /** Payee is on the household's trusted list. */
  payeeTrusted: boolean;
  /** When this (untrusted) payee was first paid by the household; null/undefined = never. */
  payeeFirstPaidAt?: string | null | undefined;
  /** Total already approved/pending today (household-local day), before this request. */
  spentTodayCents: number;
  now: Date;
}

export interface Decision {
  outcome: Outcome;
  reasons: ReasonCode[];
  /** Approvals needed to release if a hold is placed. */
  quorum: 1 | 2;
}

const SEVERITY: Record<Outcome, number> = { allow: 0, require_approval: 1, block: 2 };

export const REASON_TEXT: Record<ReasonCode, string> = {
  RISK_HOLD: 'The request looks like a scam',
  RISK_CAUTION_AMOUNT: 'Risky request above the approval amount',
  OVER_SINGLE_LIMIT: 'Above the single-payment limit',
  NEW_PAYEE_COOLOFF: 'First payment to a new payee',
  QUIET_HOURS: 'Outside normal hours',
  DAILY_CAP: 'Over the daily spending limit',
};

/**
 * Combine the risk verdict with the household policy. Pure. Outcomes combine by maximum severity, reasons accumulate.
 * Invariant (asserted): the policy can only tighten; a risk `hold` is never turned into `allow`.
 */
export function decide(input: DecisionInput, policy: Policy): Decision {
  const reasons: ReasonCode[] = [];
  let outcome: Outcome = 'allow';
  const raise = (to: Outcome, reason: ReasonCode) => {
    reasons.push(reason);
    if (SEVERITY[to] > SEVERITY[outcome]) outcome = to;
  };

  const amount = input.amountCents ?? 0;
  const acting = input.actionType !== 'none';

  if (input.risk === 'hold') raise('require_approval', 'RISK_HOLD');
  if (input.risk === 'caution' && acting && amount >= policy.requireApprovalAboveCents) raise('require_approval', 'RISK_CAUTION_AMOUNT');

  if (acting) {
    if (amount > policy.maxSingleCents) raise('require_approval', 'OVER_SINGLE_LIMIT');

    if (!input.payeeTrusted) {
      const first = input.payeeFirstPaidAt ? Date.parse(input.payeeFirstPaidAt) : NaN;
      const coolingOff = Number.isNaN(first) || input.now.getTime() - first < policy.newPayeeCooloffMin * 60_000;
      if (coolingOff) raise('require_approval', 'NEW_PAYEE_COOLOFF');
    }

    if (inQuietHours(input.now, policy.timezone, policy.quietHoursStart, policy.quietHoursEnd)) raise('require_approval', 'QUIET_HOURS');
    if (input.spentTodayCents + amount > policy.dailyCapCents) raise('block', 'DAILY_CAP');
  }

  if (input.risk === 'hold' && outcome === 'allow') throw new Error('policy invariant violated: risk hold became allow');

  const quorum: 1 | 2 = amount > 3 * policy.maxSingleCents ? 2 : policy.quorum;
  return { outcome, reasons: [...new Set(reasons)], quorum };
}
