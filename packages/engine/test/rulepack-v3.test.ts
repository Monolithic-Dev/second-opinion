import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, getRuleSet, LIVE_RULESET_VERSION } from '../src';

const ids = (text: string, ruleSet: string = LIVE_RULESET_VERSION, ctx = {}) => evaluate(text, ctx, [], { ruleSet }).signals.map((s) => s.id);

test('T-V4-1 the live rule set is rules-2026.10.4 on rule pack v3 and playbook pack p3', () => {
  assert.equal(LIVE_RULESET_VERSION, 'rules-2026.10.4');
  const rs = getRuleSet(LIVE_RULESET_VERSION);
  assert.deepEqual([rs.rulePack, rs.playbookPack], ['v3', 'p3']);
});

test('T-V4-2 a code mentioned before the verb is caught, and the older rule set misses it (frozen)', () => {
  const text = 'We texted you a one time passcode. Please read it back to me so I can stop the transfer.';
  assert.ok(ids(text).includes('VERIFICATION_CODE'));
  assert.ok(!ids(text, 'rules-2026.10.3').includes('VERIFICATION_CODE'));
});

test('T-V4-3 a fee demanded up front is ADVANCE_FEE and, with pressure, a decisive hold', () => {
  const r = evaluate('Your refund is waiting. Pay the $40 release fee today to receive it.');
  assert.ok(r.signals.some((s) => s.id === 'ADVANCE_FEE'));
  assert.equal(r.verdict, 'hold');
  assert.equal(r.hardRule, 'ADVANCE_FEE_PLUS_PRESSURE');
  assert.match(r.card.advice, /fee before you can get/);
});

test('T-V4-4 a plain fee with no pressure is flagged at most, never held; warnings are not requests', () => {
  assert.notEqual(evaluate('The club has a $20 processing fee, due with your first membership payment.').verdict, 'hold');
  assert.ok(!ids('We will never ask you to pay a release fee.').includes('ADVANCE_FEE'));
});

test('T-V4-5 the speaker being the relative is recognised when money is asked', () => {
  assert.ok(ids("Gran, it's me. I'm at the police station and need $900 for bail.").includes('FAMILY_EMERGENCY'));
  assert.ok(!ids("I'm at the police station to renew my licence, back by noon.").includes('FAMILY_EMERGENCY'));
});

test('T-V4-6 voucher wording, safe accounts and changed bank details are recognised', () => {
  assert.ok(ids('Buy two Steam vouchers and send me the codes').includes('GIFT_CARD'));
  assert.ok(ids('Move your savings to a safe account today').includes('WIRE_OR_CRYPTO'));
  assert.ok(ids('Our landlord changed his bank details, use the new account number').includes('WIRE_OR_CRYPTO'));
  assert.ok(!ids('Our landlord changed his bank details, use the new account number', 'rules-2026.10.3').includes('WIRE_OR_CRYPTO'));
});

test('T-V4-7 more officials count as authority, but only with a demand', () => {
  assert.ok(ids('This is the tax office. You must settle your balance today.').includes('AUTHORITY_IMPERSONATION'));
  assert.ok(!ids('The tax office is closed on Monday.').includes('AUTHORITY_IMPERSONATION'));
});

test('T-V4-8 benign look-alikes stay allowed under the live rule set', () => {
  for (const text of [
    'Your prescription is ready for pickup at Greenleaf Pharmacy.',
    'Reminder: your appointment with Dr. Lee is Thursday at 10 AM.',
    'Can you send me the soup recipe you made on Sunday?',
    'Your monthly statement is ready. Sign in to the app to view it.',
    'Water works on your street tomorrow between 9 and noon. No action is needed.',
    'Your free trial ends in three days. Cancel any time from your account.',
    'Please bring your insurance card and a photo ID to the clinic tomorrow.',
    'Reply C to confirm your dentist visit on Thursday at 2:30 pm.',
  ]) assert.equal(evaluate(text).verdict, 'allow', text);
});
