# X2 — Policy engine, multi-approver workflow, notifications (Tier 1)

**Goal / done:** configurable household policy, 1- or 2-approver quorum with veto, timed escalation, transactional notification outbox, and the new MCP tools `get_policy`, `set_policy`, `household_insights`.
**Preconditions:** Phase 3 complete; X1 recommended (uses `CheckResult`) but not required.
**Implements:** `policy-and-approvals.md` (all), `api-spec.md` §E, `acceptance-criteria.md` AC-24…AC-29, `data-model.md` migrations 002/003.

## Task breakdown
1. **Migrations**: introduce `packages/store/src/migrate.ts` (`schema_migrations(version, applied_at)`; run files in `migrations/` in order inside a transaction); convert Phase 3 `schema.sql` to `001_init.sql`; add `002_policy_approvals.sql`, `003_notifications.sql` from `policy-and-approvals.md` §4. Test: `migrate twice is a no-op`, `migrates a v1 database forward`.
2. **`packages/policy/src/policy.ts`**: `type Policy`, `defaultPolicy`, `validatePolicy(p): Result` (ranges: `max_single_cents` 1000–5,000,000; `daily_cap_cents` ≥ `max_single_cents`; `quorum` ≤ approvers count; valid IANA tz via `Intl`).
3. **`decision.ts`**: `decide({risk, amountCents, payeeKnown, firstPaymentAt, spentTodayCents, now}, policy): Decision` exactly per matrix; tighten-only invariant enforced by a final `assert` in code and property test P4.
4. **`quorum.ts`**: `tally(votes, quorumRequired): 'pending'|'approved'|'denied'`; veto on any deny; ignores duplicate identical votes; conflicting re-vote ⇒ `CONFLICT`.
5. **`escalation.ts`**: `nextLevel(hold, now, policy): number | null`; pure; the job applies it.
6. **Store repos**: `policies.get/upsert`, `approvals.add/list`, `holds.setEscalation`, `notifications.enqueue/claim/markSent/markFailed` (claim = `UPDATE … RETURNING` within a transaction to avoid double-send).
7. **Tool updates**: `checkMessage.ts` also returns `decision {outcome, reasons, quorum}`; `placeHold.ts` stores `quorum_required`, `reasons_json`, TTL from policy; `block` outcome ⇒ no hold, returns `blocked:true`; `resolveApproval.ts` writes `approvals`, runs `tally`, transitions in one transaction, enqueues `hold_resolved` notifications; new `getPolicy.ts`, `setPolicy.ts` (approver-only; audit before/after), `householdInsights.ts` (protected cents = sum of amounts for holds `denied|expired`; counts by verdict/day; top signals; median response time).
8. **Jobs** (`apps/mcp-server/src/jobs`): `startJobs(deps)` with 15 s interval: `expiry.ts` (expire stale), `escalation.ts` (bump level, enqueue `hold_escalated` to next rank once per level), `outbox` dispatcher. Each job idempotent and also callable lazily by reads; `stopJobs()` on shutdown. Guard against overlapping ticks (`running` flag).
9. **`packages/notify`**: `enqueue`, `dispatch(adapter map)`, adapters `console` (logger + SSE event bus), `db` (no-op marks sent; inbox reads table), `emailHtml` (writes `outbox/<ntf_id>.html` from `templates/hold.ts`; HTML-escape all dynamic text). Backoff 5 s/20 s/80 s, `failed` after 4.
10. **Seed**: second approver `p_arjun` (rank 2), policy with `quorum:1` default; a script flag `--quorum2` for the demo.
11. **Tests** per `policy-and-approvals.md` §7 plus: `T-POL-1 over single limit requires approval`, `T-POL-2 daily cap blocks`, `T-POL-3 cool-off for new payee`, `T-POL-4 quiet hours across midnight in policy tz`, `T-POL-5 policy cannot allow a risk hold`, `T-Q-1 2-of-2 flow`, `T-Q-2 veto`, `T-Q-3 duplicate vote idempotent`, `T-ESC-1 escalates once per level with fake clock`, `T-NTF-1 retry then failed`, `T-NTF-2 enqueue is transactional with state change`, `T-NTF-3 html escaped`.

## Real-world engineering concerns
Outbox pattern (state change + enqueue in one transaction); job idempotency and overlap guards; all time through the injected `Clock`; timezone correctness (DST edge test); `set_policy` audit trail; no PII in notification payloads beyond fictional names.

## Definition of done
- [ ] AC-24…AC-29 tests green; migrations idempotent.
- [ ] Via Inspector: set quorum 2 → first approve leaves `pending`, second distinct approver → `approved`; any deny → `denied`.
- [ ] Unanswered hold escalates at `escalate_after_min` and notifies rank-2 approver once; expires at TTL and stays blocked.
- [ ] `outbox/*.html` rendered for a held request with escaped text.
- [ ] Tool contract snapshots updated and committed.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Time-based jobs make tests flaky | Fake clock + lazy evaluation; no real timers in tests |
| Policy matrix complexity | Table-driven tests; keep matrix exactly as documented |
| Scope creep to real email/SMS | WON'T; outbox HTML only, disclosed as simulated |

## Time budget
8 h. Cut first: `householdInsights` percentiles, `emailHtml` adapter, `PAYEE` cool-off rule.

## Handoff
X3 can assume the new tools, notifications table and insights API. Tag `x2-done`.
