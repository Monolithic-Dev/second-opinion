import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, topMatches, PLAYBOOK_PACKS, MIN_SIMILARITY, playbookWeight, tokens } from '../src';
import { FIXTURES } from './fixtures';

for (const pack of ['p1', 'p2'] as const) {
  test(`T-PB-1 every playbook in pack ${pack} is recalled from its own phrases (self-recall)`, () => {
    assert.ok(PLAYBOOK_PACKS[pack].length >= 20);
    for (const p of PLAYBOOK_PACKS[pack]) {
      const top = topMatches(p.phrases.join(' '), 1, pack)[0]!;
      assert.equal(top.playbook.id, p.id, p.id);
      assert.ok(top.similarity >= 0.8, `${p.id} ${top.similarity}`);
    }
  });
}

test('playbook ids are unique and every playbook has advice and phrases', () => {
  const all = PLAYBOOK_PACKS.p2;
  assert.equal(new Set(all.map((p) => p.id)).size, all.length);
  for (const p of all) {
    assert.ok(p.advice.length > 10 && p.phrases.length >= 3, p.id);
    for (const ph of p.phrases) assert.ok(!/\d{3}[-. ]\d{3}[-. ]\d{4}|https?:\/\//.test(ph), `${p.id} has a phone number or URL`);
  }
});

test('T-PB-2 scam fixtures match a playbook; benign fixtures stay below the threshold', () => {
  for (const f of FIXTURES.slice(0, 4)) {
    const r = evaluate(f.text, f.ctx);
    assert.ok(r.playbook, f.id);
    assert.ok(r.signals.some((s) => s.id === 'PLAYBOOK_MATCH'));
    const w = r.signals.find((s) => s.id === 'PLAYBOOK_MATCH')!.weight;
    assert.ok(w >= 18 && w <= 30, `${f.id} weight ${w}`);
    assert.ok(r.card.flags.some((x) => x.startsWith('Matches a known scam:')));
  }
  for (const f of FIXTURES.filter((x) => x.label === 'benign')) {
    assert.ok(topMatches(f.text, 1)[0] === undefined || topMatches(f.text, 1)[0]!.similarity < MIN_SIMILARITY, f.id);
  }
});

test('T-PB-3 a polite scam without scam vocabulary is NOT caught by playbooks (documented limitation)', () => {
  const r = evaluate('Please send $900 to my cousin Daniel for the car repair.');
  assert.equal(r.playbook, null);
});

test('T-PB-4 matching is deterministic and ties break by playbook id', () => {
  const a = JSON.stringify(topMatches('gift cards wire transfer today', 5));
  for (let i = 0; i < 20; i++) assert.equal(JSON.stringify(topMatches('gift cards wire transfer today', 5)), a);
  const m = topMatches('gift cards wire transfer today', 5);
  for (let i = 1; i < m.length; i++) {
    const prev = m[i - 1]!;
    const cur = m[i]!;
    assert.ok(prev.similarity > cur.similarity || (prev.similarity === cur.similarity && prev.playbook.id < cur.playbook.id));
  }
});

test('playbook weight is capped at 30 and scales with similarity', () => {
  assert.equal(playbookWeight(1), 30);
  assert.equal(playbookWeight(0.3), 18);
  assert.ok(playbookWeight(0.4) < playbookWeight(0.5));
});

test('tokens drops stop words, short words and simple plurals', () => {
  assert.deepEqual(tokens('The gift cards are in the bank'), ['gift', 'card', 'bank']);
});
