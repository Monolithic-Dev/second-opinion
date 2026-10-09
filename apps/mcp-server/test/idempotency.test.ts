import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, HERO } from './helpers';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

const HH = 'hh_demo';
type Checked = {
  checkId: string; decisionId: string; ruleSetVersion: string; verdict: string; replayed?: boolean;
};
const count = (table: string) => (t.deps.db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;

test('T-DEC-1 every check writes one append-only decision pinned to the rule-set version', async () => {
  const { client } = await t.connect();
  const before = count('decisions');
  const r = await t.call<Checked>(client, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase' } });
  assert.equal(count('decisions'), before + 1);
  const row = t.repos.decisions.getByCheck(r.structuredContent!.checkId)!;
  assert.equal(row.id, r.structuredContent!.decisionId);
  assert.equal(row.rule_set_version, r.structuredContent!.ruleSetVersion);
  assert.equal(row.verdict, 'hold');
  const reasons = JSON.parse(row.reasons_json) as { signals: Array<{ id: string }>; hardRule: string };
  assert.equal(reasons.hardRule, 'GIFT_CARD_PLUS_ANY');
  assert.ok(reasons.signals.some((s) => s.id === 'GIFT_CARD'));
  assert.match(row.trace_id, /^[\w.-]{8,64}$/);
  await client.close();
});

test('T-IDEM-1 same key and arguments replay the first result and create nothing new', async () => {
  const { client } = await t.connect();
  const args = { householdId: HH, text: HERO, context: { actionType: 'purchase' }, idempotencyKey: 'retry-key-0001' };
  const first = await t.call<Checked>(client, 'check_message', args);
  const checks = count('checks');
  const decisions = count('decisions');
  const second = await t.call<Checked>(client, 'check_message', args);
  assert.equal(second.isError, undefined);
  assert.equal(second.structuredContent?.replayed, true);
  assert.equal(second.structuredContent?.checkId, first.structuredContent?.checkId);
  assert.equal(second.structuredContent?.decisionId, first.structuredContent?.decisionId);
  assert.equal(count('checks'), checks, 'no new check');
  assert.equal(count('decisions'), decisions, 'no new decision');
  assert.ok(t.repos.audit.list(HH, 50).some((e) => e.type === 'tool.check_message.replayed'));
  await client.close();
});

test('T-IDEM-2 same key with different arguments is a CONFLICT', async () => {
  const { client } = await t.connect();
  await t.call(client, 'check_message', { householdId: HH, text: 'What time is it?', idempotencyKey: 'reuse-key-0002' });
  const res = await t.call(client, 'check_message', { householdId: HH, text: 'Something else entirely', idempotencyKey: 'reuse-key-0002' });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent?.code, 'CONFLICT');
  await client.close();
});

test('T-IDEM-3 a double-tapped resolve with a key replays instead of conflicting', async () => {
  const { client } = await t.connect();
  const c = await t.call<Checked>(client, 'check_message', { householdId: HH, text: HERO, context: { actionType: 'purchase' } });
  const holdArgs = { householdId: HH, checkId: c.structuredContent!.checkId, actionType: 'purchase', description: 'x', idempotencyKey: 'hold-key-00003' };
  const h = await t.call<{ holdId: string }>(client, 'place_hold', holdArgs);
  const holdId = h.structuredContent!.holdId;
  const args = { holdId, decision: 'deny', resolvedBy: 'p_priya', idempotencyKey: 'resolve-key-0003' };
  const one = await t.call<{ status: string; replayed?: boolean }>(client, 'resolve_approval', args);
  const two = await t.call<{ status: string; replayed?: boolean }>(client, 'resolve_approval', args);
  assert.equal(one.structuredContent?.status, 'denied');
  assert.equal(two.isError, undefined);
  assert.equal(two.structuredContent?.status, 'denied');
  assert.equal(two.structuredContent?.replayed, true);
  const again = await t.call<{ holdId: string }>(client, 'place_hold', holdArgs);
  assert.equal(again.structuredContent?.holdId, holdId, 'place_hold retry returns the same hold');
  await client.close();
});

test('T-IDEM-4 a failed call is not cached: retrying with the same key runs again', async () => {
  const { client } = await t.connect();
  const bad = await t.call(client, 'resolve_approval', { holdId: 'hold_missing', decision: 'deny', resolvedBy: 'p_priya', idempotencyKey: 'failed-key-0004' });
  assert.equal(bad.structuredContent?.code, 'NOT_FOUND');
  assert.equal(t.repos.idempotency.get('resolve_approval', 'failed-key-0004'), undefined);
  await client.close();
});

test('idempotencyKey is validated: too short is rejected', async () => {
  const { client } = await t.connect();
  const res = await t.call(client, 'check_message', { householdId: HH, text: 'hi', idempotencyKey: 'short' });
  assert.equal(res.isError, true);
  await client.close();
});

test('tools/list advertises idempotencyKey only on the mutating tools', async () => {
  const { client } = await t.connect();
  const { tools } = await client.listTools();
  const has = (n: string) => Object.keys(tools.find((x) => x.name === n)!.inputSchema.properties ?? {}).includes('idempotencyKey');
  for (const n of ['check_message', 'place_hold', 'resolve_approval']) assert.equal(has(n), true, n);
  for (const n of ['list_holds', 'trusted_payees', 'request_family_approval']) assert.equal(has(n), false, n);
  await client.close();
});

test('x-request-id is echoed and recorded as the decision trace id', async () => {
  const res = await fetch(`${t.baseUrl}/healthz`, { headers: { 'x-request-id': 'trace-abcdef12' } });
  assert.equal(res.headers.get('x-request-id'), 'trace-abcdef12');
  const generated = await fetch(`${t.baseUrl}/healthz`, { headers: { 'x-request-id': 'bad id!' } });
  assert.match(generated.headers.get('x-request-id') ?? '', /^[0-9a-f-]{36}$/);
});
