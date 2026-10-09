-- 004: transactional notification outbox (docs/policy-and-approvals.md §5)
-- A row is written in the same transaction as the state change that caused it; a dispatcher delivers it later.
-- Delivery is at-least-once; adapters must be idempotent.

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  recipient_id TEXT NOT NULL REFERENCES people(id),
  channel TEXT NOT NULL CHECK (channel IN ('console','db','email_html')),
  kind TEXT NOT NULL CHECK (kind IN ('hold_requested','hold_escalated','hold_resolved')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  last_error TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);
CREATE INDEX idx_notifications_due ON notifications(status, next_attempt_at);
CREATE INDEX idx_notifications_recipient ON notifications(household_id, recipient_id, created_at);
