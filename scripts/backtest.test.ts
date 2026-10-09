import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '@second-opinion/shared';
import { migrate, openDb, seedDemo } from '@second-opinion/store';
import { backtest, parseArgs, renderReport } from './backtest';

function seeded() {
  const clock = fakeClock('2026-10-09T12:00:00.000Z');
  const db = openDb(':memory:');
  migrate(db);
  const repos = seedDemo(db, clock);
  return { db, repos };
}

test('T-BT-1 backtest compares two rule sets over stored checks and reports who got stricter', () => {
  const { db, repos } = seeded();
  // A code request worded code-first, which rules-2026.10.3 does not recognise but 10.4 does.
  repos.checks.insert({
    householdId: 'hh_demo', text: 'We texted you a one time passcode. Please read it back to me so I can stop the transfer.', channel: 'call',
    actionType: 'none', signals: [], score: 0, verdict: 'allow', fingerprint: 'NONE',
    createdAt: '2026-10-09T10:00:00.000Z',
  }, 'chk_bt1');
  const r = backtest(db, 'rules-2026.10.3', 'rules-2026.10.4');
  assert.equal(r.total, 8); // 7 seeded + 1 new
  assert.ok(r.changes.some((c) => c.checkId === 'chk_bt1' && c.direction === 'more_strict'));
  assert.equal(r.unchanged + r.changes.length, r.total);
  assert.match(renderReport(r), /chk_bt1/);
});

test('T-BT-2 a rule set compared with itself changes nothing, and nothing is written', () => {
  const { db } = seeded();
  const before = (db.prepare('SELECT COUNT(*) AS n FROM checks').get() as { n: number }).n;
  const r = backtest(db, 'rules-2026.10.4', 'rules-2026.10.4');
  assert.equal(r.changes.length, 0);
  assert.equal((db.prepare('SELECT COUNT(*) AS n FROM checks').get() as { n: number }).n, before);
});

test('unknown rule sets and missing arguments explain themselves', () => {
  const { db } = seeded();
  assert.throws(() => backtest(db, 'rules-2026.10.4', 'nope'), /unknown rule set nope/);
  assert.throws(() => parseArgs([]), /usage: npm run backtest/);
  assert.equal(parseArgs(['--candidate', 'rules-2026.10.3'], {}).baseline, 'rules-2026.10.4');
});
