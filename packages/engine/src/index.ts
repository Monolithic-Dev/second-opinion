import { MAX_TEXT_LENGTH, type CheckResult, type Context, type HistoryItem } from '@second-opinion/shared';
import { detectRuleSignals } from './layers/rules';
import { scoreSignals } from './score';
import { fingerprint, findSimilar } from './fingerprint';
import { explain } from './explain';
import { RULESET_VERSION } from './version';

export { normalize, deleet } from './normalize';
export { RULESET_VERSION } from './version';
export { parseAmountCents, wordsToNumber } from './amount';
export { detectRuleSignals, WEIGHTS, HIGH_AMOUNT_CENTS } from './layers/rules';
export { scoreSignals, HOLD_THRESHOLD, CAUTION_THRESHOLD, isPositive } from './score';
export { fingerprint, findSimilar, jaccard, SIMILARITY_THRESHOLD, NO_FINGERPRINT } from './fingerprint';
export { explain, FLAG_TEXT, weekdayOf } from './explain';

/**
 * Pure, deterministic risk evaluation (docs/detection-engine.md).
 * Throws RangeError for empty or oversized text; the tool layer maps it to INVALID_INPUT.
 */
export function evaluate(text: string, ctx: Context = {}, history: HistoryItem[] = []): CheckResult {
  const trimmed = text.trim();
  if (trimmed.length === 0) throw new RangeError('text must not be empty');
  if (trimmed.length > MAX_TEXT_LENGTH) throw new RangeError(`text must be at most ${MAX_TEXT_LENGTH} characters`);

  const signals = detectRuleSignals(trimmed, ctx);
  const { score, verdict, hardRule } = scoreSignals(signals);
  const fp = fingerprint(signals);
  const similarTo = findSimilar(fp, history);
  const { spokenSummary, card } = explain(verdict, signals, similarTo);

  const result: CheckResult = { ruleSetVersion: RULESET_VERSION, verdict, score, signals, fingerprint: fp, similarTo, spokenSummary, card };
  if (hardRule) result.hardRule = hardRule;
  return result;
}
