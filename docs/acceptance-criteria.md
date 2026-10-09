# Acceptance criteria (EARS)

Format: `WHEN <trigger>, the <system> SHALL <response>` · `IF <condition>, THEN the <system> SHALL …` · `WHILE <state>, …`. Each has a test id. A feature is done when its criteria pass.

## Tier 0
| ID | Criterion | Test |
|---|---|---|
| AC-1 | WHEN `check_message` receives text containing a gift-card request plus any other positive signal, the engine SHALL return verdict `hold`. | T-ENG-1, T-ENG-6 |
| AC-2 | WHEN the same input is evaluated twice with the same context and history, the engine SHALL return identical results. | T-ENG-10 |
| AC-3 | IF the text is empty or longer than 2000 characters, THEN `check_message` SHALL return `INVALID_INPUT` and SHALL NOT write a check row. | T-INP-1, T-INP-2 |
| AC-4 | WHEN `place_hold` is called for a check whose verdict is `allow`, the server SHALL return `INVALID_INPUT`. | T-TOOL-2 |
| AC-5 | WHEN a hold is `pending` and its `expires_at` has passed, the server SHALL set it `expired` on next read and SHALL NOT execute the action. | T-TOOL-8 |
| AC-6 | IF the resolver is the elder or lacks `can_approve`, THEN `resolve_approval` SHALL return `FORBIDDEN`. | T-TOOL-7 |
| AC-7 | WHEN `resolve_approval` is called twice for the same hold, the second call SHALL return `CONFLICT`. | T-TOOL-6 |
| AC-8 | WHEN a new check's signal set has Jaccard ≥ 0.75 with an earlier one in the household, `check_message` SHALL return `similarTo` with that check's id and date. | T-TOOL-3, T-ENG-9 |
| AC-9 | IF a trusted payee matches, THEN the engine SHALL subtract 40 from the score AND SHALL NOT override a hard rule. | T-ENG-6, T-TOOL-4 |
| AC-10 | WHEN the MCP server is unreachable, the simulator SHALL reply that it could not verify the request AND SHALL NOT execute it. | T-SIM-1 |
| AC-11 | WHEN a request lacks a valid bearer token, the MCP server SHALL respond 401. | smoke test |
| AC-12 | WHEN a hold is created, resolved or expired, the server SHALL write an `audit_events` row. | T-TOOL-11 |
| AC-13 | WHEN the family resolves a hold, the elder pane SHALL show the outcome within 1 s via SSE. | T-SIM-3 + manual QA |
| AC-14 | WHEN `npm run demo` is executed on a clean clone, both services SHALL start and `/healthz` SHALL report `mcp:true` within 60 s. | manual QA |
| AC-15 | WHEN `eval` runs the `test` split a second time without `--force`, the runner SHALL refuse. | eval test |

## Tier 1
| ID | Criterion | Test |
|---|---|---|
| AC-20 | WHILE the layered pipeline runs, adding a positive phrase SHALL NOT lower the score (monotonicity). | property P2 |
| AC-21 | WHEN playbook similarity ≥ 0.5, the engine SHALL add `PLAYBOOK_MATCH` with weight `round(30 × similarity)` capped at 30. | x1 tests |
| AC-22 | WHEN an amount exceeds `mean + 3σ` of the last 10 payments (min 5 payments) and ≥ $200, the engine SHALL add `AMOUNT_ANOMALY`. | x1 tests |
| AC-23 | WHEN a request repeats a denied hold's fingerprint within 24 h, the engine SHALL add `RETRY_AFTER_DENY`. | x1 tests |
| AC-24 | WHEN daily spend would exceed `daily_cap_cents`, the policy engine SHALL return outcome `block`. | policy tests |
| AC-25 | The policy engine SHALL NOT convert a risk `hold` into `allow`. | property P4 |
| AC-26 | WHEN `quorum` is 2, the hold SHALL remain `pending` after one approve AND SHALL become `approved` after the second distinct approver. | quorum tests |
| AC-27 | WHEN any approver denies, the hold SHALL become `denied` regardless of other votes. | quorum tests |
| AC-28 | WHEN a hold is pending for `escalate_after_min`, the system SHALL notify the next approver rank exactly once per level. | escalation tests |
| AC-29 | IF a notification delivery fails, THEN the dispatcher SHALL retry with backoff up to 4 attempts, then mark `failed`. | outbox tests |
| AC-30 | WHEN a guarded tool's hold is not approved, the Guard SDK SHALL NOT run the wrapped handler. | guard tests |
| AC-31 | IF the guard is unreachable and `failMode` is `closed`, THEN the SDK SHALL NOT run the handler. | guard tests |
| AC-32 | WHEN `tools/list`, `resources/list` or `prompts/list` is called, the response SHALL match the committed contract snapshot. | contract tests |
| AC-33 | WHEN the family console loads `/family`, it SHALL show the protected-dollars total equal to the sum of denied+expired held amounts. | component + E2E |
| AC-34 | `/metrics` SHALL expose `so_checks_total{verdict}` and tool latency histograms. | integration test |
| AC-35 | WHEN `check_message` is load-tested at 50 rps, p95 latency SHALL be < 50 ms (rules+playbooks+behavior). | load script (T2) |
