import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, HERO } from './helpers';

const HH = 'hh_demo';
type Srv = Awaited<ReturnType<typeof startTestServer>>;
type Checked = {
  checkId: string; verdict: string;
  decision: { outcome: 'allow' | 'require_approval' | 'block'; reasons: string[]; reasonText: string[]; quorum: number };
};
type Resolved = { status: string; resolvedAt: string | null; votes: { approve: number; deny: number; required: number } };

/** A fresh server per test: policy changes must not leak between tests. */
async function withServer(fn: (t: Srv, client: Awaited<ReturnType<Srv['connect']>>['client']) => Promise<void>) {
  const t = await startTestServer();
  const { client } = await t.connect();
  try {
    await fn(t, client);
  } finally {
    await client.close();
    await t.close();
  }
}

const heroCheck = (t: Srv, client: Parameters<Parameters<typeof withServer>[0]>[1]) =>
  t.call<Checked>(client, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase', amountCents: 100_000, payee: 'gift cards' } });

test('T-POLICY-1 get_policy returns defaults until a policy is saved', async () => {
  await withServer(async (t, c) => {
    const r = await t.call<{ policy: { quorum: number; maxSingleCents: number }; isDefault: boolean }>(c, 'get_policy', { householdId: HH });
    assert.equal(r.structuredContent?.isDefault, true);
    assert.equal(r.structuredContent?.policy.quorum, 1);
    assert.equal(r.structuredContent?.policy.maxSingleCents, 50_000);
  });
});

test('T-POLICY-2 set_policy: approver can change it, the change is audited, unchanged patch is a no-op', async () => {
  await withServer(async (t, c) => {
    const r = await t.call<{ changed: string[]; policy: { quorum: number } }>(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { quorum: 2 } });
    assert.deepEqual(r.structuredContent?.changed, ['quorum']);
    const got = await t.call<{ isDefault: boolean; policy: { quorum: number } }>(c, 'get_policy', { householdId: HH });
    assert.equal(got.structuredContent?.isDefault, false);
    assert.equal(got.structuredContent?.policy.quorum, 2);
    const audit = t.repos.audit.list(HH, 50).find((e) => e.type === 'policy.updated');
    assert.ok(audit);
    assert.deepEqual(JSON.parse(audit!.payload_json).changes.quorum, { from: 1, to: 2 });
    const again = await t.call<{ changed: string[] }>(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { quorum: 2 } });
    assert.deepEqual(again.structuredContent?.changed, []);
  });
});

test('T-POLICY-3 set_policy rejects the elder, bad ranges, unknown keys and impossible combinations', async () => {
  await withServer(async (t, c) => {
    const elder = await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_dorothy', patch: { quorum: 2 } });
    assert.equal(elder.structuredContent?.code, 'FORBIDDEN');
    const range = await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { maxSingleCents: 5 } });
    assert.equal(range.structuredContent?.code, 'INVALID_INPUT');
    assert.match(range.structuredContent!.message!, /maxSingleCents/);
    const esc = await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { escalateAfterMin: 30 } });
    assert.match(esc.structuredContent!.message!, /escalateAfterMin/);
    const tz = await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { timezone: 'Mars/Base' } });
    assert.match(tz.structuredContent!.message!, /timezone/);
    const unknown = await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { bogus: 1 } });
    assert.equal(unknown.isError, true);
    assert.equal(t.repos.policies.get(HH).quorum, 1, 'nothing changed');
  });
});

test('T-POLICY-4 over-the-limit payment to a trusted payee needs approval and can be held', async () => {
  await withServer(async (t, c) => {
    const r = await t.call<Checked & { checkId: string }>(c, 'check_message', {
      householdId: HH, text: 'Pay Greenleaf Pharmacy $600 for the refill', context: { actionType: 'payment', amountCents: 60_000, payee: 'Greenleaf Pharmacy' },
    });
    assert.equal(r.structuredContent?.verdict, 'allow', 'risk alone would allow it');
    assert.equal(r.structuredContent?.decision.outcome, 'require_approval');
    assert.ok(r.structuredContent?.decision.reasons.includes('OVER_SINGLE_LIMIT'));
    assert.ok(r.structuredContent?.decision.reasonText.some((x) => /single-payment limit/i.test(x)));
    const hold = await t.call<{ holdId: string; reasons: string[] }>(c, 'place_hold', { householdId: HH, checkId: r.structuredContent!.checkId, actionType: 'payment', amountCents: 60_000, description: 'refill' });
    assert.equal(hold.isError, undefined);
    assert.ok(hold.structuredContent?.reasons.includes('OVER_SINGLE_LIMIT'));
  });
});

test('T-POLICY-5 first payment to a new payee cools off; a trusted ordinary payment sails through', async () => {
  await withServer(async (t, c) => {
    const neighbour = await t.call<Checked>(c, 'check_message', { householdId: HH, text: 'Send $50 to my neighbour', context: { actionType: 'transfer', amountCents: 5_000, payee: 'neighbour' } });
    assert.equal(neighbour.structuredContent?.decision.outcome, 'require_approval');
    assert.deepEqual(neighbour.structuredContent?.decision.reasons, ['NEW_PAYEE_COOLOFF']);
    const pharmacy = await t.call<Checked>(c, 'check_message', { householdId: HH, text: 'Pay Greenleaf Pharmacy $24', context: { actionType: 'payment', amountCents: 2_400, payee: 'Greenleaf Pharmacy' } });
    assert.deepEqual(pharmacy.structuredContent?.decision, { outcome: 'allow', reasons: [], reasonText: [], quorum: 1 });
  });
});

test('T-POLICY-6 the daily cap blocks; a blocked request cannot be held', async () => {
  await withServer(async (t, c) => {
    await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { dailyCapCents: 100_000 } });
    const pay = (text: string) => t.call<Checked>(c, 'check_message', { householdId: HH, text, context: { actionType: 'payment', amountCents: 45_000, payee: 'Greenleaf Pharmacy' } });
    assert.equal((await pay('Pay Greenleaf Pharmacy $450 for the first order')).structuredContent?.decision.outcome, 'allow');
    assert.equal((await pay('Pay Greenleaf Pharmacy $450 for the second order')).structuredContent?.decision.outcome, 'allow');
    const third = await pay('Pay Greenleaf Pharmacy $450 for the third order');
    assert.equal(third.structuredContent?.decision.outcome, 'block');
    assert.ok(third.structuredContent?.decision.reasons.includes('DAILY_CAP'));
    const hold = await t.call(c, 'place_hold', { householdId: HH, checkId: third.structuredContent!.checkId, actionType: 'payment', description: 'third' });
    assert.equal(hold.isError, true);
    assert.equal(hold.structuredContent?.code, 'FORBIDDEN');
    assert.match(hold.structuredContent!.message!, /family console/);
  });
});

test('T-POLICY-7 quiet hours (household timezone) require approval at night', async () => {
  await withServer(async (t, c) => {
    t.clock.set('2026-10-10T05:30:00.000Z'); // 00:30 in America/Chicago
    const night = await t.call<Checked>(c, 'check_message', { householdId: HH, text: 'Pay Greenleaf Pharmacy $24', context: { actionType: 'payment', amountCents: 2_400, payee: 'Greenleaf Pharmacy' } });
    assert.deepEqual(night.structuredContent?.decision.reasons, ['QUIET_HOURS']);
    await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { timezone: 'Asia/Kolkata' } });
    const kolkata = await t.call<Checked>(c, 'check_message', { householdId: HH, text: 'Pay Greenleaf Pharmacy $24 now', context: { actionType: 'payment', amountCents: 2_400, payee: 'Greenleaf Pharmacy' } });
    assert.equal(kolkata.structuredContent?.decision.outcome, 'allow', '11:00 in Kolkata');
  });
});

test('T-Q-1 two approvers: pending after one approval, released after the second distinct approver', async () => {
  await withServer(async (t, c) => {
    await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { quorum: 2 } });
    const check = await heroCheck(t, c);
    assert.equal(check.structuredContent?.decision.quorum, 2);
    const hold = await t.call<{ holdId: string; quorumRequired: number }>(c, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
    assert.equal(hold.structuredContent?.quorumRequired, 2);
    const holdId = hold.structuredContent!.holdId;

    const one = await t.call<Resolved>(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya' });
    assert.equal(one.structuredContent?.status, 'pending');
    assert.deepEqual(one.structuredContent?.votes, { approve: 1, deny: 0, required: 2 });
    assert.equal(one.structuredContent?.resolvedAt, null);

    const repeat = await t.call<Resolved>(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya' });
    assert.equal(repeat.isError, undefined, 'identical repeat vote is a no-op');
    assert.equal(repeat.structuredContent?.votes.approve, 1);

    const flip = await t.call(c, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_priya' });
    assert.equal(flip.structuredContent?.code, 'CONFLICT');

    const list = await t.call<{ holds: Array<{ holdId: string; votes: { approve: number }; quorumRequired: number }> }>(c, 'list_holds', { householdId: HH, status: 'pending' });
    const mine = list.structuredContent!.holds.find((h) => h.holdId === holdId)!;
    assert.deepEqual([mine.votes.approve, mine.quorumRequired], [1, 2]);

    const two = await t.call<Resolved>(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_arjun' });
    assert.equal(two.structuredContent?.status, 'released');
    assert.deepEqual(two.structuredContent?.votes, { approve: 2, deny: 0, required: 2 });
    assert.ok(two.structuredContent?.resolvedAt);
  });
});

test('T-Q-2 any single deny vetoes a two-approver hold', async () => {
  await withServer(async (t, c) => {
    await t.call(c, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { quorum: 2 } });
    const check = await heroCheck(t, c);
    const hold = await t.call<{ holdId: string }>(c, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
    const holdId = hold.structuredContent!.holdId;
    await t.call(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya' });
    const veto = await t.call<Resolved>(c, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_arjun', note: 'not my bank' });
    assert.equal(veto.structuredContent?.status, 'denied');
    const late = await t.call(c, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_arjun' });
    assert.equal(late.structuredContent?.code, 'CONFLICT', 'finished holds accept no more votes');
  });
});

test('T-Q-3 the elder can never vote, even on a hold that is still pending', async () => {
  await withServer(async (t, c) => {
    const check = await heroCheck(t, c);
    const hold = await t.call<{ holdId: string }>(c, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
    const res = await t.call(c, 'resolve_approval', { holdId: hold.structuredContent!.holdId, decision: 'approve', resolvedBy: 'p_dorothy' });
    assert.equal(res.structuredContent?.code, 'FORBIDDEN');
    assert.equal(t.repos.approvals.list(hold.structuredContent!.holdId).length, 0);
  });
});

test('T-INSIGHTS-1 household_insights summarises protection from the stored history', async () => {
  await withServer(async (t, c) => {
    const check = await heroCheck(t, c);
    const hold = await t.call<{ holdId: string }>(c, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', amountCents: 100_000, description: '5 x $200 gift cards' });
    t.clock.advance(42_000);
    await t.call(c, 'resolve_approval', { holdId: hold.structuredContent!.holdId, decision: 'deny', resolvedBy: 'p_priya' });
    const r = await t.call<{
      protectedCents: number; holdsByStatus: Record<string, number>; topSignals: Array<{ id: string }>;
      checksByDay: Array<{ date: string; hold: number }>; medianResponseSec: number | null; days: number;
    }>(c, 'household_insights', { householdId: HH, days: 30 });
    const s = r.structuredContent!;
    assert.equal(s.days, 30);
    assert.ok(s.protectedCents >= 200_000, 'seeded denied hold ($1000) plus this one ($1000)');
    assert.ok(s.holdsByStatus.denied! >= 2);
    assert.ok(s.topSignals.some((x) => x.id === 'GIFT_CARD'));
    assert.ok(s.checksByDay.some((d) => d.hold >= 1));
    assert.ok(s.medianResponseSec !== null && s.medianResponseSec >= 0);
    const bad = await t.call(c, 'household_insights', { householdId: HH, days: 0 });
    assert.equal(bad.isError, true);
  });
});

test('policy tools are annotated honestly (read-only vs writing)', async () => {
  await withServer(async (_t, c) => {
    const { tools } = await c.listTools();
    const hint = (n: string) => tools.find((x) => x.name === n)!.annotations!;
    assert.equal(hint('get_policy').readOnlyHint, true);
    assert.equal(hint('household_insights').readOnlyHint, true);
    assert.equal(hint('set_policy').readOnlyHint, false);
    assert.equal(hint('set_policy').destructiveHint, false);
  });
});
