/** Household protection policy (docs/policy-and-approvals.md §1). Editable by family approvers only. */
export interface Policy {
  /** A single payment above this always needs approval. */
  maxSingleCents: number;
  /** Total spend per local day above this is blocked. */
  dailyCapCents: number;
  /** A first payment to a payee that is not trusted waits this long unless approved. */
  newPayeeCooloffMin: number;
  /** A "caution" request at or above this amount needs approval. */
  requireApprovalAboveCents: number;
  /** Quiet hours, local time `HH:MM`; the window may wrap midnight. */
  quietHoursStart: string;
  quietHoursEnd: string;
  /** IANA timezone for quiet hours and the daily cap boundary. */
  timezone: string;
  /** Approvals needed to release a hold (1 or 2). */
  quorum: 1 | 2;
  /** Minutes without a decision before the next approver rank is notified. */
  escalateAfterMin: number;
  /** Minutes before a pending hold expires (and stays blocked). */
  holdTtlMin: number;
}

export const defaultPolicy: Policy = {
  maxSingleCents: 50_000,
  dailyCapCents: 150_000,
  newPayeeCooloffMin: 60,
  requireApprovalAboveCents: 20_000,
  quietHoursStart: '22:00',
  quietHoursEnd: '06:00',
  timezone: 'America/Chicago',
  quorum: 1,
  escalateAfterMin: 5,
  holdTtlMin: 10,
};

export const POLICY_FIELDS = Object.keys(defaultPolicy) as Array<keyof Policy>;

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export type PolicyCheck = { ok: true } | { ok: false; errors: string[] };

/** Range and consistency checks. `approverCount` lets us refuse a quorum nobody could satisfy. */
export function validatePolicy(p: Policy, approverCount?: number): PolicyCheck {
  const errors: string[] = [];
  const int = (name: keyof Policy, min: number, max: number) => {
    const v = p[name];
    if (typeof v !== 'number' || !Number.isInteger(v) || v < min || v > max) errors.push(`${name} must be an integer between ${min} and ${max}`);
  };
  int('maxSingleCents', 1_000, 5_000_000);
  int('dailyCapCents', 1_000, 10_000_000);
  int('newPayeeCooloffMin', 0, 7 * 24 * 60);
  int('requireApprovalAboveCents', 0, 5_000_000);
  int('escalateAfterMin', 1, 24 * 60);
  int('holdTtlMin', 1, 7 * 24 * 60);
  if (p.quorum !== 1 && p.quorum !== 2) errors.push('quorum must be 1 or 2');
  if (!HHMM.test(p.quietHoursStart)) errors.push('quietHoursStart must be HH:MM');
  if (!HHMM.test(p.quietHoursEnd)) errors.push('quietHoursEnd must be HH:MM');
  if (!isValidTimezone(p.timezone)) errors.push('timezone must be a valid IANA zone');
  if (p.dailyCapCents < p.maxSingleCents) errors.push('dailyCapCents must be at least maxSingleCents');
  if (p.escalateAfterMin >= p.holdTtlMin) errors.push('escalateAfterMin must be shorter than holdTtlMin');
  if (approverCount !== undefined && p.quorum > approverCount) errors.push(`quorum ${p.quorum} needs at least ${p.quorum} approvers (household has ${approverCount})`);
  return errors.length ? { ok: false, errors } : { ok: true };
}

/** Apply a partial update; unknown keys are ignored. Returns the merged policy and the fields that changed. */
export function patchPolicy(base: Policy, patch: Partial<Policy>): { policy: Policy; changed: Array<keyof Policy> } {
  const next = { ...base };
  const changed: Array<keyof Policy> = [];
  for (const k of POLICY_FIELDS) {
    const v = patch[k];
    if (v !== undefined && v !== base[k]) {
      (next as Record<string, unknown>)[k] = v;
      changed.push(k);
    }
  }
  return { policy: next, changed };
}
