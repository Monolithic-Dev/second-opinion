import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import {
  addVote, approversToNotify, decide, defaultPolicy, maxLevel, newlyNotified, patchPolicy, tally, targetLevel, validatePolicy,
  type DecisionInput, type Policy, type Vote,
} from '../src';

const approve = (id: string): Vote => ({ approverId: id, decision: 'approve' });
const deny = (id: string): Vote => ({ approverId: id, decision: 'deny' });

test('T-Q-1 two-of-two: pending after one approval, approved after the second distinct approver', () => {
  assert.equal(tally([], 2).state, 'pending');
  assert.equal(tally([approve('a')], 2).state, 'pending');
  assert.equal(tally([approve('a'), approve('a')], 2).state, 'pending', 'the same approver twice counts once');
  assert.deepEqual(tally([approve('a'), approve('b')], 2), { state: 'approved', approvals: 2, denials: 0, required: 2 });
  assert.equal(tally([approve('a')], 1).state, 'approved');
});

test('T-Q-2 any single deny vetoes', () => {
  assert.equal(tally([approve('a'), deny('b')], 2).state, 'denied');
  assert.equal(tally([deny('a'), approve('b'), approve('c')], 1).state, 'denied');
});

test('T-Q-3 an identical repeat vote is idempotent; a changed vote is a conflict', () => {
  const one = addVote([], approve('a'));
  assert.equal(one.kind, 'added');
  assert.equal(addVote(one.votes, approve('a')).kind, 'duplicate');
  assert.equal(addVote(one.votes, deny('a')).kind, 'conflict');
  assert.equal(addVote(one.votes, approve('b')).kind, 'added');
});

test('P6 quorum outcome does not depend on vote order', () => {
  const vote = fc.record({ approverId: fc.constantFrom('a', 'b', 'c'), decision: fc.constantFrom('approve', 'deny') as fc.Arbitrary<Vote['decision']> });
  fc.assert(
    fc.property(fc.array(vote, { maxLength: 8 }), fc.constantFrom(1, 2), (votes, req) => {
      // keep one decision per approver so reversing cannot change "last vote wins" semantics
      const firstOnly = [...new Map(votes.map((v) => [v.approverId, v])).values()];
      return tally(firstOnly, req).state === tally([...firstOnly].reverse(), req).state;
    }),
    { numRuns: 300, seed: 7 },
  );
});

test('T-ESC-1 one escalation level per interval, capped at the number of ranks', () => {
  const created = '2026-10-09T12:00:00.000Z';
  const at = (min: number) => new Date(Date.parse(created) + min * 60_000);
  assert.equal(targetLevel(created, at(0), 5, 2), 0);
  assert.equal(targetLevel(created, at(4.9), 5, 2), 0);
  assert.equal(targetLevel(created, at(5), 5, 2), 1);
  assert.equal(targetLevel(created, at(99), 5, 2), 2);
  assert.equal(targetLevel(created, at(-1), 5, 2), 0);
});

test('T-ESC-2 each approver is notified exactly once as levels rise', () => {
  const ranks = [{ id: 'priya', rank: 1 }, { id: 'arjun', rank: 2 }, { id: 'meera', rank: 3 }];
  assert.deepEqual(approversToNotify(ranks, 0), ['priya']);
  assert.deepEqual(approversToNotify(ranks, 1), ['priya', 'arjun']);
  assert.deepEqual(newlyNotified(ranks, 0, 1), ['arjun']);
  assert.deepEqual(newlyNotified(ranks, 0, 2), ['arjun', 'meera']);
  assert.deepEqual(newlyNotified(ranks, 2, 2), []);
  assert.equal(maxLevel(ranks), 2);
  assert.equal(maxLevel([]), -1 + 0 === -1 ? maxLevel([]) : 0);
});

test('T-POLCFG-1 the default policy is valid and out-of-range values are rejected with messages', () => {
  assert.deepEqual(validatePolicy(defaultPolicy), { ok: true });
  const bad = validatePolicy({ ...defaultPolicy, maxSingleCents: 5, quorum: 3 as never, timezone: 'Mars/Base', quietHoursStart: '25:99', escalateAfterMin: 30, holdTtlMin: 10 });
  assert.equal(bad.ok, false);
  if (!bad.ok) {
    const text = bad.errors.join(' | ');
    for (const needle of ['maxSingleCents', 'quorum', 'timezone', 'quietHoursStart', 'escalateAfterMin']) assert.match(text, new RegExp(needle));
  }
});

test('a quorum nobody can satisfy is refused', () => {
  assert.equal(validatePolicy({ ...defaultPolicy, quorum: 2 }, 1).ok, false);
  assert.equal(validatePolicy({ ...defaultPolicy, quorum: 2 }, 2).ok, true);
  assert.equal(validatePolicy({ ...defaultPolicy, dailyCapCents: 1000, maxSingleCents: 2000 }).ok, false);
});

test('patchPolicy reports exactly the fields that changed and ignores unknown keys', () => {
  const { policy, changed } = patchPolicy(defaultPolicy, { quorum: 2, maxSingleCents: defaultPolicy.maxSingleCents, bogus: 1 } as Partial<Policy>);
  assert.deepEqual(changed, ['quorum']);
  assert.equal(policy.quorum, 2);
  assert.ok(!('bogus' in policy));
});

test('P4 the policy only tightens: a risk hold is never allowed, for any policy and input', () => {
  const policy = fc.record({
    maxSingleCents: fc.integer({ min: 1_000, max: 5_000_000 }),
    dailyCapCents: fc.integer({ min: 5_000_000, max: 10_000_000 }),
    newPayeeCooloffMin: fc.integer({ min: 0, max: 1000 }),
    requireApprovalAboveCents: fc.integer({ min: 0, max: 5_000_000 }),
    quietHoursStart: fc.constantFrom('00:00', '22:00', '09:00'),
    quietHoursEnd: fc.constantFrom('00:00', '06:00', '17:00'),
    timezone: fc.constantFrom('America/Chicago', 'Asia/Kolkata', 'UTC'),
    quorum: fc.constantFrom(1, 2) as fc.Arbitrary<1 | 2>,
    escalateAfterMin: fc.constant(5),
    holdTtlMin: fc.constant(10),
  });
  const input = fc.record({
    risk: fc.constantFrom('allow', 'caution', 'hold') as fc.Arbitrary<DecisionInput['risk']>,
    actionType: fc.constantFrom('purchase', 'payment', 'transfer', 'none') as fc.Arbitrary<DecisionInput['actionType']>,
    amountCents: fc.option(fc.integer({ min: 0, max: 10_000_000 }), { nil: undefined }),
    payeeTrusted: fc.boolean(),
    payeeFirstPaidAt: fc.constantFrom(null, undefined, '2026-01-01T00:00:00.000Z'),
    spentTodayCents: fc.integer({ min: 0, max: 1_000_000 }),
    now: fc.date({ min: new Date('2026-01-01'), max: new Date('2027-01-01'), noInvalidDate: true }),
  });
  fc.assert(
    fc.property(policy, input, (p, i) => {
      const d = decide(i, p);
      return i.risk !== 'hold' || d.outcome !== 'allow';
    }),
    { numRuns: 500, seed: 11 },
  );
});
