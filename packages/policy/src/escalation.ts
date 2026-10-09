/** Escalation level a pending hold should be at: one level per `escalateAfterMin` minutes waited, capped. */
export function targetLevel(createdAtIso: string, now: Date, escalateAfterMin: number, maxLevel: number): number {
  const waitedMin = (now.getTime() - Date.parse(createdAtIso)) / 60_000;
  if (!Number.isFinite(waitedMin) || waitedMin < 0) return 0;
  return Math.max(0, Math.min(maxLevel, Math.floor(waitedMin / escalateAfterMin)));
}

export interface Rank {
  id: string;
  rank: number;
}

/** Level 0 notifies rank 1; each level adds the next rank. Sorted by rank then id so results are deterministic. */
export function approversToNotify(approvers: Rank[], level: number): string[] {
  return [...approvers]
    .filter((a) => a.rank <= level + 1)
    .sort((a, b) => a.rank - b.rank || (a.id < b.id ? -1 : 1))
    .map((a) => a.id);
}

/** Approvers who should be newly notified when moving from `fromLevel` to `toLevel` (each exactly once). */
export function newlyNotified(approvers: Rank[], fromLevel: number, toLevel: number): string[] {
  const before = new Set(approversToNotify(approvers, fromLevel));
  return approversToNotify(approvers, toLevel).filter((id) => !before.has(id));
}

/** Highest escalation level that could ever notify someone new. */
export function maxLevel(approvers: Rank[]): number {
  return Math.max(0, ...approvers.map((a) => a.rank)) - 1;
}
