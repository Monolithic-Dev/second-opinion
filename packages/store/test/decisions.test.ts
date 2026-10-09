import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '@second-opinion/shared';
import { evaluate } from '@second-opinion/engine';
import { migrate, openDb, seedDemo, DEMO_HOUSEHOLD, HERO_TEXT } from '../src';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const repos = seedDemo(db, fakeClock('2026-10-09T12:00:00.000Z'));
  return { db, repos };
}

test('T-STORE-8 decisions are append-only and pinned to a rule-set version', () => {
  const { db, repos } = setup();
  const r = evaluate(HERO_TEXT, { actionType: 'purchase' });
  const check = repos.checks.insert({
    householdId: DEMO_HOUSEHOLD, text: HERO_TEXT, channel: 'voice', actionType: 'purchase',
    signals: r.signals, score: r.score, verdict: r.verdict, fingerprint: r.fingerprint,
  });
  const d = repos.decisions.insert({
    householdId: DEMO_HOUSEHOLD, checkId: check.id, traceId: 'trace-0001', ruleSetVersion: r.ruleSetVersion,
    verdict: r.verdict, score: r.score, reasons: { signals: r.signals }, features: { historySize: 0 }, latencyMs: 0.4,
  });
  assert.equal(d.rule_set_version, r.ruleSetVersion);
  assert.equal(repos.decisions.getByCheck(check.id)?.id, d.id);
  assert.throws(() => db.prepare('UPDATE decisions SET score = 0 WHERE id = ?').run(d.id), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM decisions WHERE id = ?').run(d.id), /append-only/);
});

test('T-STORE-9 audit events are append-only (tamper-evident)', () => {
  const { db, repos } = setup();
  repos.audit.write('x', DEMO_HOUSEHOLD, {});
  assert.throws(() => db.prepare("UPDATE audit_events SET type = 'y'").run(), /append-only/);
  assert.throws(() => db.prepare('DELETE FROM audit_events').run(), /append-only/);
});

test('T-STORE-10 idempotency keys are unique per tool', () => {
  const { repos } = setup();
  repos.idempotency.put({ tool: 'place_hold', key: 'key-12345678', householdId: DEMO_HOUSEHOLD, requestHash: 'h1', response: { holdId: 'hold_x' } });
  assert.deepEqual(JSON.parse(repos.idempotency.get('place_hold', 'key-12345678')!.response_json), { holdId: 'hold_x' });
  assert.equal(repos.idempotency.get('resolve_approval', 'key-12345678'), undefined);
  assert.throws(() => repos.idempotency.put({ tool: 'place_hold', key: 'key-12345678', householdId: null, requestHash: 'h2', response: {} }));
});
