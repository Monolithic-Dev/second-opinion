import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent, extractPayee } from '../src/agent/intent';
import { describeAction, money } from '../src/agent/router';

const HERO = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';

test('T-INTENT-1 the hero request is a purchase of $1,000 in gift cards', () => {
  const i = classifyIntent(HERO, 'elder');
  assert.equal(i.kind, 'PURCHASE_OR_PAY');
  assert.equal(i.actionType, 'purchase');
  assert.equal(i.amountCents, 100_000);
  assert.equal(i.payee, 'gift cards');
});

test('payments and transfers pick the right action type, amount and payee', () => {
  const pharmacy = classifyIntent('Pay Greenleaf Pharmacy $24', 'elder');
  assert.deepEqual([pharmacy.kind, pharmacy.actionType, pharmacy.amountCents, pharmacy.payee], ['PURCHASE_OR_PAY', 'payment', 2400, 'Greenleaf Pharmacy']);
  const power = classifyIntent('Pay City Power & Light $86.40 for October', 'elder');
  assert.equal(power.payee, 'City Power & Light');
  assert.equal(power.amountCents, 8640);
  const wire = classifyIntent('Wire $500 to my neighbour', 'elder');
  assert.deepEqual([wire.actionType, wire.amountCents, wire.payee], ['transfer', 50_000, 'neighbour']);
  assert.equal(classifyIntent('Please order a new lamp from Acme Lamps', 'elder').payee, 'Acme Lamps');
});

test('T-INTENT-2 questions about a message are SCAM_QUESTION, not an action, even when they mention money', () => {
  for (const t of [
    'I got a text saying I must pay $2 to release my package',
    'Is this a scam?',
    'Someone called and said I need to buy gift cards',
    'Is this email legit? It says wire money today',
  ]) assert.equal(classifyIntent(t, 'elder').kind, 'SCAM_QUESTION', t);
});

test('status and trusted-list questions', () => {
  assert.equal(classifyIntent("What's pending?", 'elder').kind, 'STATUS');
  assert.equal(classifyIntent('Are there any holds waiting?', 'family').kind, 'STATUS');
  assert.equal(classifyIntent('Who do I trust?', 'elder').kind, 'TRUST_LIST');
  assert.equal(classifyIntent('Show the trusted payees', 'family').kind, 'TRUST_LIST');
});

test('T-INTENT-3 family decisions and trusted-list edits only come from the family speaker', () => {
  assert.deepEqual(classifyIntent('Deny it', 'family'), { kind: 'FAMILY_DECISION', decision: 'deny' });
  assert.deepEqual(classifyIntent('Approve it', 'family'), { kind: 'FAMILY_DECISION', decision: 'approve' });
  assert.deepEqual(classifyIntent('No, cancel that', 'family'), { kind: 'FAMILY_DECISION', decision: 'deny' });
  const add = classifyIntent('Add City Power & Light to trusted', 'family');
  assert.equal(add.kind, 'TRUST_ADD');
  assert.equal(add.trustName, 'City Power & Light');
  // the elder saying "approve" is recognised so it can be refused, never executed as an approval
  assert.equal(classifyIntent('Approve it', 'elder').kind, 'FAMILY_DECISION');
  assert.notEqual(classifyIntent('add Bob to trusted', 'elder').kind, 'TRUST_ADD');
});

test('anything else falls back to help', () => {
  assert.equal(classifyIntent('What is the weather today?', 'elder').kind, 'FALLBACK');
  assert.equal(classifyIntent('hello', 'family').kind, 'FALLBACK');
});

test('payee extraction and formatting helpers', () => {
  assert.equal(extractPayee('buy some GIFT cards'), 'gift cards');
  assert.equal(extractPayee('nothing to see'), undefined);
  assert.equal(money(100_000), '$1,000');
  assert.equal(money(2_450), '$24.50');
  assert.equal(money(undefined), '');
  assert.equal(describeAction({ kind: 'PURCHASE_OR_PAY', actionType: 'purchase', amountCents: 100_000, payee: 'gift cards' }, ''), 'Purchase of $1,000 to gift cards');
  assert.ok(describeAction({ kind: 'PURCHASE_OR_PAY', actionType: 'payment' }, 'x'.repeat(500)).length <= 200);
});
