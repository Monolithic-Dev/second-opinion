import type { Policy } from '../types';

/** The policy as the form edits it: dollars and plain strings, never cents. */
export interface PolicyForm {
  maxSingle: string;
  dailyCap: string;
  requireApprovalAbove: string;
  newPayeeCooloffMin: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  quorum: '1' | '2';
  escalateAfterMin: string;
  holdTtlMin: string;
}

export type FormErrors = Partial<Record<keyof PolicyForm, string>>;

export const DEFAULT_POLICY: Policy = {
  maxSingleCents: 50_000, dailyCapCents: 150_000, newPayeeCooloffMin: 60, requireApprovalAboveCents: 20_000, quietHoursStart: '22:00',
  quietHoursEnd: '06:00', timezone: 'America/Chicago', quorum: 1, escalateAfterMin: 5, holdTtlMin: 10,
};

const dollars = (cents: number) => String(cents / 100);

export function toForm(p: Policy): PolicyForm {
  return {
    maxSingle: dollars(p.maxSingleCents), dailyCap: dollars(p.dailyCapCents), requireApprovalAbove: dollars(p.requireApprovalAboveCents),
    newPayeeCooloffMin: String(p.newPayeeCooloffMin), quietHoursStart: p.quietHoursStart, quietHoursEnd: p.quietHoursEnd, timezone: p.timezone,
    quorum: p.quorum === 2 ? '2' : '1', escalateAfterMin: String(p.escalateAfterMin), holdTtlMin: String(p.holdTtlMin),
  };
}

function money(s: string): number | null {
  if (!/^\d+(\.\d{1,2})?$/.test(s.trim())) return null;
  return Math.round(Number(s) * 100);
}
function whole(s: string): number | null {
  return /^\d+$/.test(s.trim()) ? Number(s) : null;
}
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Mirrors the server's validatePolicy so mistakes are caught before the request; the server stays the authority. */
export function validateForm(f: PolicyForm, approverCount: number): FormErrors {
  const e: FormErrors = {};
  const range = (key: keyof PolicyForm, v: number | null, min: number, max: number, unit: string) => {
    if (v === null || v < min || v > max) e[key] = `Enter ${unit} between ${min.toLocaleString('en-US')} and ${max.toLocaleString('en-US')}`;
  };
  const max = money(f.maxSingle);
  const cap = money(f.dailyCap);
  const above = money(f.requireApprovalAbove);
  const cool = whole(f.newPayeeCooloffMin);
  const esc = whole(f.escalateAfterMin);
  const ttl = whole(f.holdTtlMin);

  range('maxSingle', max === null ? null : max / 100, 10, 50_000, 'dollars');
  range('dailyCap', cap === null ? null : cap / 100, 10, 100_000, 'dollars');
  range('requireApprovalAbove', above === null ? null : above / 100, 0, 50_000, 'dollars');
  range('newPayeeCooloffMin', cool, 0, 10_080, 'minutes');
  range('escalateAfterMin', esc, 1, 1_440, 'minutes');
  range('holdTtlMin', ttl, 1, 10_080, 'minutes');
  if (!e.dailyCap && !e.maxSingle && cap !== null && max !== null && cap < max) e.dailyCap = 'The daily limit must be at least the single-payment limit';
  if (!e.escalateAfterMin && !e.holdTtlMin && esc !== null && ttl !== null && esc >= ttl) e.escalateAfterMin = 'Escalation must come before the request expires';
  if (!HHMM.test(f.quietHoursStart)) e.quietHoursStart = 'Use a time like 22:00';
  if (!HHMM.test(f.quietHoursEnd)) e.quietHoursEnd = 'Use a time like 06:00';
  if (!isTimezone(f.timezone)) e.timezone = 'Pick a valid time zone';
  if (Number(f.quorum) > approverCount) e.quorum = `Two approvals need at least two approvers (this household has ${approverCount})`;
  return e;
}

/** Only the fields that differ from the saved policy, in the server's units. */
export function buildPatch(f: PolicyForm, saved: Policy): Partial<Policy> {
  const next: Policy = {
    maxSingleCents: money(f.maxSingle) ?? saved.maxSingleCents, dailyCapCents: money(f.dailyCap) ?? saved.dailyCapCents,
    requireApprovalAboveCents: money(f.requireApprovalAbove) ?? saved.requireApprovalAboveCents,
    newPayeeCooloffMin: whole(f.newPayeeCooloffMin) ?? saved.newPayeeCooloffMin, quietHoursStart: f.quietHoursStart, quietHoursEnd: f.quietHoursEnd,
    timezone: f.timezone, quorum: Number(f.quorum), escalateAfterMin: whole(f.escalateAfterMin) ?? saved.escalateAfterMin,
    holdTtlMin: whole(f.holdTtlMin) ?? saved.holdTtlMin,
  };
  const patch: Record<string, unknown> = {};
  for (const k of Object.keys(next) as Array<keyof Policy>) if (next[k] !== saved[k]) patch[k] = next[k];
  return patch as Partial<Policy>;
}

export const TIMEZONES = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Asia/Kolkata', 'UTC'];
