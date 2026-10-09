import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, RULESET_VERSION } from '../src';

test('every result is pinned to the rule-set version', () => {
  const r = evaluate('Hello there');
  assert.equal(r.ruleSetVersion, RULESET_VERSION);
  assert.match(r.ruleSetVersion, /^rules-\d{4}\.\d{2}\.\d+$/);
});
