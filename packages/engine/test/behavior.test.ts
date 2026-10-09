import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { DeniedItem, PaymentItem } from '@second-opinion/shared';
import { detectBehaviorSignals, evaluate, isQuietHour, localHour } from '../src';

const NOON = new Date('2026-10-09T17:00:00.000Z'); // 12:00 in Chicago (CDT)
const day = (n: number) => new Date(NOON.getTime() - n * 86_400_000).toISOString();
const pay = (cents: number, payee: string | null, daysAgo: number): PaymentItem => ({ amountCents: cents, payee, at: day(daysAgo) });
const base = { denied: [] as DeniedItem[], baseFingerprint: 'NONE', now: NOON, timezone: 'America/Chicago' };
const ids = (s: Array<{ id: string }>) => s.map((x) => x.id);

const usual: PaymentItem[] = [2400, 3100, 2800, 8600, 2500, 3000].map((c, i) => pay(c, 'greenleaf pharmacy', i + 1));

test('T-BEH-1 amount anomaly needs 5+ prior payments and at least $200', () => {
  const ctx = { actionType: 'payment' as const, amountCents: 90_000, payee: 'greenleaf pharmacy' };
  assert.ok(ids(detectBehaviorSignals({ ...base, text: 'pay', ctx, payments: usual })).includes('AMOUNT_ANOMALY'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx, payments: usual.slice(0, 4) })).includes('AMOUNT_ANOMALY'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx: { ...ctx, amountCents: 15_000 }, payments: usual })).includes('AMOUNT_ANOMALY'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx: { ...ctx, amountCents: 3000 }, payments: usual })).includes('AMOUNT_ANOMALY'));
});

test('anomaly is skipped when no action is requested', () => {
  assert.deepEqual(detectBehaviorSignals({ ...base, text: 'I paid $900 last week', ctx: {}, payments: usual }), []);
});

test('T-BEH-2 quiet hours handle midnight wrap and the household timezone', () => {
  assert.equal(isQuietHour(23), true);
  assert.equal(isQuietHour(3), true);
  assert.equal(isQuietHour(6), false);
  assert.equal(isQuietHour(12), false);
  const night = new Date('2026-10-09T05:30:00.000Z'); // 00:30 Chicago
  assert.equal(localHour(night, 'America/Chicago'), 0);
  assert.equal(localHour(NOON, 'America/Chicago'), 12);
  const ctx = { actionType: 'payment' as const, payee: 'x' };
  assert.ok(ids(detectBehaviorSignals({ ...base, now: night, text: 'pay', ctx, payments: [] })).includes('QUIET_HOURS'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx, payments: [] })).includes('QUIET_HOURS'));
  assert.equal(localHour(night, 'Not/AZone'), night.getUTCHours(), 'invalid zone falls back to UTC');
});

test('T-BEH-3 payee velocity: third new payee within 7 days', () => {
  const recentNew = [pay(2000, 'bakery', 2), pay(2000, 'florist', 4), pay(2000, 'old friend', 20)];
  const ctx = { actionType: 'payment' as const, payee: 'brand new payee' };
  assert.ok(ids(detectBehaviorSignals({ ...base, text: 'pay', ctx, payments: recentNew })).includes('PAYEE_VELOCITY'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx: { ...ctx, payee: 'bakery' }, payments: recentNew })).includes('PAYEE_VELOCITY'));
  assert.ok(!ids(detectBehaviorSignals({ ...base, text: 'pay', ctx, payments: [recentNew[0]!] })).includes('PAYEE_VELOCITY'));
});

test('T-BEH-4 retry after deny only within 24 hours and only for a similar fingerprint', () => {
  const fp = 'AUTHORITY_IMPERSONATION|GIFT_CARD|URGENCY';
  const mk = (hoursAgo: number, fingerprint = fp): DeniedItem[] => [{ fingerprint, at: new Date(NOON.getTime() - hoursAgo * 3_600_000).toISOString() }];
  const run = (denied: DeniedItem[]) => ids(detectBehaviorSignals({ ...base, text: 'x', ctx: {}, payments: [], denied, baseFingerprint: fp }));
  assert.ok(run(mk(2)).includes('RETRY_AFTER_DENY'));
  assert.ok(!run(mk(25)).includes('RETRY_AFTER_DENY'));
  assert.ok(!run(mk(2, 'WIRE_OR_CRYPTO|SECRECY')).includes('RETRY_AFTER_DENY'));
  assert.ok(run(mk(2, 'AUTHORITY_IMPERSONATION|GIFT_CARD|URGENCY|HIGH_AMOUNT')).includes('RETRY_AFTER_DENY'), '3/4 overlap counts');
});

test('T-BEH-5 without `now` the behavior layer is skipped, keeping evaluate pure', () => {
  const r = evaluate('pay the plumber', { actionType: 'payment', amountCents: 90_000 }, [], { payments: usual });
  assert.equal(r.layerBreakdown.behavior, 0);
  const withNow = evaluate('pay the plumber', { actionType: 'payment', amountCents: 90_000 }, [], { payments: usual, now: NOON });
  assert.ok(withNow.signals.some((s) => s.id === 'AMOUNT_ANOMALY'));
  assert.ok(withNow.layerBreakdown.behavior! > 0);
});

test('behavior ignores NaN, negative and malformed payment data', () => {
  const junk: PaymentItem[] = [{ amountCents: NaN, payee: 'x', at: 'not-a-date' }, { amountCents: -5, payee: null, at: day(1) }];
  assert.doesNotThrow(() => detectBehaviorSignals({ ...base, text: 'pay', ctx: { actionType: 'payment', payee: 'y', amountCents: 90_000 }, payments: junk }));
});
