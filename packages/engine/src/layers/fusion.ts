import type { Signal, Verdict } from '@second-opinion/shared';
import { clampScore, hardRuleOf, verdictFor } from '../score';

export type LayerId = 'rules' | 'playbooks' | 'behavior';

/** Per-layer caps on positive contribution. Rules are uncapped (they can reach 100 alone). */
export const LAYER_CAPS: Record<LayerId, number> = { rules: 100, playbooks: 30, behavior: 40 };

export interface Fused {
  signals: Signal[];
  score: number;
  verdict: Verdict;
  hardRule?: string;
  layerBreakdown: Record<LayerId, number>;
}

/**
 * Combine layer outputs: subtotal per layer, cap positive contribution of playbooks/behavior, sum, clamp 0-100,
 * apply thresholds, then decisive hard rules (which only raise to `hold`). Deterministic and order-independent.
 */
export function fuse(layers: Partial<Record<LayerId, Signal[]>>): Fused {
  const breakdown: Record<LayerId, number> = { rules: 0, playbooks: 0, behavior: 0 };
  const signals: Signal[] = [];
  for (const id of ['rules', 'playbooks', 'behavior'] as const) {
    const list = layers[id] ?? [];
    signals.push(...list);
    const subtotal = list.reduce((acc, s) => acc + s.weight, 0);
    // A layer's contribution is never negative: a trusted payee cannot cancel risk found by another layer.
    breakdown[id] = Math.max(0, Math.min(subtotal, LAYER_CAPS[id]));
  }
  const score = clampScore(breakdown.rules + breakdown.playbooks + breakdown.behavior);
  const hardRule = hardRuleOf(signals);
  const verdict = hardRule ? 'hold' : verdictFor(score);
  return hardRule ? { signals, score, verdict, hardRule, layerBreakdown: breakdown } : { signals, score, verdict, layerBreakdown: breakdown };
}
