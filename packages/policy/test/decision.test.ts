import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decide, defaultPolicy, inQuietHours, localDay, localMinutes, REASON_TEXT, type DecisionInput, type Policy } from '../src';

const NOON = new Date('2026-10-09T17:00:00.000Z'); // 12:00 America/Chicago
const NIGHT = new Date('2026-10-10T05:30:00.000Z'); // 00:30 America/Chicago
const longAgo = '2026-08-01T00:00:00.000Z';

const base: DecisionInput = {
  risk: 'allow', actionType: 'payment', amountCents: 2_400, payeeTrusted: true, spentTodayCents: 0, now: NOON,
};
const run = (over: Partial<DecisionInput>, policy: Partial<Policy> = {}) => decide({ ...base, ...over }, { ...defaultPolicy, ...policy });

test('T-POL-0 an ordinary trusted payment is allowed with no reasons', () => {
  assert.deepEqual(run({}), { outcome: 'allow', reasons: [], quorum: 1 });
});

test('T-POL-1 a risk hold always needs approval', () => {
  const d = run({ risk: 'hold' });
  assert.equal(d.outcome, 'require_approval');
  assert.deepEqual(d.reasons, ['RISK_HOLD']);
});

test('caution needs approval only at or above the approval amount', () => {
  assert.equal(run({ risk: 'caution', amountCents: 19_999 }).outcome, 'allow');
  assert.deepEqual(run({ risk: 'caution', amountCents: 20_000 }).reasons, ['RISK_CAUTION_AMOUNT']);
});

test('T-POL-2 over the single-payment limit needs approval', () => {
  assert.deepEqual(run({ amountCents: 50_001 }).reasons, ['OVER_SINGLE_LIMIT']);
  assert.equal(run({ amountCents: 50_000 }).outcome, 'allow');
});

test('T-POL-3 first payment to an untrusted payee cools off, then is allowed', () => {
  assert.deepEqual(run({ payeeTrusted: false, payeeFirstPaidAt: null }).reasons, ['NEW_PAYEE_COOLOFF']);
  const recent = new Date(NOON.getTime() - 30 * 60_000).toISOString();
  assert.equal(run({ payeeTrusted: false, payeeFirstPaidAt: recent }).outcome, 'require_approval');
  assert.equal(run({ payeeTrusted: false, payeeFirstPaidAt: longAgo }).outcome, 'allow');
  assert.equal(run({ payeeTrusted: false, payeeFirstPaidAt: recent }, { newPayeeCooloffMin: 0 }).outcome, 'allow');
});

test('T-POL-4 quiet hours across midnight use the policy timezone', () => {
  assert.deepEqual(run({ now: NIGHT }).reasons, ['QUIET_HOURS']);
  assert.equal(run({ now: NOON }).outcome, 'allow');
  assert.equal(run({ now: NIGHT }, { timezone: 'Asia/Kolkata' }).outcome, 'allow', '11:00 in Kolkata is not quiet');
  assert.equal(inQuietHours(NIGHT, 'America/Chicago', '22:00', '06:00'), true);
  assert.equal(inQuietHours(NIGHT, 'America/Chicago', '09:00', '09:00'), false, 'start == end means never');
  assert.equal(localMinutes(NOON, 'America/Chicago'), 12 * 60);
  assert.equal(localDay(NIGHT, 'America/Chicago'), '2026-10-10', '05:30Z is 00:30 on Oct 10 in Chicago');
  assert.equal(localDay(new Date('2026-10-10T04:30:00.000Z'), 'America/Chicago'), '2026-10-09', 'still the previous local day');
});

test('T-POL-5 the daily cap blocks (not just holds) and wins over approval', () => {
  const d = run({ amountCents: 40_000, spentTodayCents: 120_000 });
  assert.equal(d.outcome, 'block');
  assert.ok(d.reasons.includes('DAILY_CAP'));
  assert.equal(run({ amountCents: 30_000, spentTodayCents: 120_000 }).outcome, 'allow', 'exactly at the cap is fine');
});

test('T-POL-6 policy never turns a risk hold into allow, even with a lax policy', () => {
  const lax: Partial<Policy> = { maxSingleCents: 5_000_000, dailyCapCents: 10_000_000, newPayeeCooloffMin: 0, requireApprovalAboveCents: 5_000_000, quietHoursStart: '00:00', quietHoursEnd: '00:00' };
  assert.equal(run({ risk: 'hold' }, lax).outcome, 'require_approval');
  assert.equal(run({ risk: 'hold', actionType: 'none' }, lax).outcome, 'require_approval');
});

test('reasons accumulate without duplicates and each has display text', () => {
  const d = run({ risk: 'hold', amountCents: 100_000, payeeTrusted: false, payeeFirstPaidAt: null, now: NIGHT });
  assert.deepEqual(d.reasons.sort(), ['NEW_PAYEE_COOLOFF', 'OVER_SINGLE_LIMIT', 'QUIET_HOURS', 'RISK_HOLD'].sort());
  for (const r of d.reasons) assert.ok(REASON_TEXT[r].length > 5);
});

test('T-POL-7 very large amounts raise the quorum to 2', () => {
  assert.equal(run({ amountCents: 150_000 }).quorum, 1);
  assert.equal(run({ amountCents: 150_001 }).quorum, 2);
  assert.equal(run({}, { quorum: 2 }).quorum, 2);
});

test('informational checks (no action) are not subject to payee, hour or cap rules', () => {
  const d = run({ actionType: 'none', amountCents: undefined, payeeTrusted: false, now: NIGHT, spentTodayCents: 999_999 });
  assert.equal(d.outcome, 'allow');
});
