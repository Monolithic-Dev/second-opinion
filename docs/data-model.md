# Data model (SQLite via better-sqlite3)

All data is **synthetic**. IDs are text with prefixes. Timestamps are ISO-8601 UTC strings. Amounts are integer cents.

## Entities
| Entity | Purpose |
|---|---|
| `households` | A household being protected |
| `people` | Elder(s) and family approvers |
| `trusted_payees` | Allow-list of safe payees |
| `checks` | Every risk check performed |
| `fingerprints` | Aggregated signal-set patterns seen before (memory) |
| `holds` | Held actions awaiting family decision |
| `audit_events` | Append-only log of tool calls and state changes |

## Schema (`apps/mcp-server/src/store/schema.sql`)
```sql
CREATE TABLE households (
  id TEXT PRIMARY KEY,                -- hh_demo
  name TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE people (
  id TEXT PRIMARY KEY,                -- p_dorothy, p_priya
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('elder','family')),
  can_approve INTEGER NOT NULL DEFAULT 0 CHECK (can_approve IN (0,1)),
  contact_label TEXT                  -- e.g. "Priya's phone" (simulated)
);
CREATE TABLE trusted_payees (
  id TEXT PRIMARY KEY,                -- pay_...
  household_id TEXT NOT NULL REFERENCES households(id),
  name TEXT NOT NULL,                 -- normalised lowercase for matching
  kind TEXT NOT NULL CHECK (kind IN ('pharmacy','utility','family','merchant','other')),
  created_at TEXT NOT NULL,
  UNIQUE (household_id, name)
);
CREATE TABLE checks (
  id TEXT PRIMARY KEY,                -- chk_...
  household_id TEXT NOT NULL REFERENCES households(id),
  text TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'unknown' CHECK (channel IN ('call','sms','email','voice','unknown')),
  action_type TEXT NOT NULL DEFAULT 'none' CHECK (action_type IN ('purchase','payment','transfer','none')),
  amount_cents INTEGER,
  payee TEXT,
  signals_json TEXT NOT NULL,         -- [{id,weight,evidence}]
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  verdict TEXT NOT NULL CHECK (verdict IN ('allow','caution','hold')),
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_checks_hh_time ON checks(household_id, created_at);
CREATE TABLE fingerprints (
  household_id TEXT NOT NULL REFERENCES households(id),
  fingerprint TEXT NOT NULL,          -- sorted signal ids joined by '|'
  first_seen TEXT NOT NULL,
  last_seen TEXT NOT NULL,
  seen_count INTEGER NOT NULL DEFAULT 1,
  last_check_id TEXT REFERENCES checks(id),
  PRIMARY KEY (household_id, fingerprint)
);
CREATE TABLE holds (
  id TEXT PRIMARY KEY,                -- hold_...
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
CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,                -- evt_...
  household_id TEXT,
  type TEXT NOT NULL,                 -- tool.check_message, hold.created, hold.resolved, ...
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
```

## Relationships
`households 1—N people`, `households 1—N trusted_payees`, `checks N—1 households`, `holds N—1 checks`, `fingerprints (household, fingerprint)` aggregates `checks`.

## Status semantics
- `pending` → `approved` (then `released`, simulated execution) | `denied` | `expired`.
- `expired` and `denied` never execute. `released` means the elder-side action was allowed to proceed (simulated).
- Expiry is evaluated lazily on read (`expires_at < now` and status `pending` ⇒ set `expired`).

## Query patterns (hot)
1. Latest checks by household → `idx_checks_hh_time`.
2. Pending holds by household → `idx_holds_hh_status`.
3. Fingerprint lookup by `(household_id, fingerprint)` primary key; similarity scan over the household's fingerprints (tiny table, linear scan OK).

## Validation rules
- `text` 1–2000 chars; trimmed. `amount_cents` ≥ 0 and ≤ 10,000,000. `payee` ≤ 100 chars.
- Only people with `can_approve=1` and `role='family'` can resolve holds.
- Payee names normalised: lowercase, collapse whitespace.

## Sample records
```json
{"table":"people","rows":[
 {"id":"p_dorothy","household_id":"hh_demo","name":"Dorothy","role":"elder","can_approve":0,"contact_label":"Echo kitchen"},
 {"id":"p_priya","household_id":"hh_demo","name":"Priya","role":"family","can_approve":1,"contact_label":"Priya's phone"}]}
{"table":"trusted_payees","rows":[
 {"id":"pay_1","household_id":"hh_demo","name":"greenleaf pharmacy","kind":"pharmacy","created_at":"2026-10-09T00:00:00Z"},
 {"id":"pay_2","household_id":"hh_demo","name":"city power & light","kind":"utility","created_at":"2026-10-09T00:00:00Z"}]}
{"table":"holds","rows":[
 {"id":"hold_1","household_id":"hh_demo","check_id":"chk_1","action_type":"purchase","amount_cents":100000,"payee":"gift cards","description":"5 x $200 gift cards","status":"pending","approver_id":"p_priya","created_at":"2026-10-09T10:00:00Z","expires_at":"2026-10-09T10:10:00Z"}]}
```

## Tier 1 schema additions
Tables `policies`, `approvals`, `notifications` and columns `people.approver_rank`, `holds.quorum_required|escalation_level|reasons_json` are defined in `policy-and-approvals.md` §4 (migrations `002`, `003`). Tier 1 introduces `packages/store/src/migrate.ts` with a `schema_migrations` table; Phase 3's `schema.sql` becomes `001_init.sql`.

## Migrations (Tier 0)
No migration framework. `schema.sql` is idempotent (`CREATE TABLE IF NOT EXISTS` in code); during the hackathon we delete `data/second-opinion.db` and re-seed. Post-hackathon: adopt a versioned migration tool.
