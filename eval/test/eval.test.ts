import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkTestNotFrozen, contextFor, LIVE_RULESET_VERSION, loadBench, predict, readJsonl, type BenchRecord } from '../lib';
import { parseArgs } from '../run';

const rec = (over: Partial<BenchRecord>): BenchRecord => ({
  id: 'd-001', split: 'dev', label: 'scam', category: 'gift_card', channel: 'voice', text: 'Buy five $200 gift cards today, the bank says so.',
  difficulty: 'easy', author: 'team-dev', ...over,
});

test('T-EVAL-1 the detector sees the request context and the household trusted list, like the product does', () => {
  assert.deepEqual(contextFor(rec({})), { channel: 'voice', trustedPayees: [] });
  const trusted = contextFor(rec({ context: { actionType: 'payment', amountCents: 2400, payee: 'Greenleaf Pharmacy', trusted: true } }));
  assert.deepEqual(trusted, { channel: 'voice', actionType: 'payment', amountCents: 2400, payee: 'Greenleaf Pharmacy', trustedPayees: ['Greenleaf Pharmacy'] });
  assert.deepEqual(contextFor(rec({ context: { actionType: 'transfer', payee: 'Daniel' } })).trustedPayees, []);
});

test('predictions are deterministic, one per record, and respect the chosen rule set', () => {
  const rows = [rec({ id: 'd-001' }), rec({ id: 'd-002', label: 'benign', category: 'family_chat', text: 'Can you send me the soup recipe?' })];
  const a = predict(rows, 'rules-2026.10.3');
  assert.deepEqual(a, predict(rows, 'rules-2026.10.3'));
  assert.deepEqual(a.map((p) => p.id), ['d-001', 'd-002']);
  assert.equal(a[0]!.verdict, 'hold');
  assert.equal(a[1]!.verdict, 'allow');
  assert.throws(() => predict(rows, 'rules-1999.01.1'), /unknown rule set/);
});

test('T-EVAL-2 the test split cannot be scored a second time without an explicit, recorded override', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-'));
  const frozen = join(dir, 'test-frozen.json');
  assert.equal(checkTestNotFrozen(frozen, 'rules-2026.10.3', false), null, 'first run is allowed');
  writeFileSync(frozen, JSON.stringify({ ruleSet: 'rules-2026.10.3', engineSha: 'abc1234', benchSha: 'def5678', at: '2026-10-09T00:00:00.000Z', result: {} }));
  assert.throws(() => checkTestNotFrozen(frozen, 'rules-2026.10.3', false), /already scored for rules-2026\.10\.3.*docs\/decisions\.md/);
  const forced = checkTestNotFrozen(frozen, 'rules-2026.10.3', true);
  assert.equal(forced?.engineSha, 'abc1234');
});

test('argument parsing: defaults, explicit split, one rule set, and bad input', () => {
  const d = parseArgs([], {});
  assert.equal(d.split, 'dev');
  assert.equal(d.write, false);
  assert.equal(d.bench, '../scam-script-bench');
  assert.deepEqual(d.ruleSets, ['rules-2026.10.1', 'rules-2026.10.2', 'rules-2026.10.3', 'rules-2026.10.4']);
  assert.equal(parseArgs(['--split', 'test', '--write', '--force'], {}).force, true);
  assert.deepEqual(parseArgs(['--ruleset', 'rules-2026.10.2'], {}).ruleSets, ['rules-2026.10.2']);
  assert.equal(parseArgs([], { BENCH_PATH: '/x/bench' }).bench, '/x/bench');
  assert.throws(() => parseArgs(['--split', 'prod'], {}), /dev, test or test2/);
  assert.throws(() => parseArgs(['--ruleset', 'nope'], {}), /unknown rule set/);
});

test('a missing benchmark checkout explains how to get it', async () => {
  await assert.rejects(() => loadBench(join(tmpdir(), 'definitely-not-here')), /git clone https:\/\/github\.com\/Monolithic-Dev\/scam-script-bench/);
});

test('readJsonl names the bad line', () => {
  const dir = mkdtempSync(join(tmpdir(), 'eval-'));
  const p = join(dir, 'x.jsonl');
  mkdirSync(dir, { recursive: true });
  writeFileSync(p, '{"ok":1}\n{broken\n');
  assert.throws(() => readJsonl(p), /x\.jsonl:2: invalid JSON/);
});

// ---- regression gate against the real benchmark (skipped when it is not checked out) ----
const BENCH = resolve(process.env.BENCH_PATH ?? '../scam-script-bench');
const haveBench = existsSync(join(BENCH, 'scripts', 'score.mjs'));

test('T-EVAL-3 REGRESSION GATE: on the dev split the live rule set keeps scam recall >= 80% and false holds <= 10%', { skip: !haveBench && 'scam-script-bench not checked out' }, async () => {
  const { scorer } = await loadBench(BENCH);
  const dev = readJsonl<BenchRecord>(join(BENCH, 'data', 'dev.jsonl'));
  const result = scorer.score(dev, predict(dev, LIVE_RULESET_VERSION));
  assert.ok((result.hold.recall ?? 0) >= 0.8, `recall at hold ${result.hold.recall}`);
  assert.ok((result.hold.fpr ?? 1) <= 0.1, `false-positive rate at hold ${result.hold.fpr}`);
  assert.equal(result.problems.length, 0);
});

test('the live rule set beats the rules-only baseline on dev (each layer must earn its place)', { skip: !haveBench && 'scam-script-bench not checked out' }, async () => {
  const { scorer } = await loadBench(BENCH);
  const dev = readJsonl<BenchRecord>(join(BENCH, 'data', 'dev.jsonl'));
  const v1 = scorer.score(dev, predict(dev, 'rules-2026.10.1'));
  const v2 = scorer.score(dev, predict(dev, 'rules-2026.10.2'));
  const v3 = scorer.score(dev, predict(dev, 'rules-2026.10.3'));
  assert.ok((v2.hold.recall ?? 0) > (v1.hold.recall ?? 0), 'playbooks add recall');
  assert.ok((v3.hold.recall ?? 0) > (v2.hold.recall ?? 0), 'the tuned pack adds recall');
  assert.ok((v3.hold.fpr ?? 1) <= (v1.hold.fpr ?? 1) + 1e-9, 'without more false holds');
});

test('rules-2026.10.4 does not lose any dev recall or add false holds compared with 10.3', { skip: !haveBench && 'scam-script-bench not checked out' }, async () => {
  const { scorer } = await loadBench(BENCH);
  const dev = readJsonl<BenchRecord>(join(BENCH, 'data', 'dev.jsonl'));
  const v3 = scorer.score(dev, predict(dev, 'rules-2026.10.3'));
  const v4 = scorer.score(dev, predict(dev, 'rules-2026.10.4'));
  assert.ok((v4.hold.recall ?? 0) >= (v3.hold.recall ?? 0), 'recall at hold');
  assert.ok((v4.hold.fpr ?? 1) <= (v3.hold.fpr ?? 1) + 1e-9, 'false holds');
});
