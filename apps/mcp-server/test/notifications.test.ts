import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailHtmlAdapter, type Adapter } from '@second-opinion/notify';
import { notifyHold } from '../src/services/notifications';
import { runEscalation, runExpiry, runJobsOnce, runOutbox, startJobs } from '../src/jobs';
import { startTestServer, HERO } from './helpers';

const HH = 'hh_demo';
type Srv = Awaited<ReturnType<typeof startTestServer>>;
type Client = Awaited<ReturnType<Srv['connect']>>['client'];

async function withServer(env: Record<string, string>, fn: (t: Srv, c: Client) => Promise<void>) {
  const t = await startTestServer(env);
  const { client } = await t.connect();
  try {
    await fn(t, client);
  } finally {
    await client.close();
    await t.close();
  }
}

async function heldHero(t: Srv, c: Client) {
  const check = await t.call<{ checkId: string }>(c, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase', amountCents: 100_000, payee: 'gift cards' } });
  const hold = await t.call<{ holdId: string }>(c, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', amountCents: 100_000, description: '5 x $200 gift cards' });
  return hold.structuredContent!.holdId;
}

const rows = (t: Srv, kind?: string) =>
  t.repos.notifications.list(HH, { limit: 200 }).filter((n) => !kind || n.kind === kind);

test('T-NTF-0 requesting approval queues one notification per channel, and repeating it adds nothing', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'request_family_approval', { holdId });
    const first = rows(t, 'hold_requested');
    assert.equal(first.length, 3, 'console + db + email_html');
    assert.deepEqual(first.map((n) => n.channel).sort(), ['console', 'db', 'email_html']);
    assert.ok(first.every((n) => n.recipient_id === 'p_priya' && n.status === 'queued'));
    const payload = JSON.parse(first[0]!.payload_json) as { holdId: string; flags: string[]; description: string; recipientName: string };
    assert.equal(payload.holdId, holdId);
    assert.equal(payload.recipientName, 'Priya');
    assert.ok(payload.flags.includes('Asks for gift cards'));
    await t.call(c, 'request_family_approval', { holdId });
    assert.equal(rows(t, 'hold_requested').length, 3, 'idempotent per hold, recipient and kind');
  });
});

test('T-NTF-2 the notification is enqueued in the same transaction as the state change (rolls back together)', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    const hold = t.repos.holds.get(holdId)!;
    assert.throws(() =>
      t.repos.transaction(() => {
        notifyHold(t.deps, 'hold_resolved', hold, ['p_priya'], { status: 'released' });
        t.repos.holds.finalize(holdId, 'released', 'p_priya');
        throw new Error('crash before commit');
      }),
    );
    assert.equal(t.repos.holds.get(holdId)!.status, 'pending', 'state change rolled back');
    assert.equal(rows(t, 'hold_resolved').length, 0, 'and so did the notification');
  });
});

test('final outcome is announced to every approver exactly once', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_priya' });
    const resolved = rows(t, 'hold_resolved');
    assert.equal(resolved.length, 6, '2 approvers x 3 channels');
    assert.deepEqual([...new Set(resolved.map((n) => n.recipient_id))].sort(), ['p_arjun', 'p_priya']);
    assert.ok(resolved.every((n) => JSON.parse(n.payload_json).status === 'denied'));
  });
});

test('T-ESC-1 escalation notifies the next approver rank once per level, never again', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'request_family_approval', { holdId });
    t.clock.advance(4 * 60_000);
    assert.equal(runEscalation(t.deps), 0, 'not yet: policy escalates after 5 minutes');
    t.clock.advance(60_000);
    assert.equal(runEscalation(t.deps), 1);
    const escalated = rows(t, 'hold_escalated');
    assert.equal(escalated.length, 3);
    assert.ok(escalated.every((n) => n.recipient_id === 'p_arjun'), 'rank 2 is newly notified, rank 1 is not nagged again');
    assert.equal(t.repos.holds.get(holdId)!.escalation_level, 1);
    t.clock.advance(60_000);
    assert.equal(runEscalation(t.deps), 0, 'already at the top level');
    assert.equal(rows(t, 'hold_escalated').length, 3);
    assert.ok(t.repos.audit.list(HH, 50).some((e) => e.type === 'hold.escalated'));
  });
});

test('escalation follows the household policy interval', async () => {
  await withServer({}, async (t, c) => {
    await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { escalateAfterMin: 2 } });
    await heldHero(t, c);
    t.clock.advance(2 * 60_000);
    assert.equal(runEscalation(t.deps), 1);
  });
});

test('T-NTF-5 expiry tells approvers once and the hold stays blocked, even if a read expired it first', async () => {
  await withServer({ HOLD_TTL_MS: '60000' }, async (t, c) => {
    const holdId = await heldHero(t, c);
    t.clock.advance(61_000);
    await t.call(c, 'list_holds', { householdId: HH });
    assert.equal(t.repos.holds.get(holdId)!.status, 'expired', 'lazily expired by the read');
    assert.equal(runExpiry(t.deps), 1);
    const notes = rows(t, 'hold_resolved');
    assert.equal(notes.length, 6);
    assert.ok(notes.every((n) => JSON.parse(n.payload_json).status === 'expired'));
    assert.equal(runExpiry(t.deps), 0, 'no repeat notices');
    const vote = await t.call(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya' });
    assert.equal(vote.structuredContent?.code, 'CONFLICT');
  });
});

test('T-NTF-1 the outbox delivers through the adapters, retries a failing channel after 5s, and marks rows sent', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'request_family_approval', { holdId });

    const files: Record<string, string> = {};
    const seen: string[] = [];
    let consoleCalls = 0;
    const adapters: Adapter[] = [
      { channel: 'console', send(n) { consoleCalls++; if (consoleCalls === 1) throw new Error('log sink unavailable'); seen.push(n.id); } },
      { channel: 'db', send() {} },
      emailHtmlAdapter('/out', (path, html) => { files[path.replace(/\\/g, '/')] = html; }),
    ];

    const first = await runOutbox(t.deps, adapters);
    assert.deepEqual(first, { sent: 2, retried: 1, failed: 0 });
    const email = rows(t, 'hold_requested').find((n) => n.channel === 'email_html')!;
    assert.equal(email.status, 'sent');
    const html = files[`/out/${email.id}.html`]!;
    assert.match(html, /5 x \$200 gift cards/);
    assert.match(html, /Asks for gift cards/);
    assert.ok(!html.includes('<script'));

    const stuck = rows(t, 'hold_requested').find((n) => n.channel === 'console')!;
    assert.equal(stuck.status, 'queued');
    assert.equal(stuck.attempts, 1);
    assert.match(stuck.last_error ?? '', /log sink unavailable/);

    assert.deepEqual(await runOutbox(t.deps, adapters), { sent: 0, retried: 0, failed: 0 }, 'not due before the backoff');
    t.clock.advance(5_000);
    assert.deepEqual(await runOutbox(t.deps, adapters), { sent: 1, retried: 0, failed: 0 });
    assert.deepEqual(t.repos.notifications.countByStatus(), [{ status: 'sent', n: 3 }]);
  });
});

test('list_notifications shows delivery status, filters by recipient and is read-only', async () => {
  await withServer({}, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'request_family_approval', { holdId });
    t.clock.advance(5 * 60_000);
    runEscalation(t.deps);
    const before = t.repos.notifications.list(HH, { limit: 200 }).length;
    const all = await t.call<{ notifications: Array<{ recipientId: string; kind: string; status: string; holdId: string }> }>(c, 'list_notifications', { householdId: HH });
    assert.equal(all.structuredContent!.notifications.length, before);
    const arjun = await t.call<{ notifications: Array<{ recipientId: string; kind: string }> }>(c, 'list_notifications', { householdId: HH, recipientId: 'p_arjun' });
    assert.ok(arjun.structuredContent!.notifications.every((n) => n.recipientId === 'p_arjun' && n.kind === 'hold_escalated'));
    const limited = await t.call<{ notifications: unknown[] }>(c, 'list_notifications', { householdId: HH, limit: 2 });
    assert.equal(limited.structuredContent!.notifications.length, 2);
    assert.equal(t.repos.notifications.list(HH, { limit: 200 }).length, before, 'listing queues nothing');
  });
});

test('runJobsOnce runs escalate, expire and deliver in order and reports each', async () => {
  await withServer({ HOLD_TTL_MS: '600000' }, async (t, c) => {
    const holdId = await heldHero(t, c);
    await t.call(c, 'request_family_approval', { holdId });
    t.clock.advance(5 * 60_000);
    const out = await runJobsOnce(t.deps, [{ channel: 'console', send() {} }, { channel: 'db', send() {} }, { channel: 'email_html', send() {} }]);
    assert.equal(out.escalated, 1);
    assert.equal(out.expired, 0);
    assert.equal(out.delivery.sent, 6, '3 requested + 3 escalated');
  });
});

test('background jobs are disabled in the test environment (interval 0)', async () => {
  await withServer({}, async (t) => {
    assert.equal(t.deps.config.jobsIntervalMs, 0);
    const stop = startJobs(t.deps, []);
    assert.equal(typeof stop, 'function');
    stop();
  });
});
