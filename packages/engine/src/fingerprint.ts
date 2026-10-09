import type { HistoryItem, Signal, Similar } from '@second-opinion/shared';
import { isPositive } from './score';

export const SIMILARITY_THRESHOLD = 0.75;
export const NO_FINGERPRINT = 'NONE';

/** Sorted positive signal ids joined by `|`; `NONE` when there are none. */
export function fingerprint(signals: Signal[]): string {
  const ids = [...new Set(signals.filter((s) => isPositive(s.id) && s.weight > 0).map((s) => s.id))].sort();
  return ids.length ? ids.join('|') : NO_FINGERPRINT;
}

export function jaccard(a: string[], b: string[]): number {
  const A = new Set(a);
  const B = new Set(b);
  if (A.size === 0 && B.size === 0) return 0;
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  return inter / (A.size + B.size - inter);
}

/** Best earlier match with Jaccard >= threshold; ties resolve to the most recent. `NONE` never matches. */
export function findSimilar(fp: string, history: HistoryItem[], threshold = SIMILARITY_THRESHOLD): Similar | null {
  if (fp === NO_FINGERPRINT) return null;
  const mine = fp.split('|');
  let best: { item: HistoryItem; score: number } | null = null;
  for (const item of history) {
    if (item.fingerprint === NO_FINGERPRINT) continue;
    const score = jaccard(mine, item.fingerprint.split('|'));
    if (score < threshold) continue;
    if (!best || score > best.score || (score === best.score && item.createdAt > best.item.createdAt)) {
      best = { item, score };
    }
  }
  if (!best) return null;
  return best.item.holdId
    ? { checkId: best.item.checkId, date: best.item.createdAt, holdId: best.item.holdId }
    : { checkId: best.item.checkId, date: best.item.createdAt };
}
