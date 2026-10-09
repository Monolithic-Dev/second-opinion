import type { LayerId } from './layers/fusion';

/**
 * Rule-set registry. Every stored decision is pinned to a version so old verdicts stay explainable and a candidate
 * (shadow) rule set can be backtested beside the live one (docs/backend-architecture.md).
 */
export interface RuleSet {
  version: string;
  description: string;
  layers: LayerId[];
}

export const RULESETS: Record<string, RuleSet> = {
  'rules-2026.10.1': { version: 'rules-2026.10.1', description: 'Layer 1 only: deterministic phrase and context rules', layers: ['rules'] },
  'rules-2026.10.2': { version: 'rules-2026.10.2', description: 'Rules + scam-playbook similarity + household behavior', layers: ['rules', 'playbooks', 'behavior'] },
};

export const LIVE_RULESET_VERSION = 'rules-2026.10.2';

export function getRuleSet(version: string): RuleSet {
  const rs = RULESETS[version];
  if (!rs) throw new RangeError(`unknown rule set ${version}`);
  return rs;
}

export function listRuleSets(): RuleSet[] {
  return Object.values(RULESETS);
}
