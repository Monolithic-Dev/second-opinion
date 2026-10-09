import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Context } from '@second-opinion/shared';
import { evaluate } from '../src';

interface Golden {
  id: string;
  text: string;
  ctx: Context;
  'rules-2026.10.1': { verdict: string; score: number; signals: string[] };
  'rules-2026.10.2': { verdict: string; score: number; signals: string[] };
  'rules-2026.10.3': { verdict: string; score: number; signals: string[] };
}
const golden = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'golden', 'rulesets.json'), 'utf8')) as Golden[];

/**
 * A published rule-set version must never change: stored decisions are pinned to it and can be replayed. Improving the detector
 * means adding a NEW version. The 10.1 and 10.2 snapshots were taken before `rules-2026.10.3` existed, the 10.3 snapshot before `rules-2026.10.4`.
 */
for (const version of ['rules-2026.10.1', 'rules-2026.10.2', 'rules-2026.10.3'] as const) {
  test(`T-FROZEN ${version} gives exactly the same verdict, score and signals as when it was published (${golden.length} inputs)`, () => {
    const drift: string[] = [];
    for (const g of golden) {
      const r = evaluate(g.text, g.ctx, [], { ruleSet: version });
      const now = { verdict: r.verdict, score: r.score, signals: r.signals.map((s) => s.id).sort() };
      if (JSON.stringify(now) !== JSON.stringify(g[version])) drift.push(`${g.id}: ${JSON.stringify(g[version])} -> ${JSON.stringify(now)}`);
    }
    assert.deepEqual(drift, []);
  });
}
