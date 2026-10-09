export const NOTIFY_CHANNELS = ['console', 'db', 'email_html'] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

export const NOTIFY_KINDS = ['hold_requested', 'hold_escalated', 'hold_resolved'] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export interface HoldPayload {
  holdId: string;
  recipientName: string;
  description: string;
  amountCents: number | null;
  /** Plain-language scam flags and policy reasons shown to the approver. */
  flags: string[];
  reasonText: string[];
  expiresAt: string;
  /** For hold_resolved: the final status (released | denied | expired). */
  status?: string;
  /** For hold_escalated: the escalation level reached. */
  level?: number;
}

export interface Notification {
  id: string;
  householdId: string;
  recipientId: string;
  channel: NotifyChannel;
  kind: NotifyKind;
  payload: HoldPayload;
  attempts: number;
}

/** What the dispatcher needs from the outbox storage (implemented by the store adapter). */
export interface OutboxPort {
  due(nowIso: string, limit: number): Notification[];
  markSent(id: string, atIso: string): void;
  retry(id: string, attempts: number, nextAttemptIso: string, error: string): void;
  fail(id: string, attempts: number, error: string): void;
}

export interface Adapter {
  channel: NotifyChannel;
  send(n: Notification): void | Promise<void>;
}
