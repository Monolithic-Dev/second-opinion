import { FLAG_TEXT, isPositive } from '@second-opinion/engine';
import type { HoldPayload, NotifyKind } from '@second-opinion/notify';
import { REASON_TEXT, type ReasonCode } from '@second-opinion/policy';
import type { Signal } from '@second-opinion/shared';
import type { HoldRow } from '@second-opinion/store';
import type { Deps } from '../deps';

/** Build the approver-facing payload for a hold: plain-language flags and household-rule reasons. */
export function holdPayload(deps: Deps, hold: HoldRow, recipientName: string, extra: { status?: string; level?: number } = {}): HoldPayload {
  const check = deps.repos.checks.get(hold.check_id);
  const signals = check ? (JSON.parse(check.signals_json) as Signal[]) : [];
  const flags = signals.filter((s) => isPositive(s.id) && s.weight > 0).map((s) => FLAG_TEXT[s.id]).filter((f): f is string => Boolean(f));
  const reasonText = (JSON.parse(hold.reasons_json) as ReasonCode[]).map((r) => REASON_TEXT[r]).filter(Boolean);
  return {
    holdId: hold.id, recipientName, description: hold.description, amountCents: hold.amount_cents, flags, reasonText, expiresAt: hold.expires_at,
    ...(extra.status ? { status: extra.status } : {}), ...(extra.level !== undefined ? { level: extra.level } : {}),
  };
}

/**
 * Queue a notification (one row per configured channel) for each recipient. Idempotent per (hold, recipient, kind): safe to call
 * again. Must run inside the same transaction as the state change (transactional outbox). Returns the recipients newly queued.
 */
export function notifyHold(deps: Deps, kind: NotifyKind, hold: HoldRow, recipientIds: string[], extra: { status?: string; level?: number } = {}): string[] {
  const queued: string[] = [];
  for (const recipientId of recipientIds) {
    const person = deps.repos.people.get(recipientId);
    if (!person || person.household_id !== hold.household_id) continue;
    if (deps.repos.notifications.exists(hold.id, recipientId, kind)) continue;
    const payload = holdPayload(deps, hold, person.name, extra);
    for (const channel of deps.config.notifyChannels) {
      deps.repos.notifications.enqueue({ householdId: hold.household_id, recipientId, channel, kind, payload });
    }
    queued.push(recipientId);
  }
  return queued;
}
