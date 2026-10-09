-- 001_init: core tables (docs/data-model.md)
CREATE TABLE households (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE people (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('elder','family')),
  can_approve INTEGER NOT NULL DEFAULT 0 CHECK (can_approve IN (0,1)),
  contact_label TEXT
);

CREATE TABLE trusted_payees (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('pharmacy','utility','family','merchant','other')),
  created_at TEXT NOT NULL,
  UNIQUE (household_id, name)
);

CREATE TABLE checks (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'unknown' CHECK (channel IN ('call','sms','email','voice','unknown')),
  action_type TEXT NOT NULL DEFAULT 'none' CHECK (action_type IN ('purchase','payment','transfer','none')),
  amount_cents INTEGER,
  payee TEXT,
  signals_json TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('allow','caution','hold')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_checks_hh_time ON checks(household_id, created_at);

CREATE TABLE fingerprints (
  household_id TEXT NOT NULL REFERENCES households(id),
  fingerprint TEXT NOT NULL,
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_check_id TEXT REFERENCES checks(id),
  PRIMARY KEY (household_id, fingerprint)
);

CREATE TABLE holds (
  id TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  check_id TEXT NOT NULL REFERENCES checks(id),
  action_type TEXT NOT NULL,
  amount_cents INTEGER,
  payee TEXT,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired','released')),
  approver_id TEXT REFERENCES people(id),
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  resolved_at TEXT,
  resolved_by TEXT REFERENCES people(id),
  note TEXT
);
CREATE INDEX idx_holds_hh_status ON holds(household_id, status);
CREATE INDEX idx_holds_check ON holds(check_id);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  household_id TEXT,
  type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_audit_hh_time ON audit_events(household_id, created_at);
