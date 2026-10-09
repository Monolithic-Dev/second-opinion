# Policy engine, approvals and notifications (Tier 1)

Turns "hold if risky" into a real, configurable protection system. Pure logic in `packages/policy`; persistence in `packages/store`; delivery in `packages/notify`.

## 1. Household policy (editable by approvers only)
| Field | Type / default | Meaning |
|---|---|---|
| `max_single_cents` | int, 50000 | Single payment above this ⇒ requires approval regardless of risk |
| `daily_cap_cents` | int, 150000 | Total approved+pending spend/day above this ⇒ **block** (family must act in console) |
| `new_payee_cooloff_min` | int, 60 | First payment to a new payee waits this long unless approved |
| `require_approval_above_cents` | int, 20000 | Soft threshold: caution + above ⇒ approval |
| `quiet_hours_start/end` | `HH:MM`, 22:00–06:00 | Payments in quiet hours need approval |
| `timezone` | IANA, `America/Chicago` | For quiet hours and daily cap boundaries |
| `quorum` | 1 or 2, 1 | Approvals required to release |
| `escalate_after_min` | int, 5 | Notify next approver tier after this wait |
| `hold_ttl_min` | int, 10 | Total time before expiry (still blocked) |

## 2. Decision matrix (`decision.ts`: `decide(risk, policy, ctx) → Decision`)
`Decision = {outcome: 'allow'|'require_approval'|'block', reasons: ReasonCode[], quorum: number}`
- risk `hold` ⇒ `require_approval` (reason `RISK_HOLD`).
- risk `caution` and amount ≥ `require_approval_above_cents` ⇒ `require_approval` (`RISK_CAUTION_AMOUNT`).
- amount > `max_single_cents` ⇒ `require_approval` (`OVER_SINGLE_LIMIT`), quorum = `max(quorum, 2)` if amount > 3× limit.
- new payee within cool-off ⇒ `require_approval` (`NEW_PAYEE_COOLOFF`).
- quiet hours ⇒ `require_approval` (`QUIET_HOURS`).
- daily cap exceeded ⇒ `block` (`DAILY_CAP`).
- else `allow`. Outcomes combine by max severity; reasons accumulate and are shown on the card.
- Hard rule: policy can only **tighten**; it never turns a risk `hold` into `allow`.

> **As built (B4a/B4b):** `packages/policy` (pure: `decide`, `tally`, escalation helpers, `validatePolicy`) and policy persistence/tools are merged. Field names in code are camelCase (`maxSingleCents`, ...) and snake_case in SQL. `decide` skips payee, hour and cap rules for informational checks (`actionType: none`). The policy decision is stored with each (append-only) decision row. **B4c is merged too:** `packages/notify` (templates, dispatcher with 5s/20s/80s backoff, console/db/email-HTML adapters), migration 004, `list_notifications`, and the escalation / expiry / outbox jobs.

## 3. Approval state machine (`quorum.ts`, `escalation.ts`)
```
pending ──(approvals ≥ quorum)──▶ approved ──▶ released
   │ ├──(any deny)──────────────▶ denied      (veto)
   │ ├──(escalate_after_min)────▶ pending (escalation_level+1, next approver tier notified)
   │ └──(hold_ttl_min)──────────▶ expired     (stays blocked)
```
- Approvers have `approver_rank` (1 = primary). Level n notifies rank ≤ n+1.
- One vote per approver (`UNIQUE(hold_id, approver_id)`); votes are idempotent (re-vote same decision ⇒ no-op, different ⇒ `CONFLICT`).
- Elder can never vote. Any single `deny` vetoes.
- Jobs (`apps/mcp-server/src/jobs`): `escalation.ts` and `expiry.ts` tick every 15 s (`setInterval`, guarded by a DB advisory row to avoid double-processing); also executed lazily on reads so tests need no timers.

## 4. Schema additions (migration `002_policy_approvals.sql`, `003_notifications.sql`)
```sql
ALTER TABLE people ADD COLUMN approver_rank INTEGER NOT NULL DEFAULT 1;
CREATE TABLE policies (
  household_id TEXT PRIMARY KEY REFERENCES households(id),
  max_single_cents INTEGER NOT NULL DEFAULT 50000,
  daily_cap_cents INTEGER NOT NULL DEFAULT 150000,
  new_payee_cooloff_min INTEGER NOT NULL DEFAULT 60,
  require_approval_above_cents INTEGER NOT NULL DEFAULT 20000,
  quiet_hours_start TEXT NOT NULL DEFAULT '22:00',
  quiet_hours_end TEXT NOT NULL DEFAULT '06:00',
  timezone TEXT NOT NULL DEFAULT 'America/Chicago',
  quorum INTEGER NOT NULL DEFAULT 1 CHECK (quorum IN (1,2)),
  escalate_after_min INTEGER NOT NULL DEFAULT 5,
  hold_ttl_min INTEGER NOT NULL DEFAULT 10,
  updated_at TEXT NOT NULL, updated_by TEXT REFERENCES people(id)
);
ALTER TABLE holds ADD COLUMN quorum_required INTEGER NOT NULL DEFAULT 1;
ALTER TABLE holds ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0;
ALTER TABLE holds ADD COLUMN reasons_json TEXT NOT NULL DEFAULT '[]';
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,                    -- appr_...
  hold_id TEXT NOT NULL REFERENCES holds(id),
  approver_id TEXT NOT NULL REFERENCES people(id),
  decision TEXT NOT NULL CHECK (decision IN ('approve','deny')),
  note TEXT, decided_at TEXT NOT NULL,
  UNIQUE (hold_id, approver_id)
);
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,                    -- ntf_...
  household_id TEXT NOT NULL REFERENCES households(id),
  recipient_id TEXT NOT NULL REFERENCES people(id),
  channel TEXT NOT NULL CHECK (channel IN ('console','db','email_html')),
  kind TEXT NOT NULL CHECK (kind IN ('hold_requested','hold_escalated','hold_resolved','digest')),
  payload_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL, sent_at TEXT
);
CREATE INDEX idx_ntf_status ON notifications(status, created_at);
```
`status` of `holds` unchanged (`pending|approved|denied|expired|released`). `holds.resolved_by/approver_id` kept for Tier 0 compatibility; Tier 1 uses `approvals`.

## 5. Notifications (`packages/notify`)
- `enqueue(kind, recipient, payload)` writes a row (transactional with the state change — outbox pattern).
- Dispatcher loop (`outbox.ts`): picks `queued`, calls adapter, marks `sent`; failure ⇒ `attempts+1`, exponential backoff (5 s, 20 s, 80 s), `failed` after 4.
- Adapters: `console` (logs + SSE to the web app), `db` (visible in console inbox), `emailHtml` (renders `templates/hold.ts` to `outbox/*.html` on disk; **no real email is sent** — documented as simulated).
- Weekly digest (`jobs/digest.ts`, T2): summarises checks, holds, protected dollars.

## 6. MCP surface additions
Tools `get_policy`, `set_policy`, `household_insights`; resource `so://household/{id}/summary`; see `api-spec.md` §E. `set_policy` validates ranges (e.g., `max_single_cents` 1000–5,000,000, quorum ≤ number of approvers) and audits before/after.

## 7. Tests
`policy/test/decision.test.ts` (matrix cases incl. tighten-only invariant), `quorum.test.ts` (2-of-2, veto, idempotent vote, elder forbidden), `escalation.test.ts` (fake clock), `notify/outbox.test.ts` (retry/backoff, transactional enqueue), `mcp-server/test/policy-tools.test.ts`.
