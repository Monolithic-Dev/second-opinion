import type { Signal } from '@second-opinion/shared';
import { normalize } from '../normalize';
import { PLAYBOOK_PACKS, PLAYBOOKS, type Playbook, type PlaybookPack } from '../playbooks/data';

/** Layer 2: lexical, deterministic similarity to known scam playbooks (idf-weighted keyword coverage). No models. */
export const MIN_SIMILARITY = 0.3;
export const MIN_MATCHED_TERMS = 3;
export const MAX_PLAYBOOK_WEIGHT = 30;

const STOP = new Set(
  ('a an the and or but if then so to of in on at by for with from as is are was were be been am it its this that these those i you he she we they ' +
    'me my your our their him her them us do does did not no yes will would can could should may might must have has had just than too very ' +
    'about into over after before again also please there here what when who how why which').split(' '),
);

export function tokens(text: string): string[] {
  return normalize(text)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t));
}

interface Indexed {
  playbook: Playbook;
  keywords: Set<string>;
  total: number;
}

function buildIndex(playbooks: Playbook[]): { docs: Indexed[]; idf: Map<string, number> } {
  const sets = playbooks.map((p) => new Set(p.phrases.flatMap(tokens)));
  const df = new Map<string, number>();
  for (const s of sets) for (const t of s) df.set(t, (df.get(t) ?? 0) + 1);
  const n = playbooks.length;
  const idf = new Map<string, number>();
  for (const [t, d] of df) idf.set(t, Math.log(1 + (n - d + 0.5) / (d + 0.5)));
  const docs = playbooks.map((playbook, i) => {
    const keywords = sets[i] as Set<string>;
    let total = 0;
    for (const k of keywords) total += idf.get(k) ?? 0;
    return { playbook, keywords, total };
  });
  return { docs, idf };
}

const INDEXES: Record<PlaybookPack, ReturnType<typeof buildIndex>> = { p1: buildIndex(PLAYBOOK_PACKS.p1), p2: buildIndex(PLAYBOOK_PACKS.p2), p3: buildIndex(PLAYBOOK_PACKS.p3) };

export interface PlaybookMatch {
  playbook: Playbook;
  similarity: number;
  matched: string[];
}

/** Best matches first. Ties break by playbook id so results are deterministic. */
export function topMatches(text: string, k = 3, pack: PlaybookPack = 'p2'): PlaybookMatch[] {
  const INDEX = INDEXES[pack];
  const q = new Set(tokens(text));
  const out: PlaybookMatch[] = [];
  for (const d of INDEX.docs) {
    const matched = [...d.keywords].filter((t) => q.has(t));
    if (matched.length === 0 || d.total === 0) continue;
    const covered = matched.reduce((acc, t) => acc + (INDEX.idf.get(t) ?? 0), 0);
    out.push({ playbook: d.playbook, similarity: covered / d.total, matched });
  }
  return out
    .sort((a, b) => b.similarity - a.similarity || (a.playbook.id < b.playbook.id ? -1 : 1))
    .slice(0, k);
}

export function playbookWeight(similarity: number): number {
  return Math.min(MAX_PLAYBOOK_WEIGHT, Math.round(60 * similarity));
}

export function detectPlaybookSignals(text: string, pack: PlaybookPack = 'p2'): { signals: Signal[]; match: PlaybookMatch | null } {
  const best = topMatches(text, 1, pack)[0];
  if (!best || best.similarity < MIN_SIMILARITY || best.matched.length < MIN_MATCHED_TERMS) return { signals: [], match: null };
  return {
    signals: [{ id: 'PLAYBOOK_MATCH', weight: playbookWeight(best.similarity), evidence: best.playbook.name }],
    match: best,
  };
}

export { PLAYBOOKS, PLAYBOOK_PACKS, type PlaybookPack };
