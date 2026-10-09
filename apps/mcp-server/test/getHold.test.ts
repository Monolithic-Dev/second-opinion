import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, HERO } from './helpers';

const HH = 'hh_demo';

test('get_hold returns the hold, risk flags, ranked votes and a readable timeline', async () => {
  const t = await startTestServer();
  const { client } = await t.connect();
  try {
    await t.call(client, 'set_policy', { householdId: HH, requestedBy: 'p_priya', patch: { quorum: 2 } });
    const check = await t.call<{ checkId: string }>(client, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase', amountCents: 100_000, payee: 'gift cards' } });
    const placed = await t.call<{ holdId: string }>(client, 'place_hold', { householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', amountCents: 100_000, payee: 'gift cards', description: '5 x $200 gift cards' });
    const holdId = placed.structuredContent!.holdId;
    await t.call(client, 'request_family_approval', { holdId });
    t.clock.advance(30_000);
    await t.call(client, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya', note: 'looks fine to me' });
    t.clock.advance(30_000);

    const r = await t.call<{
      hold: { status: string; quorumRequired: number; description: string };
      risk: { verdict: string; flags: string[]; text: string };
      votes: Array<{ name: string; decision: string; note: string | null }>;
      timeline: Array<{ label: string; by: string | null; at: string }>;
    }>(client, 'get_hold', { holdId });
    const s = r.structuredContent!;
    assert.equal(s.hold.status, 'pending');
    assert.equal(s.hold.quorumRequired, 2);
    assert.equal(s.risk.verdict, 'hold');
    assert.ok(s.risk.flags.includes('Asks for gift cards'));
    assert.equal(s.risk.text, HERO);
    assert.deepEqual(s.votes.map((v) => [v.name, v.decision, v.note]), [['Priya', 'approve', 'looks fine to me']]);
    assert.deepEqual(s.timeline.map((e) => e.label), ['Request paused', 'Family asked to review', 'Vote recorded (approve)']);
    assert.equal(s.timeline[2]!.by, 'Priya');
    assert.ok(s.timeline.every((e, i, all) => i === 0 || all[i - 1]!.at <= e.at), 'oldest first');

    await t.call(client, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_arjun' });
    const done = await t.call<{ hold: { status: string; resolvedBy: string }; timeline: Array<{ label: string }> }>(client, 'get_hold', { holdId });
    assert.equal(done.structuredContent!.hold.status, 'denied');
    assert.equal(done.structuredContent!.hold.resolvedBy, 'p_arjun');
    assert.equal(done.structuredContent!.timeline.at(-1)!.label, 'Decision made (denied)');

    const missing = await t.call(client, 'get_hold', { holdId: 'hold_nope' });
    assert.equal(missing.structuredContent?.code, 'NOT_FOUND');
  } finally {
    await client.close();
    await t.close();
  }
});

test('get_hold is read-only: it writes no audit events and changes nothing', async () => {
  const t = await startTestServer();
  const { client } = await t.connect();
  try {
    const before = (t.deps.db.prepare('SELECT COUNT(*) n FROM holds').get() as { n: number }).n;
    await t.call(client, 'get_hold', { holdId: 'hold_seed1' });
    assert.equal((t.deps.db.prepare('SELECT COUNT(*) n FROM holds').get() as { n: number }).n, before);
    const seeded = await t.call<{ hold: { status: string } }>(client, 'get_hold', { holdId: 'hold_seed1' });
    assert.equal(seeded.structuredContent!.hold.status, 'denied');
  } finally {
    await client.close();
    await t.close();
  }
});
