# Observability, quality engineering and packaging (Tier 1)

## Observability
- **Logging:** `pino` JSON logs; `logging.ts` creates a child logger per request with `reqId` (header `x-request-id` or generated), `householdId`, `tool`, `ms`, `isError`. No message text in logs at `info` (privacy); text only at `debug` in dev.
- **Metrics:** `GET /metrics` on mcp-server (Prometheus text format, hand-rolled or `prom-client`): `so_checks_total{verdict}`, `so_holds_total{status}`, `so_policy_outcomes_total{outcome}`, `so_tool_duration_ms` (histogram buckets 5/10/25/50/100/250/500/1000), `so_llm_fallback_total`, `so_outbox_queue_depth`, `so_protected_cents_total`.
- **Health:** `/healthz` (liveness), `/readyz` (DB reachable, migrations at latest version, jobs ticking).
- **Audit:** `audit_events` for every tool call and state change; admin CLI `so export --household hh_demo --format csv`.
- **Tracing (light):** `reqId` propagated from the simulator to the MCP server (`x-request-id`), shown in the trace drawer.

## Test pyramid
| Layer | Tooling | Examples |
|---|---|---|
| Unit | `node:test` + tsx | engine layers, policy decision matrix, quorum, notify retry |
| Property-based | `fast-check` | P1 determinism; P2 adding a positive phrase never lowers score; P3 verdict thresholds consistent with score; P4 policy only tightens; P5 normalisation idempotent; P6 quorum votes order-independent |
| Contract | snapshot tests | `tools/list`, `resources/list`, `prompts/list` match `api-spec.md`; zod schemas shared between server, SDK and web |
| Integration | in-process MCP client↔server | full chains, escalation with fake clock, guard SDK against real server |
| Component | Vitest + Testing Library | `RiskCard`, `VotePanel`, `QuorumMeter`, `PolicyForm` validation |
| E2E | Playwright | hero flow in `/demo`; family approves in console; quorum 2-of-2; MCP down fail-safe banner |
| Eval | `eval/run.ts` | accuracy + ablation on bench dev/test |
| Load | `autocannon` via `scripts/load-test.mjs` | `check_message` p95 < 50 ms at 50 rps on a laptop; report in `docs/perf.md` (T2) |
| Security | `npm audit --omit=dev`, gitleaks, CodeQL, XSS payload tests | CI fails on high severity |

## CI (`.github/workflows/ci.yml`)
Jobs: `typecheck+lint` → `unit+property` → `integration` → `eval (cache-only, dev)` → `e2e (Playwright, headless)` → `audit+gitleaks` → `docker build`. Node 22, npm cache, artifacts: Playwright traces, `eval/results/latest.md`. Required before merging to `main`.

## Code quality
ESLint (`@typescript-eslint`, strict), Prettier, `tsc --noEmit` strict, no `any` in packages (lint rule), 80% line coverage target on `engine` and `policy` (c8), conventional commits.

## Packaging & running
- `infra/docker/Dockerfile.mcp` and `Dockerfile.sim` (multi-stage, non-root user, `HEALTHCHECK`), `docker-compose.yml` with volumes for `data/` and `outbox/`; `docker compose up` ⇒ same demo as `npm run demo`.
- Environment validated at startup (zod); app refuses to start with a weak `MCP_AUTH_TOKEN` when `NODE_ENV=production`.
- Backups: SQLite file copy via `so export`; documented only.

## Resilience
Graceful shutdown (drain in-flight, stop jobs); DB `busy_timeout`; outbox retries; all external calls (Bedrock) bounded by timeout + fallback; jobs are idempotent.
