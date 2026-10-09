import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { evaluate, RULESETS, LIVE_RULESET_VERSION } from '@second-opinion/engine';
import type { Context } from '@second-opinion/shared';

export interface BenchRecord {
  id: string;
  split: 'dev' | 'test' | 'test2';
  label: 'scam' | 'benign';
  category: string;
  channel: Context['channel'];
  text: string;
  context?: { actionType?: Context['actionType']; amountCents?: number; payee?: string; trusted?: boolean };
  difficulty: 'easy' | 'tricky';
  author: string;
  notes?: string;
}

export interface Prediction {
  id: string;
  verdict: 'allow' | 'caution' | 'hold';
}

export interface ScoreResult {
  n: number;
  hold: Metrics;
  flag: Metrics;
  perCategory: Record<string, { total: number; caughtAtHold: number; caughtAtFlag: number }>;
  misclassified: Array<{ id: string; label: string; category: string; difficulty: string; verdict: string; error: string }>;
  missingPredictions: string[];
  problems: string[];
}
export interface Metrics {
  tp: number; fp: number; tn: number; fn: number;
  precision: number | null; recall: number | null; f1: number | null; fpr: number | null;
}

export interface Scorer {
  score(labels: BenchRecord[], predictions: Prediction[]): ScoreResult;
  toMarkdown(result: ScoreResult, title?: string): string;
}

export function readJsonl<T>(path: string): T[] {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l, i) => {
      try {
        return JSON.parse(l) as T;
      } catch (e) {
        throw new Error(`${path}:${i + 1}: invalid JSON (${(e as Error).message})`);
      }
    });
}

/** Load the benchmark's own scorer so the numbers here are exactly the numbers anyone gets from the bench repo. */
export async function loadBench(benchPath: string): Promise<{ root: string; scorer: Scorer }> {
  const root = resolve(benchPath);
  const scoreFile = join(root, 'scripts', 'score.mjs');
  if (!existsSync(scoreFile)) {
    throw new Error(`scam-script-bench not found at ${root}. Clone it next to this repo: git clone https://github.com/Monolithic-Dev/scam-script-bench ${benchPath}`);
  }
  const mod = (await import(pathToFileURL(scoreFile).href)) as Scorer;
  return { root, scorer: mod };
}

/** The detector sees a script the way the product does: the words, plus the request context and the household's trusted list. */
export function contextFor(r: BenchRecord): Context {
  const c = r.context;
  return {
    channel: r.channel,
    ...(c?.actionType ? { actionType: c.actionType } : {}),
    ...(c?.amountCents !== undefined ? { amountCents: c.amountCents } : {}),
    ...(c?.payee ? { payee: c.payee } : {}),
    trustedPayees: c?.trusted && c.payee ? [c.payee] : [],
  };
}

export function predict(records: BenchRecord[], ruleSet: string): Prediction[] {
  if (!(ruleSet in RULESETS)) throw new Error(`unknown rule set ${ruleSet}`);
  return records.map((r) => ({ id: r.id, verdict: evaluate(r.text, contextFor(r), [], { ruleSet }).verdict }));
}

export function gitSha(cwd: string): string {
  try {
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

export interface FrozenTestRun {
  ruleSet: string;
  engineSha: string;
  benchSha: string;
  at: string;
  result: ScoreResult;
}

/** The test split is run once per rule set: a second run is refused unless forced, so tuning on it cannot happen quietly. */
export function checkTestNotFrozen(frozenPath: string, ruleSet: string, force: boolean): FrozenTestRun | null {
  if (!existsSync(frozenPath)) return null;
  const prior = JSON.parse(readFileSync(frozenPath, 'utf8')) as FrozenTestRun;
  if (prior.ruleSet === ruleSet || !force) {
    if (!force) {
      throw new Error(
        `The test split was already scored for ${prior.ruleSet} on ${prior.at} (engine ${prior.engineSha}). ` +
          `Running it again would let us tune on it. Pass --force only after recording why in docs/decisions.md.`,
      );
    }
  }
  return prior;
}

/**
 * The test2 split is scored once per rule set (several rule sets may be scored over time). Returns the set of rule sets already frozen;
 * throws if any requested one is among them, unless forced.
 */
export function checkTest2NotFrozen(frozenPath: string, ruleSets: string[], force: boolean): Record<string, FrozenTestRun> {
  const prior: Record<string, FrozenTestRun> = existsSync(frozenPath) ? JSON.parse(readFileSync(frozenPath, 'utf8')) : {};
  const again = ruleSets.filter((r) => prior[r]);
  if (again.length && !force) {
    throw new Error(
      `The test2 split was already scored for ${again.join(', ')}. Running it again would let us tune on it. ` +
        `Pass --force only after recording why in docs/decisions.md.`,
    );
  }
  return prior;
}

export { LIVE_RULESET_VERSION, RULESETS };
