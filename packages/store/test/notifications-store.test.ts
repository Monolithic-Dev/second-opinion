import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeClock } from '@second-opinion/shared';
import { migrate, openDb, schemaVersion, seedDemo, DEMO_HOUSEHOLD, DEMO_APPROVER } from '../src';

function setup() {
  const db = openDb(':memory:');
  migrate(db);
  const clock = fakeClock('2026-10-09T12:00:00.000Z');
  return { db, clock, repos: seedDemo(db, clock) };
}
const note = (over: Partial<Parameters<ReturnType<typeof setup>['repos']['notifications']['enqueue']>[0]> = {}) => ({
  householdId: DEMO_HOUSEHOLD, recipientId: DEMO_APPROVER, channel: 'console' as const, kind: 'hold_requested' as const,
  payload: { holdId: 'hold_x', description: 'x' }, ...over,
});

test('T-OUTBOX-1 migration 004 exists and the outbox lifecycle works: queued, retry, sent, failed', () => {
  const { db, clock, repos } = setup();
  assert.ok(schemaVersion(db) >= 4);
  const a = repos.notifications.enqueue(note());
  const b = repos.notifications.enqueue(note({ channel: 'db' }));
  assert.equal(a.status, 'queued');
  assert.deepEqual(repos.notifications.due(clock().toISOString()).map((n) => n.id), [a.id, b.id]);

  repos.notifications.retry(a.id, 1, '2026-10-09T12:00:05.000Z', 'blip');
  assert.deepEqual(repos.notifications.due(clock().toISOString()).map((n) => n.id), [b.id], 'a retried row is not due before its time');
  assert.deepEqual(repos.notifications.due('2026-10-09T12:00:05.000Z').map((n) => n.id), [a.id, b.id]);

  repos.notifications.markSent(b.id, clock().toISOString());
  repos.notifications.fail(a.id, 4, 'gave up');
  assert.deepEqual(repos.notifications.due('2030-01-01T00:00:00.000Z'), []);
  assert.deepEqual(repos.notifications.countByStatus().sort((x, y) => x.status.localeCompare(y.status)), [{ status: 'failed', n: 1 }, { status: 'sent', n: 1 }]);
});

test('exists() is scoped to hold, recipient and kind', () => {
  const { repos } = setup();
  repos.notifications.enqueue(note());
  assert.equal(repos.notifications.exists('hold_x', DEMO_APPROVER, 'hold_requested'), true);
  assert.equal(repos.notifications.exists('hold_x', DEMO_APPROVER, 'hold_resolved'), false);
  assert.equal(repos.notifications.exists('hold_y', DEMO_APPROVER, 'hold_requested'), false);
  assert.equal(repos.notifications.exists('hold_x', 'p_arjun', 'hold_requested'), false);
});

test('the channel and kind columns reject unknown values', () => {
  const { repos } = setup();
  assert.throws(() => repos.notifications.enqueue(note({ channel: 'sms' as never })));
  assert.throws(() => repos.notifications.enqueue(note({ kind: 'spam' as never })));
});

test('list is newest first, scoped to the household and optionally to a recipient', () => {
  const { repos, clock } = setup();
  repos.notifications.enqueue(note({ payload: { holdId: 'h1', description: 'first' } }));
  clock.advance(1000);
  repos.notifications.enqueue(note({ recipientId: 'p_arjun', payload: { holdId: 'h2', description: 'second' } }));
  const all = repos.notifications.list(DEMO_HOUSEHOLD);
  assert.deepEqual(all.map((n) => JSON.parse(n.payload_json).description), ['second', 'first']);
  assert.equal(repos.notifications.list(DEMO_HOUSEHOLD, { recipientId: DEMO_APPROVER }).length, 1);
  assert.equal(repos.notifications.list('hh_other').length, 0);
});
