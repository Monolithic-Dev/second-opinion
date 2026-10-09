import { pathToFileURL } from 'node:url';
import { evaluate, LIVE_RULESET_VERSION, RULESETS } from '@second-opinion/engine';
import { openDb, type Db } from '@second-opinion/store';
import type { Context, Verdict } from '@second-opinion/shared';

/**
 * Backtest a candidate rule set against every check already stored in a household database (docs/backend-architecture.md, shadow mode).
 * Nothing is written. Each stored message is re-scored under the baseline and the candidate rule set, with the household's trusted payees
 * but without payment history (so the behavior layer, which needs it, is not part of this comparison).
 */
export interface Change {
  checkId: string;
  textPreview: string;
  stored: Verdict;
  baseline: Verdict;
  candidate: Verdict;
  /** 'more_strict' = the candidate raises the verdict (allow < caution < hold), 'less_strict' = it lowers it. */
  direction: 'more_strict' | 'less_strict';
}

export interface BacktestReport {
  baseline: string;
  candidate: string;
  total: number;
  unchanged: number;
  matrix: Record<string, number>;
  changes: Change[];
}

const RANK: Record<Verdict, number> = { allow: 0, caution: 1, hold: 2 };

interface CheckRow {
  id: string;
  household_id: string;
  text: string;
  channel: Context['channel'];
  action_type: NonNullable<Context['actionType']>;
  amount_cents: number | null;
  payee: string | null;
  verdict: Verdict;
}

export function backtest(db: Db, baseline: string, candidate: string): BacktestReport {
  for (const rs of [baseline, candidate]) if (!(rs in RULESETS)) throw new Error(`unknown rule set ${rs}. Known: ${Object.keys(RULESETS).join(', ')}`);
  const rows = db.prepare('SELECT id, household_id, text, channel, action_type, amount_cents, payee, verdict FROM checks ORDER BY created_at, id').all() as CheckRow[];
  const trusted = new Map<string, string[]>();
  for (const r of db.prepare('SELECT household_id, name FROM trusted_payees').all() as Array<{ household_id: string; name: string }>) {
    trusted.set(r.household_id, [...(trusted.get(r.household_id) ?? []), r.name]);
  }
  const matrix: Record<string, number> = {};
  const changes: Change[] = [];
  for (const row of rows) {
    const ctx: Context = {
      channel: row.channel, actionType: row.action_type, trustedPayees: trusted.get(row.household_id) ?? [],
      ...(row.amount_cents !== null ? { amountCents: row.amount_cents } : {}), ...(row.payee ? { payee: row.payee } : {}),
    };
    const b = evaluate(row.text, ctx, [], { ruleSet: baseline }).verdict;
    const c = evaluate(row.text, ctx, [], { ruleSet: candidate }).verdict;
    const key = `${b}->${c}`;
    matrix[key] = (matrix[key] ?? 0) + 1;
    if (b !== c) {
      changes.push({
        checkId: row.id, textPreview: row.text.slice(0, 80), stored: row.verdict, baseline: b, candidate: c,
        direction: RANK[c] > RANK[b] ? 'more_strict' : 'less_strict',
      });
    }
  }
  return { baseline, candidate, total: rows.length, unchanged: rows.length - changes.length, matrix, changes };
}

export function renderReport(r: BacktestReport): string {
  const lines = [
    `Backtest: ${r.baseline} (baseline) vs ${r.candidate} (candidate) over ${r.total} stored checks`,
    `Unchanged: ${r.unchanged}   Changed: ${r.changes.length} (${r.changes.filter((c) => c.direction === 'more_strict').length} stricter, ${r.changes.filter((c) => c.direction === 'less_strict').length} looser)`,
    '',
    'baseline->candidate: count',
    ...Object.entries(r.matrix).sort().map(([k, v]) => `  ${k}: ${v}`),
  ];
  if (r.changes.length) {
    lines.push('', 'Changed checks (review these before promoting the candidate):');
    for (const c of r.changes) lines.push(`  ${c.checkId}  ${c.baseline} -> ${c.candidate} (${c.direction}, stored ${c.stored})  "${c.textPreview}"`);
  }
  return lines.join('\n');
}

export function parseArgs(argv: string[], env: NodeJS.ProcessEnv = process.env) {
  const flag = (n: string) => {
    const i = argv.indexOf(`--${n}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const candidate = flag('candidate');
  if (!candidate) throw new Error('usage: npm run backtest -- --candidate <rule-set> [--baseline <rule-set>] [--db <path>] [--json]');
  return { candidate, baseline: flag('baseline') ?? LIVE_RULESET_VERSION, db: flag('db') ?? env.DB_PATH ?? './data/second-opinion.db', json: argv.includes('--json') };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const a = parseArgs(process.argv.slice(2));
    const db = openDb(a.db);
    const report = backtest(db, a.baseline, a.candidate);
    db.close();
    process.stdout.write((a.json ? JSON.stringify(report, null, 2) : renderReport(report)) + '\n');
  } catch (e) {
    process.stderr.write(`backtest: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  }
}
