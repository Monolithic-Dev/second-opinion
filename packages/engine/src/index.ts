import {
  MAX_TEXT_LENGTH,
  type CheckResult,
  type Context,
  type DeniedItem,
  type HistoryItem,
  type PaymentItem,
  type Signal,
} from '@second-opinion/shared';
import { detectRuleSignals } from './layers/rules';
import { detectPlaybookSignals, type PlaybookMatch } from './layers/playbooks';
import { detectBehaviorSignals } from './layers/behavior';
import { fuse } from './layers/fusion';
import { fingerprint, findSimilar } from './fingerprint';
import { explain } from './explain';
import { getRuleSet, LIVE_RULESET_VERSION, type RuleSet } from './registry';

export { normalize, deleet } from './normalize';
export { RULESET_VERSION } from './version';
export { RULESETS, LIVE_RULESET_VERSION, getRuleSet, listRuleSets, type RuleSet } from './registry';
export { parseAmountCents, wordsToNumber } from './amount';
export { detectRuleSignals, WEIGHTS, HIGH_AMOUNT_CENTS } from './layers/rules';
export { topMatches, tokens, PLAYBOOKS, MIN_SIMILARITY, playbookWeight } from './layers/playbooks';
export { detectBehaviorSignals, localHour, isQuietHour, BEHAVIOR_WEIGHTS } from './layers/behavior';
export { fuse, LAYER_CAPS, type LayerId } from './layers/fusion';
export { scoreSignals, hardRuleOf, verdictFor, clampScore, HOLD_THRESHOLD, CAUTION_THRESHOLD, isPositive } from './score';
export { fingerprint, findSimilar, jaccard, SIMILARITY_THRESHOLD, NO_FINGERPRINT } from './fingerprint';
export { explain, FLAG_TEXT, weekdayOf } from './explain';

export interface EvaluateOptions {
  /** Rule set (or its version) to run. Defaults to the live rule set. */
  ruleSet?: RuleSet | string;
  /** Approved/released payments of the last ~30 days (behavior layer). */
  payments?: PaymentItem[];
  /** Holds family denied recently, with the check fingerprint (behavior layer). */
  denied?: DeniedItem[];
  /** Evaluation time. Without it the time-based behavior signals (quiet hours, velocity, retry) are skipped, keeping the engine pure. */
  now?: Date;
  /** IANA timezone for quiet hours. */
  timezone?: string;
}

/**
 * Pure, deterministic risk evaluation (docs/detection-engine.md).
 * Throws RangeError for empty or oversized text; the tool layer maps it to INVALID_INPUT.
 */
export function evaluate(text: string, ctx: Context = {}, history: HistoryItem[] = [], options: EvaluateOptions = {}): CheckResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new RangeError('text must not be empty');
  if (trimmed.length > MAX_TEXT_LENGTH) throw new RangeError(`text must be at most ${MAX_TEXT_LENGTH} characters`);

  const ruleSet = typeof options.ruleSet === 'object' ? options.ruleSet : getRuleSet(options.ruleSet ?? LIVE_RULESET_VERSION);
  const on = new Set(ruleSet.layers);

  const rules: Signal[] = detectRuleSignals(trimmed, ctx);
  let playbooks: Signal[] = [];
  let match: PlaybookMatch | null = null;
  if (on.has('playbooks')) {
    const r = detectPlaybookSignals(trimmed);
    playbooks = r.signals;
    match = r.match;
  }
  let behavior: Signal[] = [];
  if (on.has('behavior') && options.now) {
    behavior = detectBehaviorSignals({
      text: trimmed, ctx, payments: options.payments ?? [], denied: options.denied ?? [],
      baseFingerprint: fingerprint([...rules, ...playbooks]), now: options.now, timezone: options.timezone ?? 'America/Chicago',
    });
  }

  const fused = fuse({ rules, playbooks, behavior });
  const fp = fingerprint(fused.signals);
  const similarTo = findSimilar(fp, history);
  const { spokenSummary, card } = explain(fused.verdict, fused.signals, similarTo);

  const result: CheckResult = {
    ruleSetVersion: ruleSet.version,
    layerBreakdown: fused.layerBreakdown,
    playbook: match
      ? { id: match.playbook.id, name: match.playbook.name, advice: match.playbook.advice, similarity: Math.round(match.similarity * 100) / 100 }
      : null,
    verdict: fused.verdict, score: fused.score, signals: fused.signals, fingerprint: fp, similarTo, spokenSummary, card,
  };
  if (fused.hardRule) result.hardRule = fused.hardRule;
  return result;
}

/** Evaluate under the live rule set and a candidate (shadow) rule set. Only `live` should affect users. */
export function evaluateWithShadow(
  text: string, ctx: Context, history: HistoryItem[], shadow: RuleSet | string, options: Omit<EvaluateOptions, 'ruleSet'> = {},
): { live: CheckResult; shadow: CheckResult; disagrees: boolean } {
  const live = evaluate(text, ctx, history, options);
  const cand = evaluate(text, ctx, history, { ...options, ruleSet: shadow });
  return { live, shadow: cand, disagrees: live.verdict !== cand.verdict };
}

