import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, getRuleSet, LIVE_RULESET_VERSION } from '../src';

const ids = (text: string, ruleSet = LIVE_RULESET_VERSION, ctx = {}) => evaluate(text, ctx, [], { ruleSet }).signals.map((s) => s.id);

test('T-V3-1 live rule set is rules-2026.10.3 and uses the v2 rule pack and p2 playbooks', () => {
  assert.equal(LIVE_RULESET_VERSION, 'rules-2026.10.3');
  const rs = getRuleSet(LIVE_RULESET_VERSION);
  assert.deepEqual([rs.rulePack, rs.playbookPack], ['v2', 'p2']);
  assert.deepEqual([getRuleSet('rules-2026.10.2').rulePack, getRuleSet('rules-2026.10.2').playbookPack], ['v1', 'p1']);
});

test('T-V3-2 a plain "I need the code" request from someone who contacted you is held', () => {
  const r = evaluate('This is the fraud department. We detected a charge. To cancel it, I need the six digit code we just sent to your phone.');
  assert.ok(r.signals.some((s) => s.id === 'VERIFICATION_CODE'));
  assert.equal(r.verdict, 'hold');
  assert.equal(r.hardRule, 'CODE_PLUS_UNSOLICITED');
});

test('T-V3-3 credential phishing (card photo, PIN, password) plus pressure is held by a decisive rule', () => {
  const r = evaluate('Your account is locked. Verify within 24 hours by sending a photo of your debit card and PIN.');
  assert.ok(r.signals.some((s) => s.id === 'CREDENTIAL_REQUEST'));
  assert.equal(r.verdict, 'hold');
  assert.equal(r.hardRule, 'CREDENTIAL_PLUS_PRESSURE');
  assert.ok(r.card.flags.includes('Asks for your card details, PIN or password'));
  assert.match(r.card.advice, /Never send your PIN/);
  assert.ok(ids('Please share your password with me right now').includes('CREDENTIAL_REQUEST'));
});

test('T-V3-4 a credential request with no pressure is flagged, not held', () => {
  const r = evaluate('Could you send me the password for the guest wifi?');
  assert.ok(r.signals.some((s) => s.id === 'CREDENTIAL_REQUEST'));
  assert.notEqual(r.verdict, 'hold');
});

test('T-V3-5 warnings that say "we will never ask" are not requests', () => {
  for (const warning of [
    'We will never ask you to send your PIN or password.',
    'Your bank will never ask you to provide the code we text you.',
    'We will never call you to ask you to confirm your PIN.',
  ]) {
    const got = ids(warning);
    assert.ok(!got.includes('CREDENTIAL_REQUEST') && !got.includes('VERIFICATION_CODE'), `${warning} -> ${got}`);
  }
});

test('T-V3-6 "wire $8,000 ..." and "wire me $400" are wire requests; "wire" alone is not', () => {
  assert.ok(ids('Wire $8,000 to the new account today').includes('WIRE_OR_CRYPTO'));
  assert.ok(ids('Could you wire me $400 to this account?').includes('WIRE_OR_CRYPTO'));
  assert.ok(ids('wire it to him this afternoon').includes('WIRE_OR_CRYPTO'));
  assert.ok(!ids('The wire fence needs repairs').includes('WIRE_OR_CRYPTO'));
  assert.ok(!ids('My electrical wire is loose').includes('WIRE_OR_CRYPTO'));
});

test('T-V3-7 delivery-fee scams worded as "parcel could not be delivered" match the p2 playbook', () => {
  const text = 'Your parcel could not be delivered. Pay a redelivery fee at the link to avoid return.';
  assert.equal(evaluate(text).playbook?.id, 'package-fee');
  assert.equal(evaluate(text, {}, [], { ruleSet: 'rules-2026.10.2' }).playbook, null, 'the frozen p1 pack does not know this wording');
});

test('T-V3-8 the older rule sets never produce the new signal (they are frozen)', () => {
  const text = 'Verify within 24 hours by sending a photo of your debit card and PIN.';
  assert.ok(ids(text, 'rules-2026.10.3').includes('CREDENTIAL_REQUEST'));
  assert.ok(!ids(text, 'rules-2026.10.2').includes('CREDENTIAL_REQUEST'));
  assert.ok(!ids(text, 'rules-2026.10.1').includes('CREDENTIAL_REQUEST'));
});

test('benign look-alikes stay allowed under the live rule set', () => {
  for (const text of [
    'Your prescription is ready for pickup at Greenleaf Pharmacy.',
    'Reminder: your appointment with Dr. Lee is Thursday at 10 AM.',
    'Can you send me the soup recipe you made on Sunday?',
    'Please bring your ID and the confirmation number to the front desk.',
  ]) assert.equal(evaluate(text).verdict, 'allow', text);
});
