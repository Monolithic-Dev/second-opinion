import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock, ToolError } from '@second-opinion/shared';
import { evaluate } from '@second-opinion/engine';
import { createRepos, migrate, openDb, schemaVersion, seedDemo, DEMO_HOUSEHOLD, DEMO_APPROVER, HERO_TEXT, loadMigrations } from '../src';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const clock = fakeClock('2026-10-09T12:00:00.000Z');
  const repos = seedDemo(db, clock);
  return { db, clock, repos };
}

function makeHold(repos: ReturnType<typeof createRepos>, ttlMs = 10 * 60_000) {
  const r = evaluate(HERO_TEXT, { actionType: 'purchase' });
  const check = repos.checks.insert({
    householdId: DEMO_HOUSEHOLD, text: HERO_TEXT, channel: 'voice', actionType: 'purchase', amountCents: 100000, payee: 'gift cards',
    signals: r.signals, score: r.score, verdict: r.verdict, fingerprint: r.fingerprint,
  });
  return repos.holds.create({ householdId: DEMO_HOUSEHOLD, checkId: check.id, actionType: 'purchase', amountCents: 100000, payee: 'gift cards', description: '5 x $200 gift cards', ttlMs });
}

test('T-STORE-1 migrations apply once and are idempotent', () => {
  const db = openDb(':memory:');
  const first = migrate(db);
  const second = migrate(db);
  assert.ok(first.length >= 1);
  assert.deepEqual(second, []);
  assert.equal(schemaVersion(db), loadMigrations().at(-1)?.version);
});

test('T-STORE-2 payee names are normalised, unique and add is idempotent', () => {
  const { repos } = setup();
  const a = repos.payees.add(DEMO_HOUSEHOLD, '  Greenleaf   PHARMACY ', 'pharmacy');
  assert.equal(a.name, 'greenleaf pharmacy');
  assert.equal(a.id, 'pay_seed1');
  assert.equal(repos.payees.list(DEMO_HOUSEHOLD).length, 2);
  assert.equal(repos.payees.remove(DEMO_HOUSEHOLD, 'GREENLEAF pharmacy'), true);
  assert.equal(repos.payees.remove(DEMO_HOUSEHOLD, 'greenleaf pharmacy'), false);
});

test('T-STORE-3 foreign keys are enforced', () => {
  const { db } = setup();
  assert.throws(() =>
    db.prepare("INSERT INTO holds (id, household_id, check_id, action_type, description, created_at, expires_at) VALUES ('h','hh_demo','chk_missing','purchase','x','a','b')").run(),
  );
});

test('T-STORE-4 lazy expiry flips pending to expired and audits it', () => {
  const { repos, clock } = setup();
  const hold = makeHold(repos, 60_000);
  assert.equal(repos.holds.get(hold.id)?.status, 'pending');
  clock.advance(61_000);
  assert.equal(repos.holds.get(hold.id)?.status, 'expired');
  assert.ok(repos.audit.list(DEMO_HOUSEHOLD).some((e) => e.type === 'hold.expired'));
  assert.throws(() => repos.holds.resolve(hold.id, 'approve', DEMO_APPROVER), (e) => e instanceof ToolError && e.code === 'CONFLICT');
});

test('T-STORE-5 resolve is atomic: second call is a CONFLICT', () => {
  const { repos } = setup();
  const hold = makeHold(repos);
  const done = repos.holds.resolve(hold.id, 'deny', DEMO_APPROVER, 'scam');
  assert.equal(done.status, 'denied');
  assert.equal(done.note, 'scam');
  assert.throws(() => repos.holds.resolve(hold.id, 'deny', DEMO_APPROVER), (e) => e instanceof ToolError && e.code === 'CONFLICT');
  assert.throws(() => repos.holds.resolve('hold_nope', 'deny', DEMO_APPROVER), (e) => e instanceof ToolError && e.code === 'NOT_FOUND');
});

test('approve releases the hold', () => {
  const { repos } = setup();
  const hold = makeHold(repos);
  assert.equal(repos.holds.resolve(hold.id, 'approve', DEMO_APPROVER).status, 'released');
});

test('T-STORE-6 history includes the latest hold id for a check', () => {
  const { repos } = setup();
  const hold = makeHold(repos);
  const h = repos.checks.history(DEMO_HOUSEHOLD);
  assert.ok(h.some((i) => i.checkId === hold.check_id && i.holdId === hold.id));
  assert.ok(h.some((i) => i.checkId === 'chk_seed1' && i.holdId === 'hold_seed1'));
});

test('T-STORE-7 seed is idempotent and enables "same as" recognition', () => {
  const { db, clock, repos } = setup();
  seedDemo(db, clock);
  seedDemo(db, clock);
  assert.equal(repos.people.list(DEMO_HOUSEHOLD).length, 2);
  assert.equal(repos.payees.list(DEMO_HOUSEHOLD).length, 2);
  const again = evaluate(HERO_TEXT, { actionType: 'purchase' }, repos.checks.history(DEMO_HOUSEHOLD));
  assert.equal(again.similarTo?.checkId, 'chk_seed1');
  assert.match(again.spokenSummary, /same kind of request/);
});

test('fingerprints upsert increments seen_count', () => {
  const { repos } = setup();
  // The seed stored the hero check with payee "gift cards", so NEW_PAYEE is part of its fingerprint.
  const fp = evaluate(HERO_TEXT, { actionType: 'purchase', payee: 'gift cards' }).fingerprint;
  assert.equal(repos.fingerprints.get(DEMO_HOUSEHOLD, fp)?.seen_count, 1);
  repos.fingerprints.upsert(DEMO_HOUSEHOLD, fp, 'chk_seed1');
  assert.equal(repos.fingerprints.get(DEMO_HOUSEHOLD, fp)?.seen_count, 2);
});

test('SQL metacharacters in text are stored verbatim (T-SEC-1)', () => {
  const { repos } = setup();
  const nasty = `'); DROP TABLE holds; -- <img src=x onerror=alert(1)>`;
  const c = repos.checks.insert({ householdId: DEMO_HOUSEHOLD, text: nasty, channel: 'unknown', actionType: 'none', signals: [], score: 0, verdict: 'allow', fingerprint: 'NONE' });
  assert.equal(repos.checks.get(c.id)?.text, nasty);
  assert.equal(repos.holds.listByStatus(DEMO_HOUSEHOLD).length >= 1, true);
});

test('audit log is append-only per household and ordered newest first', () => {
  const { repos, clock } = setup();
  repos.audit.write('a', DEMO_HOUSEHOLD, { n: 1 });
  clock.advance(1000);
  repos.audit.write('b', DEMO_HOUSEHOLD, { n: 2 });
  assert.deepEqual(repos.audit.list(DEMO_HOUSEHOLD).slice(0, 2).map((e) => e.type), ['b', 'a']);
});
