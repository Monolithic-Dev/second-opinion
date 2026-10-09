export type Verdict = 'allow' | 'caution' | 'hold';
export type HoldStatus = 'pending' | 'approved' | 'denied' | 'expired' | 'released';

export interface Card {
  title: string;
  level: Verdict;
  flags: string[];
  advice: string;
}

export interface PolicyDecision {
  outcome: 'allow' | 'require_approval' | 'block';
  reasons: string[];
  reasonText: string[];
  quorum: number;
}

export interface TraceEntry {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  ms: number;
  code?: string;
  summary: string;
}

export interface TurnResult {
  intent: string;
  reply: string;
  spoken: string;
  card: Card | null;
  verdict?: Verdict;
  decision?: PolicyDecision;
  holdId?: string;
  executed: boolean;
  blocked?: boolean;
  trace: TraceEntry[];
  traceId: string;
}

export interface Person {
  id: string;
  name: string;
  role: 'elder' | 'family';
  canApprove: boolean;
  approverRank: number;
  contactLabel: string | null;
}

export interface HoldRow {
  holdId: string;
  status: HoldStatus;
  description: string;
  amountCents: number | null;
  payee: string | null;
  flags: string[];
  reasonText: string[];
  approverId: string | null;
  quorumRequired: number;
  votes: { approve: number; deny: number };
  escalationLevel: number;
  createdAt: string;
  expiresAt: string;
}

export interface Policy {
  maxSingleCents: number;
  dailyCapCents: number;
  newPayeeCooloffMin: number;
  requireApprovalAboveCents: number;
  quietHoursStart: string;
  quietHoursEnd: string;
  timezone: string;
  quorum: number;
  escalateAfterMin: number;
  holdTtlMin: number;
}

export interface NotificationRow {
  id: string;
  recipientId: string;
  channel: 'console' | 'db' | 'email_html';
  kind: 'hold_requested' | 'hold_escalated' | 'hold_resolved';
  status: 'queued' | 'sent' | 'failed';
  attempts: number;
  holdId: string;
  description: string;
  createdAt: string;
  sentAt: string | null;
}

export interface Payee {
  id: string;
  name: string;
  kind: 'pharmacy' | 'utility' | 'family' | 'merchant' | 'other';
}

export interface AppState {
  household: { id: string; name: string };
  people: Person[];
  holds: HoldRow[];
  payees: Payee[];
  policy: Policy;
  isDefault: boolean;
  notifications: NotificationRow[];
}

export interface Insights {
  days: number;
  protectedCents: number;
  checksByDay: Array<{ date: string; allow: number; caution: number; hold: number }>;
  holdsByStatus: Record<HoldStatus, number>;
  topSignals: Array<{ id: string; count: number }>;
  medianResponseSec: number | null;
}

export interface HoldDetail {
  hold: {
    holdId: string; householdId: string; status: HoldStatus; description: string; amountCents: number | null; payee: string | null;
    actionType: string; quorumRequired: number; escalationLevel: number; createdAt: string; expiresAt: string;
    resolvedAt: string | null; resolvedBy: string | null; note: string | null;
  };
  risk: { verdict: Verdict; score: number; flags: string[]; reasonText: string[]; text: string };
  votes: Array<{ approverId: string; name: string; decision: 'approve' | 'deny'; note: string | null; decidedAt: string }>;
  timeline: Array<{ type: string; label: string; at: string; by: string | null }>;
}

export interface VoteResult {
  holdId: string;
  status: HoldStatus;
  votes: { approve: number; deny: number; required: number };
}
