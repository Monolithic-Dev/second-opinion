/** Canonical domain types. Names mirror docs/api-spec.md and docs/detection-engine.md. */

export const SIGNAL_IDS = [
  'GIFT_CARD',
  'WIRE_OR_CRYPTO',
  'REMOTE_ACCESS',
  'VERIFICATION_CODE',
  'FAMILY_EMERGENCY',
  'PRIZE_OR_LOTTERY',
  'AUTHORITY_IMPERSONATION',
  'SECRECY',
  'URGENCY',
  'UNSOLICITED_CONTACT',
  'NEW_PAYEE',
  'HIGH_AMOUNT',
  'TRUSTED_PAYEE',
  'OFFICIAL_CHANNEL_ADVICE',
  // Tier 1 layers (emitted by later layers, enum is stable from day one)
  'PLAYBOOK_MATCH',
  'AMOUNT_ANOMALY',
  'PAYEE_VELOCITY',
  'QUIET_HOURS',
  'RETRY_AFTER_DENY',
] as const;
export type SignalId = (typeof SIGNAL_IDS)[number];

export const VERDICTS = ['allow', 'caution', 'hold'] as const;
export type Verdict = (typeof VERDICTS)[number];

export const ACTION_TYPES = ['purchase', 'payment', 'transfer', 'none'] as const;
export type ActionType = (typeof ACTION_TYPES)[number];

export const CHANNELS = ['call', 'sms', 'email', 'voice', 'unknown'] as const;
export type Channel = (typeof CHANNELS)[number];

export const HOLD_STATUSES = ['pending', 'approved', 'denied', 'expired', 'released'] as const;
export type HoldStatus = (typeof HOLD_STATUSES)[number];

export const PAYEE_KINDS = ['pharmacy', 'utility', 'family', 'merchant', 'other'] as const;
export type PayeeKind = (typeof PAYEE_KINDS)[number];

export interface Signal {
  id: SignalId;
  weight: number;
  evidence: string;
}

export interface Context {
  channel?: Channel;
  actionType?: ActionType;
  amountCents?: number;
  payee?: string;
  trustedPayees?: string[];
}

export interface Card {
  title: string;
  level: Verdict;
  flags: string[];
  advice: string;
}

export interface PaymentItem {
  amountCents: number;
  payee: string | null;
  at: string;
}

export interface DeniedItem {
  fingerprint: string;
  at: string;
}

export interface PlaybookRef {
  id: string;
  name: string;
  advice: string;
  similarity: number;
}

export interface Similar {
  checkId: string;
  date: string;
  holdId?: string;
}

export interface HistoryItem {
  checkId: string;
  fingerprint: string;
  createdAt: string;
  holdId?: string;
}

export interface CheckResult {
  /** Version of the rule set that produced this verdict; every stored decision is pinned to it. */
  ruleSetVersion: string;
  /** Score contributed by each layer after caps (rules / playbooks / behavior). */
  layerBreakdown: Record<string, number>;
  /** Best matching known-scam playbook, if any. */
  playbook: PlaybookRef | null;
  verdict: Verdict;
  score: number;
  signals: Signal[];
  hardRule?: string;
  fingerprint: string;
  similarTo: Similar | null;
  spokenSummary: string;
  card: Card;
}

export const MAX_TEXT_LENGTH = 2000;
export const MAX_AMOUNT_CENTS = 10_000_000;
