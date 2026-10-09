-- 003: household policy, multi-approver votes, hold quorum metadata (docs/policy-and-approvals.md)

ALTER TABLE people ADD COLUMN approver_rank INTEGER NOT NULL DEFAULT 1;

CREATE TABLE policies (
  household_id TEXT PRIMARY KEY REFERENCES households(id),
  max_single_cents INTEGER NOT NULL,
  daily_cap_cents INTEGER NOT NULL,
  new_payee_cooloff_min INTEGER NOT NULL,
  require_approval_above_cents INTEGER NOT NULL,
  quiet_hours_start TEXT NOT NULL,
  quiet_hours_end TEXT NOT NULL,
  timezone TEXT NOT NULL,
  quorum INTEGER NOT NULL CHECK (quorum IN (1,2)),
  escalate_after_min INTEGER NOT NULL,
  hold_ttl_min INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  updated_by TEXT REFERENCES people(id)
);

ALTER TABLE holds ADD COLUMN quorum_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE holds ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE holds ADD COLUMN reasons_json TEXT NOT NULL DEFAULT '[]';

CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  hold_id TEXT NOT NULL REFERENCES holds(id),
  approver_id TEXT NOT NULL REFERENCES people(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','deny')),
  note TEXT,
  decided_at TEXT NOT NULL,
  UNIQUE (hold_id, approver_id)
);
CREATE INDEX idx_approvals_hold ON approvals(hold_id);

-- The policy outcome is recorded with the (append-only) decision at insert time.
ALTER TABLE decisions ADD COLUMN policy_outcome TEXT NOT NULL DEFAULT 'allow' CHECK (policy_outcome IN ('allow','require_approval','block'));
ALTER TABLE decisions ADD COLUMN policy_reasons_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE decisions ADD COLUMN quorum INTEGER NOT NULL DEFAULT 1;
