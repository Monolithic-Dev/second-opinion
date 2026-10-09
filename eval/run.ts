import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  checkTestNotFrozen, gitSha, LIVE_RULESET_VERSION, loadBench, predict, readJsonl, RULESETS,
  type BenchRecord, type FrozenTestRun, type ScoreResult,
} from './lib';

/**
 * Score the detector on scam-script-bench.
 *
 *   npm run eval                      dev split, every rule set (the ablation)
 *   npm run eval -- --split test      the held-out split, ONCE per rule set (refused afterwards without --force)
 *   npm run eval -- --write           also write eval/results/*.md and *.json
 *
 * Rules (docs/detection-engine.md section 7): tune on dev only; run test once; report the failures.
 */
interface Args {
  split: 'dev' | 'test';
  ruleSets: string[];
  write: boolean;
  force: boolean;
  bench: string;
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env): Args {
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const split = flag('split') ?? 'dev';
  if (split !== 'dev' && split !== 'test') throw new Error('--split must be dev or test');
  const only = flag('ruleset');
  if (only && !(only in RULESETS)) throw new Error(`unknown rule set ${only}. Known: ${Object.keys(RULESETS).join(', ')}`);
  return {
    split,
    ruleSets: only ? [only] : Object.keys(RULESETS).sort(),
    write: argv.includes('--write'),
    force: argv.includes('--force'),
    bench: flag('bench') ?? env.BENCH_PATH ?? '../scam-script-bench',
  };
}

const pct = (x: number | null) => (x === null ? 'n/a' : `${(x * 100).toFixed(1)}%`);

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const { root: benchRoot, scorer } = await loadBench(args.bench);
  const records = readJsonl<BenchRecord>(join(benchRoot, 'data', `${args.split}.jsonl`));
  const outDir = join('eval', 'results');
  const frozenPath = join(outDir, 'test-frozen.json');
  const engineSha = gitSha('.');
  const benchSha = gitSha(benchRoot);

  if (args.split === 'test') checkTestNotFrozen(frozenPath, LIVE_RULESET_VERSION, args.force);

  const results: Record<string, ScoreResult> = {};
  for (const ruleSet of args.ruleSets) results[ruleSet] = scorer.score(records, predict(records, ruleSet));

  const lines = [
    `# Detector results on ${args.split} (${records.length} scripts)`,
    '',
    `Engine \`${engineSha}\` · bench \`${benchSha}\` · live rule set \`${LIVE_RULESET_VERSION}\``,
    '',
    '## Ablation: what each layer adds',
    '',
    '| Rule set | Layers | Recall @ hold | FPR @ hold | Recall @ flag | FPR @ flag |',
    '|---|---|---|---|---|---|',
    ...args.ruleSets.map((rs) => {
      const r = results[rs]!;
      return `| \`${rs}\`${rs === LIVE_RULESET_VERSION ? ' (live)' : ''} | ${RULESETS[rs]!.layers.join(' + ')} | ${pct(r.hold.recall)} | ${pct(r.hold.fpr)} | ${pct(r.flag.recall)} | ${pct(r.flag.fpr)} |`;
    }),
    '',
    '_The behavior layer needs household history, which a stand-alone script does not have, so it is not part of this measurement._',
    '',
    ...args.ruleSets.flatMap((rs) => [scorer.toMarkdown(results[rs]!, `\`${rs}\` on ${args.split}`)]),
  ];
  const markdown = lines.join('\n');
  process.stdout.write(markdown + '\n');

  if (args.write) {
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, `${args.split}.md`), markdown + '\n');
    writeFileSync(join(outDir, `${args.split}.json`), JSON.stringify({ engineSha, benchSha, liveRuleSet: LIVE_RULESET_VERSION, results }, null, 2) + '\n');
    if (args.split === 'test') {
      const frozen: FrozenTestRun = { ruleSet: LIVE_RULESET_VERSION, engineSha, benchSha, at: new Date().toISOString(), result: results[LIVE_RULESET_VERSION]! };
      writeFileSync(frozenPath, JSON.stringify(frozen, null, 2) + '\n');
      process.stderr.write(`\nTest split scored and frozen for ${LIVE_RULESET_VERSION}: ${frozenPath}\n`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`eval: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
