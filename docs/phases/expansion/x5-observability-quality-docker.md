# X5 — Observability, quality engineering, Docker (Tier 1)

**Goal / done:** structured logs, `/metrics`, `/readyz`, property + contract + E2E + load tests, CI with security scans, and `docker compose up` reproducing the demo.
**Preconditions:** Phases 1–4 done; X1–X3 mostly done (E2E needs the web app).
**Implements:** `observability-and-quality.md` (all), `deployment.md`, AC-32, AC-34, AC-35.

## Task breakdown
1. **Logging**: `apps/*/src/logging.ts` with `pino`; request-id middleware (`x-request-id` in/out, propagated simulator → MCP server); log fields `{reqId, tool, householdId, ms, isError}`; redact message text at `info`.
2. **Metrics**: `apps/mcp-server/src/metrics.ts` — counters/histogram implemented in ~60 lines (no dependency) or `prom-client`; `GET /metrics` (token-protected unless `METRICS_PUBLIC=1`); instrument tool wrapper once (not per tool). Metrics listed in the doc.
3. **Health**: `/readyz` (DB `SELECT 1`, migration version = latest, jobs heartbeat < 60 s).
4. **Contract tests**: snapshot `tools/list`, `resources/list`, `prompts/list` into `apps/mcp-server/test/__snapshots__/contract.json`; failing diff forces doc update (AC-32).
5. **Property tests** (`fast-check`): add P6 (vote order independence) to those from X1/X2; run in CI with fixed seed + one random-seed job.
6. **MCP resources and prompt**: `resources/playbooks.ts` (`so://playbooks`, `so://playbooks/{id}`), `resources/householdSummary.ts` (`so://household/{id}/summary`), `prompts/guardInstructions.ts` (`guard_instructions`, arg `tone` ∈ gentle|direct) returning the SKILL.md rules; tests list + read each.
7. **E2E (Playwright)** `e2e/`: `hero-flow.spec.ts` (scenario → held → family deny → elder message), `quorum.spec.ts` (2-of-2), `failsafe.spec.ts` (stop MCP → fail-safe banner and no order), `a11y.spec.ts` (axe on `/demo`, `/family`), `xss.spec.ts`. Config uses `webServer: npm run demo`; traces on failure uploaded as CI artifact.
8. **Load test**: `scripts/load-test.mjs` using `autocannon` against `POST /mcp` `check_message` with 50 connections for 30 s; print p50/p95/p99; write `docs/perf.md`. Target p95 < 50 ms (AC-35).
9. **CI** (`.github/workflows/ci.yml`): jobs `typecheck-lint` → `unit-property` → `integration` → `eval-cache` → `e2e` → `audit-secrets` (`npm audit --omit=dev --audit-level=high`, `gitleaks/gitleaks-action`) → `docker-build`; `codeql.yml` and `dependabot.yml` added. Required status checks on `main` (GitHub setting, documented).
10. **Docker**: `infra/docker/Dockerfile.mcp` and `Dockerfile.sim` (multi-stage, `node:22-slim`, non-root, `HEALTHCHECK`), `docker-compose.yml` (services `mcp`, `sim`, `freshmart`; volumes `./data`, `./outbox`; env from `.env`); verify `docker compose up --build` ⇒ `http://localhost:3000/demo` works.
11. **Production guards**: startup validation refuses weak/default `MCP_AUTH_TOKEN` and default `SESSION_SECRET` when `NODE_ENV=production`; graceful shutdown (stop jobs, close server, close DB).
12. **Lint/format**: ESLint (`@typescript-eslint` strict, `no-explicit-any` error in `packages/*`), Prettier, `.editorconfig`, `npm run lint`.

## Real-world engineering concerns
Flaky E2E ⇒ use deterministic scenario buttons and fixed seed/clock endpoint (`POST /api/dev/clock` only when `NODE_ENV=test`); metrics cardinality kept low (no householdId label); log volume bounded.

## Definition of done
- [ ] `curl -H 'Authorization: Bearer dev-token' localhost:3001/metrics` shows `so_checks_total{verdict="hold"}` after a demo run; `/readyz` 200.
- [ ] CI is green on a PR: all jobs pass, Playwright report attached.
- [ ] `docker compose up --build` on a clean machine serves `/demo` and the hero flow passes E2E against it.
- [ ] `docs/perf.md` records load-test numbers (whatever they are).
- [ ] Contract snapshots match `api-spec.md` §A/§E.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Windows Docker/Playwright setup time | Do E2E/Docker verification in GitHub Actions first; local only if time |
| CI time balloons | Cache npm and Playwright browsers; run E2E only on `main` + PRs touching apps |
| Scope creep to tracing/Grafana | WON'T |

## Time budget
8 h. Cut first: load test report, CodeQL, Dependabot, lint strictness, Docker.

## Handoff
Feature freeze (**G3, Oct 19**) follows. Phase 6 builds on a green CI. Tag `x5-done`.
