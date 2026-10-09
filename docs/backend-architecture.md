# Backend architecture (production-grade blueprint)

Researched Oct 9 2026 from practitioner write-ups on fraud/risk decisioning and payment services: [Grab Griffin rules engine](https://engineering.grab.com/griffin), [DoorDash real-time rules engine](https://careersatdoordash.com/blog/doordash-fraud-insights-from-building-a-real-time-rules-engine/), [explainable decisioning demo with shadow mode and append-only events](https://github.com/nchekotko/fraud-rules-engine), [versioned rules + idempotent decisions demo](https://github.com/katlego95/fraud-rule-engine-service), [payment audit trails](https://devskills.substack.com/p/building-comprehensive-audit-trails), [resilient payment flows](https://dev.to/mtahir27/fintech-architecture-building-resilient-payment-flows-reconciliation-and-audit-trails-48kn), [transactional outbox](https://oneuptime.com/blog/post/2026-01-30-outbox-pattern-implementation/markdown), hexagonal layering in Node. Many sources are vendor or demo material; patterns, not numbers, are taken from them.

## 1. What a senior-level decision backend has that ours lacked
| Pattern | Why it matters | Our plan |
|---|---|---|
| **Versioned rule sets**; every decision pinned to the rule-set version that produced it | Old verdicts stay explainable after rules change | `RULESET_VERSION`, `decisions.rule_set_version`, rule registry (B2) |
| **Append-only decision + audit log** (DB triggers block UPDATE/DELETE) | Tamper-evident audit trail | `decisions`, `audit_events` triggers (B1) |
| **Idempotency keys** on mutating operations; replay returns the stored result | Safe retries, double-tap safety, replay-attack signal | `idempotencyKey` on mutating tools (B1) |
| **Shadow mode + backtesting** before promoting a rule | Measure fire rate / FP impact without affecting users | `so backtest`, shadow rule set evaluated beside live (B3) |
| **Hybrid decisioning**: decisive rules vs contributory (weighted) rules; most severe wins | Clear semantics, test-guarded bands | formalise hard rules vs weights (B2) |
| **Feature windows** (velocity, payee history) computed from the event store | Behavior signals (anomaly, velocity) | behavior layer + `features` snapshot stored with each decision (B2) |
| **Transactional outbox** for notifications/events; at-least-once, idempotent consumers | No lost or duplicated family notifications | `outbox`, relay job (B4) |
| **Hexagonal layering** (domain / application / infrastructure, composition root) | Testable core, swappable adapters | use cases + ports in `apps/mcp-server` (B5) |
| **Policy engine + quorum + escalation** | Real-world approval workflows | `packages/policy` (B4) |
| **Observability**: trace id on every record, metrics, SLO | Operability | request/trace ids, `/metrics` (B6) |
| **Operational tooling**: CLI for export, replay, backtest, rule diff | Day-2 operations | `apps/admin-cli` (B3, B6) |

## 2. Layering inside the server (target)
```
apps/mcp-server/src/
  main/            composition root (wires adapters to use cases), config, shutdown
  transport/       http (express app, guards), mcp (server factory, tool/resource/prompt registration)
  application/
    usecases/      CheckMessage, PlaceHold, RequestApproval, ResolveApproval, ManagePayees, ListHolds,
                   GetPolicy, SetPolicy, GetInsights, ReplayDecision, BacktestRuleSet
    ports/         DecisionRepo, HoldRepo, AuditLog, IdempotencyStore, Outbox, Clock, RuleSetProvider, Notifier
    services/      IdempotencyService, DecisionService, ApprovalWorkflow, PolicyService
  infrastructure/  sqlite repos, outbox relay, notification adapters, metrics, logging
packages/
  domain/          Hold aggregate (state machine + invariants), Money, Decision, Policy value objects
  engine/          layers: rules, playbooks, behavior, llm; fusion; rule registry; backtest/shadow runner
  policy/          decide(), quorum, escalation
  store/           migrations + repos (adapter implementation)
  notify/          outbox, adapters
```
Dependency rule: `domain` → nothing; `application` → `domain` + ports; `infrastructure` → `application` (implements ports); `transport` → `application`. Tool handlers become thin: validate → use case → map errors.

## 3. Data model additions
- `decisions` (append-only): `id, household_id, check_id, trace_id, rule_set_version, verdict, score, reasons_json, features_json, latency_ms, created_at`.
- `idempotency_keys`: `(tool, key)` PK, `household_id, request_hash, response_json, created_at`; same key + same args ⇒ stored response with `replayed:true`; same key + different args ⇒ `CONFLICT`.
- `domain_events` (append-only, event log): `id, aggregate_type, aggregate_id, type, payload_json, trace_id, created_at` — source for insights projections.
- `outbox`: transactional queue for notifications (see `policy-and-approvals.md`).
- Triggers: `BEFORE UPDATE/DELETE ... RAISE(ABORT)` on `audit_events`, `decisions`, `domain_events`.

## 4. Build phases (each is a feature branch + PR)
| ID | PR | Contents | Size |
|---|---|---|---|
| **B1** | `feat(store,server): decision log + idempotency` | migration 002; append-only triggers; `decisions` + `idempotency_keys` repos; `idempotencyKey` on mutating tools; `ruleSetVersion` on results; tests | M |
| **B2** | `feat(engine): layered detection + rule registry` | `layers/{rules,playbooks,behavior,fusion}`, ~20 playbooks, feature windows, rule registry with versions, decisive vs contributory semantics, property tests | L |
| **B3** | `feat(engine,cli): shadow rules + backtest` | shadow rule set evaluated beside live, `so backtest` against bench/history, fire-rate/overlap report | M |
| **B4** | `feat(policy,notify): policy, quorum, escalation, outbox` | `packages/policy`, `packages/notify`, jobs, migrations 003–004, tools `get_policy`/`set_policy`/`household_insights` | L |
| **B5** | `refactor(server): hexagonal use cases and ports` | move logic out of tool handlers into use cases; domain Hold aggregate; composition root | M |
| **B6** | `feat(server): observability and ops` | trace ids end-to-end, `/metrics`, `/readyz`, admin CLI (export, replay, rule diff), Docker | M |
Then Tier 1 product surface: simulator (Phase 4), web app/Family Console (X3), Guard SDK (X4).

## 5. Invariants to test (property/contract)
Determinism; monotonicity (adding a positive phrase never lowers score); policy only tightens; decisions append-only; idempotent replay returns byte-identical result and creates no rows; every decision stores the rule-set version and can be re-derived from stored features (`ReplayDecision`).

## 6. Honest scope note
This architecture is sized for what 3 people can finish by Oct 19 (G3). Order is B1 → B2 → B4 → (simulator) → B3 → B5 → B6. Cut from the end.
