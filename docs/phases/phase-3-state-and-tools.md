# Phase 3 — State layer and MCP tools

**Goal / done:** SQLite persistence plus the six MCP tools (`check_message`, `place_hold`, `request_family_approval`, `resolve_approval`, `trusted_payees`, `list_holds`) behaving exactly as `api-spec.md` §A, verified through a real in-process MCP client.
**Preconditions:** Phases 1–2 complete.
**Implements:** `data-model.md` (all), `api-spec.md` §A, `prd.md` FR-1, FR-3 (server side), FR-4, FR-6, FR-8, FR-11; `edge-cases.md` #8–11, #16, #19; `security-privacy.md` AuthZ.

## Task breakdown
1. **`store/schema.sql`** — copy from `data-model.md` verbatim (CREATE TABLE IF NOT EXISTS).
2. **`store/db.ts`** — `openDb(path: string): Database` (`better-sqlite3`; `:memory:` allowed; `PRAGMA journal_mode=WAL; foreign_keys=ON; busy_timeout=3000`), `applySchema(db)`; `type Clock = () => Date`, `systemClock`.
3. **`store/ids.ts`** — `newId(prefix: 'hh'|'p'|'chk'|'hold'|'pay'|'evt'): string` (`prefix_` + 10 chars from `crypto.randomBytes`).
4. **`store/repos.ts`** — `createRepos(db, clock)` returning:
   - `households.get(id)`, `people.get(id)`, `people.listApprovers(householdId)`;
   - `payees.list(hh)`, `payees.add(hh,name,kind)` (normalise lowercase/collapse spaces, `UNIQUE` → idempotent), `payees.remove(hh,name)`;
   - `checks.insert(row)`, `checks.history(hh, limit=200): HistoryItem[]` (joins latest hold id);
   - `fingerprints.upsert(hh, fp, checkId)`;
   - `holds.create`, `holds.get`, `holds.listByStatus(hh,status?)`, `holds.resolve(id, decision, by, note)` (single transaction: re-read row, check `pending` and not expired, update, audit);
   - `holds.expireStale(hh)` called at the start of every list/get (lazy expiry, `expires_at < now` ⇒ `expired`);
   - `audit.write(type, hh, payload)`.
5. **`store/seed.ts`** — `seedDemo(db, clock)`: `hh_demo`; `p_dorothy` (elder), `p_priya` (family, `can_approve=1`); payees `greenleaf pharmacy`, `city power & light`; one resolved past hold "Tuesday" (denied gift-card check with its check + fingerprint) so the replay shows `similarTo`. `scripts/seed.ts` and `scripts/reset.ts` (delete DB file then seed; idempotent).
6. **`tools/errors.ts`** — `class ToolError extends Error {code: 'INVALID_INPUT'|'NOT_FOUND'|'FORBIDDEN'|'CONFLICT'|'INTERNAL'}`; `ok(structured, text)` and `fail(err)` helpers producing MCP results (`isError: true` for failures; unexpected errors become `INTERNAL` with a generic message, details logged server-side only).
7. **Tools** (one file each, `registerX(server, deps)` with `zod` input schemas):
   - `tools/checkMessage.ts` → loads trusted payees + history, calls `evaluate()`, inserts check, upserts fingerprint, audits, returns the `api-spec` payload (incl. `similarTo`, `card`). Maps `RangeError` → `INVALID_INPUT`; unknown household → `NOT_FOUND`.
   - `tools/placeHold.ts` → rejects `allow` verdicts (`INVALID_INPUT`), one open hold per check (`CONFLICT`), `expires_at = now + HOLD_TTL_MS` (10 min; env `HOLD_TTL_MS` for tests).
   - `tools/requestFamilyApproval.ts` → defaults to first approver; non-approver → `FORBIDDEN`; writes `approval.requested` audit (this is the simulated notification).
   - `tools/resolveApproval.ts` → resolver must be `can_approve` and not the elder; `approve` ⇒ `approved` then `released`; double resolve/expired ⇒ `CONFLICT`.
   - `tools/trustedPayees.ts` → `list|add|remove`; add/remove require `requestedBy` approver.
   - `tools/listHolds.ts` → filter by status; returns flags from the linked check's signals.
8. **`server.ts`** — replace `ping` with `registerAll(server, deps)`; `deps = {repos, clock, config}`. Remove `ping` test; update `smoke.test.ts` to list the six tool names.
9. **Tests**
   - `store.test.ts` (in-memory DB): `schema applies twice without error`, `payee names normalised and unique`, `lazy expiry flips pending to expired`, `resolve is atomic under double call`, `foreign keys enforced`.
   - `tools.test.ts` (real SDK Client ↔ server via in-memory/ephemeral HTTP): `T-TOOL-1 check→hold→request→deny full chain`, `T-TOOL-2 allow verdict cannot be held`, `T-TOOL-3 similarTo returned on repeat`, `T-TOOL-4 trusted payee lowers score but gift card still holds`, `T-TOOL-5 two concurrent holds independent`, `T-TOOL-6 double resolve returns CONFLICT`, `T-TOOL-7 elder cannot approve own hold (FORBIDDEN)`, `T-TOOL-8 expired hold stays blocked`, `T-TOOL-9 trusted_payees add requires approver`, `T-TOOL-10 oversized text → INVALID_INPUT`, `T-TOOL-11 audit row per call`, `T-SEC-1 SQL/HTML text stored verbatim`.

## Real-world engineering concerns
- **Concurrency:** double-tap/duplicate resolve handled in one SQLite transaction with a status guard; WAL + busy timeout for the single writer.
- **Time:** all expiry logic uses the injected `Clock`; tests use a fake clock (edge-case #19).
- **Idempotency:** `payees.add` and `reset` safe to repeat.
- **Fail-safe:** any exception in a tool leaves state consistent and returns `INTERNAL`; nothing is ever auto-released.
- **Observability:** one structured log line per call `{reqId, tool, householdId, ms, isError}`; `audit_events` for state changes.
- **Input:** `zod` `.trim().min(1).max(2000)` for text; ids matched `^[a-z]+_[A-Za-z0-9_]+$`; parameterised SQL only.

## Definition of done
- [ ] `npm test` green with all T-TOOL and T-STORE cases.
- [ ] Through Inspector: the full chain works and `list_holds` shows statuses `pending → denied`.
- [ ] `resolve_approval` by `p_dorothy` returns `isError` with `FORBIDDEN`; second resolve returns `CONFLICT`.
- [ ] `scripts/reset.ts` can be run 3× in a row, leaving identical seed state.
- [ ] Tool argument and result field names match `api-spec.md` exactly (spot-check with a schema test that snapshot-compares `tools/list`).

## Risks and blockers
| Risk | Mitigation |
|---|---|
| `better-sqlite3` native install pain | Pre-decided fallback in Phase 1: `node:sqlite` |
| Contract drift vs `api-spec.md` | Snapshot test of tool names + input schemas; update the doc if the code must change |
| Streamable HTTP + SDK quirks | Keep per-request server; log friction |

## Time budget
5 h (11%). Cut first: `list_holds` status filter polish, extra audit event types, seed "Tuesday" history (then demo "same as" is skipped until Phase 6).

## Handoff
Phase 4 can assume: a running MCP server on :3001 with seeded `hh_demo`, six stable tools, error codes, and `scripts/reset.ts`. Tag `phase-3-done` (commit `feat(server): sqlite store and MCP tools`).
