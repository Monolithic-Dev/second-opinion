import { normalize, parseAmountCents } from '@second-opinion/engine';
import { decide, localDay, type Decision, type Policy } from '@second-opinion/policy';
import type { Verdict } from '@second-opinion/shared';
import { normalizePayee } from '@second-opinion/store';
import type { Deps } from '../deps';

const HOUR_MS = 60 * 60 * 1000;

export interface PolicyInput {
  householdId: string;
  risk: Verdict;
  text: string;
  actionType: 'purchase' | 'payment' | 'transfer' | 'none';
  amountCents?: number | undefined;
  payee?: string | undefined;
  now: Date;
}

/** Gather household facts from the store and ask the pure policy engine for a decision. */
export function evaluatePolicy(deps: Deps, input: PolicyInput): { policy: Policy; decision: Decision; amountCents: number | undefined } {
  const { repos } = deps;
  const policy = repos.policies.get(input.householdId);
  const acting = input.actionType !== 'none';
  const amountCents = acting ? (input.amountCents ?? parseAmountCents(normalize(input.text))) : undefined;

  const trusted = new Set(repos.payees.list(input.householdId).map((p) => p.name));
  const payeeTrusted = input.payee ? trusted.has(normalizePayee(input.payee)) : true;
  const payeeFirstPaidAt = input.payee && !payeeTrusted ? repos.payments.firstPaidAt(input.householdId, input.payee) : null;

  // Daily cap is measured on the household-local calendar day.
  const today = localDay(input.now, policy.timezone);
  const since = new Date(input.now.getTime() - 36 * HOUR_MS).toISOString();
  const spentTodayCents = acting
    ? repos.spend.since(input.householdId, since).filter((s) => localDay(new Date(s.at), policy.timezone) === today).reduce((a, s) => a + s.amountCents, 0)
    : 0;

  const decision = decide(
    { risk: input.risk, actionType: input.actionType, amountCents, payeeTrusted, payeeFirstPaidAt, spentTodayCents, now: input.now },
    policy,
  );
  return { policy, decision, amountCents };
}

/** Hold lifetime: an explicit server override (tests, ops) wins over the household policy. */
export function holdTtlMs(deps: Deps, policy: Policy): number {
  return deps.config.holdTtlOverrideMs ?? policy.holdTtlMin * 60_000;
}
