# API spec

Two surfaces: **MCP tools** (the product; port 3001, `/mcp`) and the **simulator HTTP API** (port 3000, used by the browser). Names here are canonical across all docs.

## A. MCP server (`apps/mcp-server`)
- Transport: Streamable HTTP, MCP spec **2025-11-25 or later**, endpoint `POST/GET /mcp` (stateless: new transport per request).
- Health: `GET /healthz` → `{"ok":true,"version":"x.y.z"}`.
- Auth: `Authorization: Bearer ${MCP_AUTH_TOKEN}` required when the env var is set (default `dev-token` in `.env.example`); 401 otherwise.
- Tool errors are **tool execution errors** (`isError: true`, per SEP-1303), never protocol errors, with `structuredContent {code, message}` and a text block; codes: `INVALID_INPUT`, `NOT_FOUND`, `FORBIDDEN`, `CONFLICT`, `INTERNAL`.
- Every tool declares an `outputSchema` and returns matching `structuredContent` plus the same JSON serialized in `content[0].text` (older-client compatibility). Tool `title`, `description` and `annotations` follow `mcp-best-practices.md` §2.
- Transport rules (stateless; `GET`/`DELETE /mcp` ⇒ 405; invalid `Origin` ⇒ 403; unsupported `MCP-Protocol-Version` ⇒ 400; bind `127.0.0.1` by default) are in `mcp-best-practices.md` §1.

### Tool: `check_message`
Scores a message or a requested action.
```json
// input
{"householdId":"hh_demo","text":"The bank says I must buy 5 $200 gift cards today",
 "channel":"voice","context":{"actionType":"purchase","amountCents":100000,"payee":"gift cards"}}
// output.structuredContent
{"checkId":"chk_9f2","verdict":"hold","score":100,
 "signals":[{"id":"GIFT_CARD","weight":45,"evidence":"gift cards"},
            {"id":"URGENCY","weight":20,"evidence":"today"},
            {"id":"AUTHORITY_IMPERSONATION","weight":25,"evidence":"the bank says"},
            {"id":"HIGH_AMOUNT","weight":15,"evidence":"$1000"}],
 "hardRule":"GIFT_CARD_PLUS_ANY",
 "similarTo":null,
 "spokenSummary":"This matches a common scam: gift cards, urgency, and someone claiming to be the bank.",
 "card":{"title":"Held: possible scam","level":"hold","flags":["Asks for gift cards","Pressure to act today","Claims to be your bank"],"advice":"Real banks never ask for gift cards."}}
```
`channel` ∈ call|sms|email|voice|unknown (default unknown). `context.actionType` ∈ purchase|payment|transfer|none. Errors: `INVALID_INPUT` (empty/oversized text), `NOT_FOUND` (household).

### Tool: `place_hold`
```json
{"householdId":"hh_demo","checkId":"chk_9f2","actionType":"purchase","amountCents":100000,"payee":"gift cards","description":"5 x $200 gift cards"}
// → {"holdId":"hold_77","status":"pending","expiresAt":"2026-10-09T10:10:00Z"}
```
Errors: `NOT_FOUND` (check), `CONFLICT` (check already has an open hold). Only allowed when the check verdict is `hold` or `caution`; `INVALID_INPUT` if `allow`.

### Tool: `request_family_approval`
```json
{"holdId":"hold_77","approverId":"p_priya"}   // approverId optional → first can_approve person
// → {"holdId":"hold_77","status":"pending","notified":["p_priya"]}
```
Notification is simulated (SSE event + audit row). Errors: `NOT_FOUND`, `FORBIDDEN` (not an approver).

### Tool: `resolve_approval`
```json
{"holdId":"hold_77","decision":"deny","resolvedBy":"p_priya","note":"Not a real bank call"}
// → {"holdId":"hold_77","status":"denied","resolvedAt":"..."}
```
`decision` ∈ approve|deny. `approve` ⇒ final status `released` (approved and released in one atomic step); `deny` ⇒ `denied`. Output: `{holdId, decision, status, resolvedAt}`. Errors: `FORBIDDEN` (resolver not approver), `CONFLICT` (not pending / expired).

### Tool: `trusted_payees`
```json
{"householdId":"hh_demo","action":"add","name":"Greenleaf Pharmacy","kind":"pharmacy","requestedBy":"p_priya"}
// → {"payees":[{"id":"pay_1","name":"greenleaf pharmacy","kind":"pharmacy"}]}
```
`action` ∈ list|add|remove. add/remove require `requestedBy` to be an approver (`FORBIDDEN` otherwise).

### Tool: `list_holds`
```json
{"householdId":"hh_demo","status":"pending"}   // status optional
// → {"holds":[{"holdId":"hold_77","status":"pending","description":"5 x $200 gift cards","amountCents":100000,"flags":["Asks for gift cards"],"createdAt":"..."}]}
```

## B. Simulator HTTP API (`apps/simulator`, port 3000)
| Method | Path | Purpose | Body → Response |
|---|---|---|---|
| POST | `/api/utter` | One spoken/typed turn | `{householdId, speaker:"elder"\|"family", text}` → `{reply, spoken, card?, holdId?, verdict?, trace:[{tool,args,result}]}` |
| GET | `/api/state` | Snapshot for panes | `?householdId=` → `{people, payees, holds, recentChecks}` |
| GET | `/api/events` | SSE stream | events: `hold.created`, `hold.resolved`, `check.done`, `reset` |
| POST | `/api/family/resolve` | Family taps button | `{holdId, decision, resolvedBy}` → `{status}` |
| POST | `/api/reset` | Re-seed demo household | `{}` → `{ok:true}` |
| GET | `/healthz` | Liveness | `{ok:true, mcp:true\|false}` |
`trace` exposes every MCP call to the UI (a "developer drawer") so judges see real tool use.

## F. Idempotency, decision log and tracing (implemented in B1)
- `check_message`, `place_hold` and `resolve_approval` accept an optional `idempotencyKey` (8–100 chars `[A-Za-z0-9_.:-]`). Same key + same arguments ⇒ the first result is returned with `replayed: true` and nothing new is written (audit event `tool.<name>.replayed`). Same key + different arguments ⇒ `CONFLICT`. Failed calls are not cached. Keys are scoped per tool.
- `check_message` additionally returns `decisionId` and `ruleSetVersion`. Every check writes one row to the append-only `decisions` table (verdict, score, reasons, features, latency, trace id, rule-set version). `decisions` and `audit_events` reject UPDATE/DELETE via triggers.
- Tracing: the server echoes `x-request-id` (valid 8–64 char client value, otherwise a UUID) and stores it as `trace_id` in decisions and audit payloads.

## G. Policy and quorum (implemented in B4b; supersedes the matching parts of §A)
- `check_message` also returns `decision {outcome: allow|require_approval|block, reasons[], reasonText[], quorum}` from the household policy (`policy-and-approvals.md`). The risk `verdict` and the policy `decision` are separate: place a hold when **either** says so (`verdict` hold/caution, or `decision.outcome = require_approval`). A `block` outcome (e.g. daily cap) cannot be held: `place_hold` returns `FORBIDDEN` ("a family member must act in the family console").
- `place_hold` returns `{holdId, status, expiresAt, quorumRequired, reasons}`. TTL = policy `holdTtlMin` (server env `HOLD_TTL_MS` overrides, for tests/ops).
- `resolve_approval` records **one vote**. Output `{holdId, decision, status, resolvedAt|null, votes {approve, deny, required}}`. Quorum 1 or 2 distinct approvers release (`released`); any deny vetoes (`denied`); until then `status` stays `pending`. Repeating the same vote is a no-op; a changed vote or a vote on a finished hold is `CONFLICT`; the elder is `FORBIDDEN`.
- New tools: `get_policy {householdId}` → `{policy, isDefault}`; `set_policy {householdId, requestedBy, patch}` (approver only; strict keys; range-checked; audited with before/after) → `{policy, changed[]}`; `household_insights {householdId, days?}` → `{protectedCents, checksByDay[], holdsByStatus, topSignals[], medianResponseSec}`.
- `list_holds` rows add `reasonText[]`, `quorumRequired`, `votes {approve, deny}`, `escalationLevel`.
- Seed: approvers `p_priya` (rank 1) and `p_arjun` (rank 2); `request_family_approval` defaults to the lowest rank.

## H. Notifications and background jobs (implemented in B4c)
- Tool `list_notifications {householdId, recipientId?, limit?}` (read-only): approver notifications with kind `hold_requested|hold_escalated|hold_resolved`, channel, delivery `status` (queued|sent|failed), attempts and the hold description.
- Every state change writes its notifications in the **same transaction** (transactional outbox), one row per configured channel (`NOTIFY_CHANNELS`, default console,db,email_html). `request_family_approval` notifies the chosen approver; `resolve_approval` announces the final outcome to all approvers; each (hold, recipient, kind) is queued at most once.
- Jobs (`apps/mcp-server/src/jobs`, every `JOBS_INTERVAL_MS`, off in tests): **escalation** (one level per policy `escalateAfterMin`, next approver rank notified exactly once), **expiry** (approvers told once; the hold stays blocked, also when a read expired it first) and **outbox delivery** (retries after 5s, 20s, 80s; failed after the 4th attempt).
- Delivery is simulated: the `email_html` adapter writes escaped HTML to `OUTBOX_DIR/<id>.html`; nothing is sent.

## I. Household tool and dev reset
- Tool `get_household {householdId}` (read-only) -> `{household {id, name}, people [{id, name, role, canApprove, approverRank, contactLabel}]}` for the family circle and approver names.
- `POST /admin/reset` (bearer auth, **only when `ADMIN_ENABLED` is on; default off in production**): drops all tables, re-runs migrations and re-seeds the demo household. Destroys the audit log by design; for demos and tests.

## J. Hold detail
- Tool `get_hold {holdId}` (read-only): `{hold {...status, quorumRequired, escalationLevel, expiresAt, resolvedBy, note}, risk {verdict, score, flags[], reasonText[], text}, votes [{approverId, name, decision, note, decidedAt}], timeline [{type, label, at, by}]}`. The timeline is built from the append-only audit log (paused, family asked, each vote, escalation, decision, expiry).
- Simulator route `GET /api/family/holds/:holdId` (family session) returns it for the console.

## E. Tier 1 additions
**New MCP tools** (approver-only where noted):
| Tool | Input | Output |
|---|---|---|
| `get_policy` | `{householdId}` | `{policy}` (fields in `policy-and-approvals.md` §1) |
| `set_policy` | `{householdId, patch, requestedBy}` (approver only) | `{policy, changed:[field]}`; `INVALID_INPUT` on range errors |
| `household_insights` | `{householdId, days?:int(1–90, default 30)}` | `{protectedCents, checksByDay:[{date,allow,caution,hold}], holdsByStatus, topSignals:[{id,count}], medianResponseSec}` |
`check_message` additionally returns `decision {outcome, reasons[], quorum}` and `layerBreakdown`. `place_hold` stores `quorum_required` and `reasons`; a `block` outcome returns `{blocked:true, reasons}` and no hold. `resolve_approval` returns `{status, votes:{approve,deny,required}}`.
**MCP resources:** `so://playbooks` (list), `so://playbooks/{id}`, `so://household/{id}/summary`. **Prompt:** `guard_instructions` (arg `tone` = gentle|direct).
**Server operations:** `GET /metrics`, `GET /readyz`.
**BFF routes (family console, session cookie required):** `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/family/holds`, `GET /api/family/holds/:id`, `POST /api/family/holds/:id/vote {decision, note?}`, `GET|PUT /api/family/policy`, `GET /api/family/people`, `POST|DELETE /api/family/payees`, `GET /api/family/insights?days=`, `GET /api/family/digest/preview`, `GET /api/family/audit?cursor=`. Merchant demo: `POST /api/merchant/order`, `POST /api/merchant/release`.
**Extra SSE events:** `policy.updated`, `hold.escalated`, `notification.queued`.

## C. Versioning
Unversioned for the hackathon. Post-hackathon: `/v1` prefix for HTTP; MCP tool names are stable, additive changes only.

## D. Example pair (family resolves)
`POST /api/family/resolve {"holdId":"hold_77","decision":"deny","resolvedBy":"p_priya"}` → `200 {"status":"denied"}` + SSE `hold.resolved {holdId, status:"denied"}`.
