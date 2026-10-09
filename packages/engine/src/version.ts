import { LIVE_RULESET_VERSION } from './registry';

/**
 * Version of the live deterministic rule set. Bump (add a new entry in registry.ts) on ANY change to signals,
 * weights, thresholds, layers or playbooks; stored decisions are pinned to it.
 */
export const RULESET_VERSION = LIVE_RULESET_VERSION;
