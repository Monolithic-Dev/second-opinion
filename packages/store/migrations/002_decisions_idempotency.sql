-- 002: append-only decision log, idempotency keys, tamper-evident audit (docs/backend-architecture.md)

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  check_id TEXT NOT NULL REFERENCES checks(id),
  trace_id TEXT NOT NULL,
  rule_set_version TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK (verdict IN ('allow','caution','hold')),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  reasons_json TEXT NOT NULL,    -- signals, hard rule: enough to explain the verdict without the rules table
  features_json TEXT NOT NULL,   -- inputs the engine saw (context + history size), for replay
  latency_ms REAL NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_decisions_hh_time ON decisions(household_id, created_at);
CREATE INDEX idx_decisions_check ON decisions(check_id);

CREATE TABLE idempotency_keys (
  tool TEXT NOT NULL,
  key TEXT NOT NULL,
  household_id TEXT,
  request_hash TEXT NOT NULL,
  response_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tool, key)
);

-- Append-only: decisions and audit events can never be changed or removed.
CREATE TRIGGER decisions_no_update BEFORE UPDATE ON decisions BEGIN SELECT RAISE(ABORT, 'decisions is append-only'); END;
CREATE TRIGGER decisions_no_delete BEFORE DELETE ON decisions BEGIN SELECT RAISE(ABORT, 'decisions is append-only'); END;
CREATE TRIGGER audit_no_update BEFORE UPDATE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
CREATE TRIGGER audit_no_delete BEFORE DELETE ON audit_events BEGIN SELECT RAISE(ABORT, 'audit_events is append-only'); END;
