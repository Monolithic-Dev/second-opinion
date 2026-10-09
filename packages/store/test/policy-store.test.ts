import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock, ToolError } from '@second-opinion/shared';
import { defaultPolicy } from '@second-opinion/policy';
import { evaluate } from '@second-opinion/engine';
import { migrate, openDb, schemaVersion, seedDemo, DEMO_APPROVER, DEMO_HOUSEHOLD, DEMO_SECOND_APPROVER, HERO_TEXT } from '../src';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const clock = fakeClock('2026-10-09T12:00:00.000Z');
  const repos = seedDemo(db, clock);
  return { db, clock, repos };
}

function newCheck(repos: ReturnType<typeof setup>['repos'], over: Partial<Parameters<typeof repos.checks.insert>[0]> = {}) {
  const r = evaluate(HERO_TEXT, { actionType: 'purchase' });
  return repos.checks.insert({
    householdId: DEMO_HOUSEHOLD, text: HERO_TEXT, channel: 'voice', actionType: 'purchase', amountCents: 10_000, payee: 'acme',
    signals: r.signals, score: r.score, verdict: r.verdict, fingerprint: r.fingerprint, ...over,
  });
}

test('T-POLSTORE-1 migration 003 is applied and the demo household has two ranked approvers', () => {
  const { db, repos } = setup();
  assert.ok(schemaVersion(db) >= 3);
  const approvers = repos.people.approvers(DEMO_HOUSEHOLD);
  assert.deepEqual(approvers.map((a) => a.id), [DEMO_APPROVER, DEMO_SECOND_APPROVER]);
  assert.deepEqual(approvers.map((a) => a.approver_rank), [1, 2]);
});

test('T-POLSTORE-2 policy defaults apply until saved, then round-trip', () => {
  const { repos } = setup();
  assert.deepEqual(repos.policies.get(DEMO_HOUSEHOLD), defaultPolicy);
  repos.policies.upsert(DEMO_HOUSEHOLD, { ...defaultPolicy, quorum: 2, maxSingleCents: 70_000 }, DEMO_APPROVER);
  const saved = repos.policies.get(DEMO_HOUSEHOLD);
  assert.equal(saved.quorum, 2);
  assert.equal(saved.maxSingleCents, 70_000);
  repos.policies.upsert(DEMO_HOUSEHOLD, { ...saved, quorum: 1 }, DEMO_APPROVER);
  assert.equal(repos.policies.get(DEMO_HOUSEHOLD).quorum, 1);
});

test('T-POLSTORE-3 one vote per approver per hold', () => {
  const { repos } = setup();
  const hold = repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: newCheck(repos).id, actionType: 'purchase', description: 'x', ttlMs: 60_000, quorumRequired: 2 });
  assert.equal(hold.quorum_required, 2);
  repos.approvals.add(hold.id, DEMO_APPROVER, 'approve');
  assert.throws(() => repos.approvals.add(hold.id, DEMO_APPROVER, 'deny'));
  repos.approvals.add(hold.id, DEMO_SECOND_APPROVER, 'approve');
  assert.equal(repos.approvals.list(hold.id).length, 2);
});

test('T-POLSTORE-4 spend counts allowed payments and pending/released holds, not denied or expired ones', () => {
  const { repos } = setup();
  const since = '2026-10-09T00:00:00.000Z';
  const base = repos.spend.since(DEMO_HOUSEHOLD, since).reduce((a, s) => a + s.amountCents, 0);
  assert.equal(base, 0, 'seeded payments are days old');

  const allowed = newCheck(repos, { verdict: 'allow', score: 0, amountCents: 1_000 });
  void allowed;
  const pendingCheck = newCheck(repos, { amountCents: 2_000 });
  repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: pendingCheck.id, actionType: 'purchase', amountCents: 2_000, description: 'pending', ttlMs: 60_000 });
  const deniedCheck = newCheck(repos, { amountCents: 4_000 });
  const denied = repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: deniedCheck.id, actionType: 'purchase', amountCents: 4_000, description: 'denied', ttlMs: 60_000 });
  repos.holds.finalize(denied.id, 'denied', DEMO_APPROVER);
  const releasedCheck = newCheck(repos, { amountCents: 8_000 });
  const released = repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: releasedCheck.id, actionType: 'purchase', amountCents: 8_000, description: 'released', ttlMs: 60_000 });
  repos.holds.finalize(released.id, 'released', DEMO_APPROVER);

  const total = repos.spend.since(DEMO_HOUSEHOLD, since).reduce((a, s) => a + s.amountCents, 0);
  assert.equal(total, 1_000 + 2_000 + 8_000);
});

test('T-POLSTORE-5 firstPaidAt is normalised and ignores unpaid/denied attempts', () => {
  const { repos } = setup();
  assert.equal(repos.payments.firstPaidAt(DEMO_HOUSEHOLD, 'GREENLEAF  Pharmacy'), repos.payments.firstPaidAt(DEMO_HOUSEHOLD, 'greenleaf pharmacy'));
  assert.ok(repos.payments.firstPaidAt(DEMO_HOUSEHOLD, 'greenleaf pharmacy'), 'seeded history');
  assert.equal(repos.payments.firstPaidAt(DEMO_HOUSEHOLD, 'never paid'), null);
  newCheck(repos, { payee: 'sketchy shop' });
  assert.equal(repos.payments.firstPaidAt(DEMO_HOUSEHOLD, 'sketchy shop'), null, 'a held/unreleased request is not a payment');
});

test('T-POLSTORE-6 finalize is exactly-once and keeps decisions append-only columns intact', () => {
  const { repos } = setup();
  const hold = repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: newCheck(repos).id, actionType: 'purchase', description: 'x', ttlMs: 60_000 });
  assert.equal(repos.holds.finalize(hold.id, 'released', DEMO_APPROVER).status, 'released');
  assert.throws(() => repos.holds.finalize(hold.id, 'denied', DEMO_APPROVER), (e) => e instanceof ToolError && e.code === 'CONFLICT');
  repos.holds.setEscalation(hold.id, 1);
  assert.equal(repos.holds.get(hold.id)?.escalation_level, 1);
});

test('T-POLSTORE-7 decisions record the policy outcome at insert time', () => {
  const { repos } = setup();
  const c = newCheck(repos);
  const d = repos.decisions.insert({
    householdId: DEMO_HOUSEHOLD, checkId: c.id, traceId: 'trace-00000001', ruleSetVersion: 'rules-2026.10.2', verdict: 'hold', score: 100,
    reasons: {}, features: {}, latencyMs: 1, policyOutcome: 'require_approval', policyReasons: ['RISK_HOLD'], quorum: 2,
  });
  assert.equal(d.policy_outcome, 'require_approval');
  assert.deepEqual(JSON.parse(d.policy_reasons_json), ['RISK_HOLD']);
  assert.equal(d.quorum, 2);
});
