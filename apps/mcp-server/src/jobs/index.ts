import { dispatchDue, type Adapter, type Notification, type OutboxPort } from '@second-opinion/notify';
import { approversToNotify, maxLevel, newlyNotified, targetLevel } from '@second-opinion/policy';
import type { Deps } from '../deps';
import { notifyHold } from '../services/notifications';

/** Escalate pending holds one level per `escalateAfterMin` and notify the next approver rank exactly once. */
export function runEscalation(deps: Deps): number {
  const now = deps.clock();
  let escalated = 0;
  for (const hold of deps.repos.holds.listPending()) {
    const policy = deps.repos.policies.get(hold.household_id);
    const ranks = deps.repos.people.approvers(hold.household_id).map((a) => ({ id: a.id, rank: a.approver_rank }));
    const top = maxLevel(ranks);
    if (top < 0) continue;
    const level = targetLevel(hold.created_at, now, policy.escalateAfterMin, top);
    if (level <= hold.escalation_level) continue;
    deps.repos.transaction(() => {
      notifyHold(deps, 'hold_escalated', hold, newlyNotified(ranks, hold.escalation_level, level), { level });
      deps.repos.holds.setEscalation(hold.id, level);
      deps.repos.audit.write('hold.escalated', hold.household_id, { holdId: hold.id, level, notify: approversToNotify(ranks, level) });
    });
    escalated++;
  }
  return escalated;
}

/** Tell approvers about holds that expired (they stay blocked). Also covers holds expired lazily by a read. */
export function runExpiry(deps: Deps): number {
  deps.repos.holds.expireStale();
  let notified = 0;
  for (const hold of deps.repos.holds.expiredWithoutNotice()) {
    const approvers = deps.repos.people.approvers(hold.household_id).map((a) => a.id);
    deps.repos.transaction(() => {
      const queued = notifyHold(deps, 'hold_resolved', hold, approvers, { status: 'expired' });
      if (queued.length === 0) {
        // Nobody to tell: still record the fact so this hold is not re-examined forever.
        deps.repos.audit.write('hold.expired.unnotified', hold.household_id, { holdId: hold.id });
      }
    });
    notified++;
  }
  return notified;
}

function outboxPort(deps: Deps): OutboxPort {
  const { notifications } = deps.repos;
  return {
    due: (nowIso, limit): Notification[] =>
      notifications.due(nowIso, limit).map((r) => ({
        id: r.id, householdId: r.household_id, recipientId: r.recipient_id, channel: r.channel, kind: r.kind,
        payload: JSON.parse(r.payload_json), attempts: r.attempts,
      })),
    markSent: (id, at) => notifications.markSent(id, at),
    retry: (id, attempts, next, error) => notifications.retry(id, attempts, next, error),
    fail: (id, attempts, error) => notifications.fail(id, attempts, error),
  };
}

export function runOutbox(deps: Deps, adapters: Adapter[]) {
  return dispatchDue(outboxPort(deps), adapters, deps.clock());
}

/** One pass of every background job, in a safe order: escalate, expire, deliver. */
export async function runJobsOnce(deps: Deps, adapters: Adapter[]) {
  const escalated = runEscalation(deps);
  const expired = runExpiry(deps);
  const delivery = await runOutbox(deps, adapters);
  return { escalated, expired, delivery };
}

/** Start the interval loop. Ticks never overlap and a failing job never crashes the server. Returns a stop function. */
export function startJobs(deps: Deps, adapters: Adapter[]): () => void {
  const every = deps.config.jobsIntervalMs;
  if (every <= 0) return () => {};
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await runJobsOnce(deps, adapters);
    } catch (e) {
      deps.log.error('jobs_failed', { error: e instanceof Error ? e.message : String(e) });
    } finally {
      running = false;
    }
  }, every);
  timer.unref();
  return () => clearInterval(timer);
}
