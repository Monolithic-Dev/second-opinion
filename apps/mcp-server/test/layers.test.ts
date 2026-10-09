import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { LIVE_RULESET_VERSION } from '@second-opinion/engine';
import { startTestServer, HERO } from './helpers';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

const HH = 'hh_demo';
type Checked = {
  checkId: string; verdict: string; score: number; signals: Array<{ id: string }>;
  layerBreakdown: Record<string, number>; playbook: { id: string; name: string; similarity: number } | null;
};

test('T-LAYER-1 check_message reports the layer breakdown and the matched playbook', async () => {
  const { client } = await t.connect();
  const r = await t.call<Checked>(client, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase' } });
  const s = r.structuredContent!;
  assert.equal(s.verdict, 'hold');
  assert.ok(s.layerBreakdown.rules! > 0);
  assert.ok(s.layerBreakdown.playbooks! > 0 && s.layerBreakdown.playbooks! <= 30);
  assert.equal(s.playbook?.id, 'gift-card-bank');
  assert.ok(s.signals.some((x) => x.id === 'PLAYBOOK_MATCH'));
  const stored = JSON.parse(t.repos.decisions.getByCheck(s.checkId)!.features_json) as { paymentsConsidered: number };
  assert.ok(stored.paymentsConsidered >= 6, 'seeded payment history was considered');
  await client.close();
});

test('T-LAYER-2 an unusually large payment to a trusted payee raises AMOUNT_ANOMALY from household history', async () => {
  const { client } = await t.connect();
  const r = await t.call<Checked>(client, 'check_message', {
    householdId: HH, text: 'Pay Greenleaf Pharmacy $900 for the refill', context: { actionType: 'payment', amountCents: 90_000, payee: 'Greenleaf Pharmacy' },
  });
  const s = r.structuredContent!;
  assert.ok(s.signals.some((x) => x.id === 'AMOUNT_ANOMALY'));
  assert.ok(s.layerBreakdown.behavior! >= 20);
  assert.ok(s.signals.some((x) => x.id === 'TRUSTED_PAYEE'));
  await client.close();
});

test('T-LAYER-3 asking again right after family said no raises RETRY_AFTER_DENY', async () => {
  const { client } = await t.connect();
  const args = { householdId: HH, text: 'Wire $500 today or the IRS will arrest me, keep this between us', context: { actionType: 'transfer' } };
  const first = await t.call<Checked>(client, 'check_message', args);
  assert.equal(first.structuredContent?.verdict, 'hold');
  const hold = await t.call<{ holdId: string }>(client, 'place_hold', { householdId: HH, checkId: first.structuredContent!.checkId, actionType: 'transfer', description: 'wire' });
  await t.call(client, 'resolve_approval', { holdId: hold.structuredContent!.holdId, decision: 'deny', resolvedBy: 'p_priya' });
  t.clock.advance(60_000);
  const again = await t.call<Checked>(client, 'check_message', args);
  assert.ok(again.structuredContent!.signals.some((x) => x.id === 'RETRY_AFTER_DENY'));
  assert.ok(again.structuredContent!.score >= first.structuredContent!.score);
  t.clock.advance(25 * 3_600_000);
  const later = await t.call<Checked>(client, 'check_message', args);
  assert.ok(!later.structuredContent!.signals.some((x) => x.id === 'RETRY_AFTER_DENY'), 'denial is older than 24h');
  await client.close();
});

test('T-LAYER-4 money moving at night in the household timezone raises QUIET_HOURS', async () => {
  const { client } = await t.connect();
  t.clock.set('2026-10-10T05:30:00.000Z'); // 00:30 in America/Chicago
  const r = await t.call<Checked>(client, 'check_message', { householdId: HH, text: 'Send $50 to my neighbour', context: { actionType: 'transfer', payee: 'neighbour' } });
  assert.ok(r.structuredContent!.signals.some((x) => x.id === 'QUIET_HOURS'));
  t.clock.set('2026-10-10T17:00:00.000Z');
  const day = await t.call<Checked>(client, 'check_message', { householdId: HH, text: 'Send $50 to my neighbour', context: { actionType: 'transfer', payee: 'neighbour' } });
  assert.ok(!day.structuredContent!.signals.some((x) => x.id === 'QUIET_HOURS'));
  await client.close();
});

test('T-LAYER-5 decisions record the live rule-set version and layer breakdown for later replay', async () => {
  const { client } = await t.connect();
  const r = await t.call<Checked & { ruleSetVersion: string }>(client, 'check_message', { householdId: HH, text: 'Pay the plumber $40', context: { actionType: 'payment' } });
  const d = t.repos.decisions.getByCheck(r.structuredContent!.checkId)!;
  assert.equal(d.rule_set_version, r.structuredContent!.ruleSetVersion);
  assert.equal(d.rule_set_version, LIVE_RULESET_VERSION);
  assert.ok('layerBreakdown' in JSON.parse(d.features_json));
  await client.close();
});
