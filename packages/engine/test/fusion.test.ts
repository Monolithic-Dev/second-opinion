import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Signal } from '@second-opinion/shared';
import { evaluate, evaluateWithShadow, fuse, getRuleSet, listRuleSets, LAYER_CAPS, LIVE_RULESET_VERSION } from '../src';

const s = (id: Signal['id'], weight: number): Signal => ({ id, weight, evidence: 'x' });

test('T-FUSE-1 playbook and behavior contributions are capped', () => {
  const f = fuse({
    rules: [s('URGENCY', 20)],
    playbooks: [s('PLAYBOOK_MATCH', 30), s('PLAYBOOK_MATCH', 30)],
    behavior: [s('AMOUNT_ANOMALY', 20), s('RETRY_AFTER_DENY', 30), s('QUIET_HOURS', 10)],
  });
  assert.equal(f.layerBreakdown.playbooks, LAYER_CAPS.playbooks);
  assert.equal(f.layerBreakdown.behavior, LAYER_CAPS.behavior);
  assert.equal(f.score, 20 + 30 + 40);
  assert.equal(f.verdict, 'hold');
});

test('negative signals reduce the rules subtotal but never override a hard rule', () => {
  const f = fuse({ rules: [s('GIFT_CARD', 45), s('URGENCY', 20), s('TRUSTED_PAYEE', -40), s('OFFICIAL_CHANNEL_ADVICE', -25)] });
  assert.equal(f.score, 0);
  assert.equal(f.hardRule, 'GIFT_CARD_PLUS_ANY');
  assert.equal(f.verdict, 'hold');
});

test('fusion is order independent and the score stays within 0-100', () => {
  const a = [s('GIFT_CARD', 45), s('URGENCY', 20), s('SECRECY', 25), s('WIRE_OR_CRYPTO', 40)];
  const x = fuse({ rules: a });
  const y = fuse({ rules: [...a].reverse() });
  assert.equal(x.score, y.score);
  assert.equal(x.verdict, y.verdict);
  assert.equal(x.score, 100);
  assert.equal(fuse({ rules: [s('TRUSTED_PAYEE', -40)] }).score, 0);
});

test('layer breakdown sums to the score (before clamp)', () => {
  const r = evaluate('The bank says I have to buy five $200 gift cards today', { actionType: 'purchase' });
  const sum = r.layerBreakdown.rules! + r.layerBreakdown.playbooks! + r.layerBreakdown.behavior!;
  assert.equal(r.score, Math.min(100, Math.round(sum)));
});

test('T-REG-1 registry exposes versions and rejects unknown ones', () => {
  assert.ok(listRuleSets().length >= 2);
  assert.deepEqual(getRuleSet('rules-2026.10.1').layers, ['rules']);
  assert.ok(getRuleSet(LIVE_RULESET_VERSION).layers.includes('playbooks'));
  assert.throws(() => getRuleSet('rules-1999.01.1'), RangeError);
  assert.equal(evaluate('hello', {}, [], { ruleSet: 'rules-2026.10.1' }).ruleSetVersion, 'rules-2026.10.1');
});

test('T-REG-2 the live rule set catches more than rules-only (playbook lift)', () => {
  const text = 'Hi mom this is my new number, I lost my phone, can you send money urgently';
  const v1 = evaluate(text, {}, [], { ruleSet: 'rules-2026.10.1' });
  const v2 = evaluate(text);
  assert.ok(v2.score > v1.score);
  assert.equal(v1.layerBreakdown.playbooks, 0);
  assert.ok(v2.layerBreakdown.playbooks! > 0);
});

test('T-SHADOW-1 shadow evaluation reports disagreement without changing the live verdict', () => {
  const text = 'Hi mom this is my new number, I lost my phone, can you send money urgently';
  const out = evaluateWithShadow(text, {}, [], 'rules-2026.10.1');
  assert.equal(out.live.ruleSetVersion, LIVE_RULESET_VERSION);
  assert.equal(out.shadow.ruleSetVersion, 'rules-2026.10.1');
  assert.equal(out.live.verdict, evaluate(text).verdict, 'live verdict is unaffected by the shadow set');
  assert.equal(out.disagrees, out.live.verdict !== out.shadow.verdict);
});
