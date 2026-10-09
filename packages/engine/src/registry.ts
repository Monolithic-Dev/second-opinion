import type { LayerId } from './layers/fusion';
import type { RulePack } from './layers/rules';
import type { PlaybookPack } from './playbooks/data';

/**
 * Rule-set registry. Every stored decision is pinned to a version so old verdicts stay explainable and a candidate
 * (shadow) rule set can be backtested beside the live one (docs/backend-architecture.md).
 * A published version never changes: it names the layers, the rule pack and the playbook pack it uses. Improving the detector
 * means a new version (see test/frozen-rulesets.test.ts).
 */
export interface RuleSet {
  version: string;
  description: string;
  layers: LayerId[];
  rulePack: RulePack;
  playbookPack: PlaybookPack;
}

export const RULESETS: Record<string, RuleSet> = {
  'rules-2026.10.1': { version: 'rules-2026.10.1', description: 'Layer 1 only: deterministic phrase and context rules', layers: ['rules'], rulePack: 'v1', playbookPack: 'p1' },
  'rules-2026.10.2': { version: 'rules-2026.10.2', description: 'Rules + scam-playbook similarity + household behavior', layers: ['rules', 'playbooks', 'behavior'], rulePack: 'v1', playbookPack: 'p1' },
  'rules-2026.10.3': {
    version: 'rules-2026.10.3',
    description: 'As .2, plus code/credential-request and wire patterns, a credential-pressure decisive rule and delivery-fee playbook phrasings (tuned on the benchmark dev split only)',
    layers: ['rules', 'playbooks', 'behavior'], rulePack: 'v2', playbookPack: 'p2',
  },
};

export const LIVE_RULESET_VERSION = 'rules-2026.10.3';

export function getRuleSet(version: string): RuleSet {
  const rs = RULESETS[version];
  if (!rs) throw new RangeError(`unknown rule set ${version}`);
  return rs;
}

export function listRuleSets(): RuleSet[] {
  return Object.values(RULESETS);
}
