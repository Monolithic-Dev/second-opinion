# Phase 1 — Foundation and scaffolding

## Plan at a glance (14 days: Oct 9 → submit Oct 22; ~45 focused hours total)
| # | Phase | Goal | Budget | When |
|---|---|---|---|---|
| 1 | Foundation and scaffolding | Repo installs, typechecks, serves a hello MCP tool on Streamable HTTP, CI green | 2.5 h (6%) | Oct 9 |
| 2 | Risk engine | Pure, deterministic, tested engine: signals → score → verdict → fingerprint → explanation | 4 h (9%) | Oct 9 |
| 3 | State and MCP tools | SQLite store + six MCP tools per `api-spec.md`, fully tested through a real MCP client | 5 h (11%) | Oct 9–10 |
| 4 | Simulator (4A agent/API, 4B UI) | Click a scenario → hold-and-approve visible in elder + family panes | 8 h (18%) | Oct 10–11 |
| 5 | Evaluation and benchmark | 60 scripts, dev/test split, scorer, results table, optional Bedrock variant | 9 h (20%) | Oct 11–15 |
| 6 | Polish, Agent Skill, video, submit | Skill, README, video, product feedback, friction log, freeze Oct 21, submit Oct 22 | 16 h (36%) | Oct 15–22 |

Assumptions: 3 people (A backend/MCP, B frontend/simulator, C data/QA/docs); one person may wear all hats. Deadline Oct 23 12:00 PM PT; Oct 23 is buffer only. Mandatory tech: MCP spec 2025-11-25+ over Streamable HTTP (`rules-digest.md`).

---

**Goal / done:** a monorepo that installs, typechecks, runs the MCP server on port 3001, answers a `ping` tool through MCP Inspector with bearer auth, and passes CI.
**Preconditions:** repos cloned (done); Node 22 + npm 10 (verified on this machine); GitHub access to `Monolithic-Dev/second-opinion`.
**Implements:** `project-structure.md` (layout, naming), `architecture.md` §1–2, `api-spec.md` §A (transport, health, auth), `deployment.md` (env, CI).

## Task breakdown
1. **Root workspace files**
   - `package.json`: `"private": true`, `"workspaces": ["apps/*"]`, `"type": "module"`, `engines.node ">=22"`; scripts: `dev` (`npm -w apps/mcp-server run dev`), `demo` (`tsx scripts/demo.ts`, stub for now), `test` (`npm -ws --if-present run test`), `typecheck` (`npm -ws --if-present run typecheck`), `eval` (`tsx eval/run.ts`, stub).
   - `tsconfig.base.json`: `strict`, `target ES2022`, `module NodeNext`, `moduleResolution NodeNext`, `noUncheckedIndexedAccess`, `skipLibCheck`.
   - Already present: `.gitignore`, `.env.example`, `LICENSE`, `README.md`.
2. **`apps/mcp-server` package**: `package.json` (deps `@modelcontextprotocol/sdk`, `express`, `zod`, `better-sqlite3`; dev `tsx`, `typescript`, `@types/node`, `@types/express`, `@types/better-sqlite3`); scripts `dev` (`tsx watch src/index.ts`), `test` (`node --import tsx --test test/**/*.test.ts`), `typecheck` (`tsc --noEmit`). `tsconfig.json` extends base.
3. **`src/config.ts`**: `loadConfig(env = process.env)` returns `{port, authToken, dbPath}` parsed with `zod` (defaults from `.env.example`); throws a readable error on invalid values. *Validation:* port integer 1–65535.
4. **`src/index.ts`**: `createApp(deps)` → express app with `express.json({limit:'100kb'})`; `authMiddleware(token)` (401 JSON `{error:"unauthorized"}` unless `Authorization: Bearer <token>` matches, constant-time compare via `crypto.timingSafeEqual`); `GET /healthz` (no auth) returns `{ok:true, version}`; `POST /mcp` creates a **fresh** `McpServer` and `StreamableHTTPServerTransport({sessionIdGenerator: undefined})` per request, `res.on('close')` closes both, `await server.connect(transport)`, `await transport.handleRequest(req,res,req.body)`; `GET /mcp` and `DELETE /mcp` return 405 JSON (stateless server). Catch errors → JSON-RPC error `-32603`, never leak stack traces. Listen only when run as entrypoint (`import.meta.url` check) so tests can import `createApp`.
5. **`src/server.ts`**: `buildServer(deps): McpServer` registering a temporary `ping` tool (no input; returns `{ok:true}`) — replaced in Phase 3.
6. **`test/smoke.test.ts`** (named cases): `healthz returns ok`, `mcp without token returns 401`, `mcp with token lists ping`, `ping call returns ok` (use SDK `Client` + `StreamableHTTPClientTransport` against an ephemeral port).
7. **CI**: `.github/workflows/ci.yml` — trigger on push/PR; `actions/setup-node@v4` node 22 with npm cache; `npm ci`; `npm run typecheck`; `npm test`. No secrets.
8. **Manual verification**: `npx @modelcontextprotocol/inspector` → Streamable HTTP → `http://localhost:3001/mcp`, header `Authorization: Bearer dev-token`; list tools; call `ping`. Record SDK version and negotiated protocol version in `docs/decisions.md` (D9). **Must be ≥ 2025-11-25**; if the SDK negotiates older, upgrade the SDK or log friction (`friction-log.md` FL-1) and note the workaround.
9. Start `docs/friction-log.md` entries immediately for anything slow (SDK/spec mismatch, Inspector auth).

## Real-world engineering concerns
- **Statelessness:** per-request server+transport avoids session leaks and makes tests independent; document in `architecture.md` if changed.
- **Body size and auth before parsing tools** to limit abuse; log request id (`crypto.randomUUID()`) on every request.
- **Graceful shutdown:** `SIGINT/SIGTERM` closes the HTTP server.

## Definition of done
- [ ] `npm install` from a clean clone succeeds; `npm run typecheck` and `npm test` pass locally and in CI.
- [ ] `curl -i localhost:3001/healthz` → 200 `{"ok":true,...}`; `curl -i -X POST localhost:3001/mcp` without token → 401.
- [ ] Inspector lists and calls `ping` successfully with the bearer token.
- [ ] Protocol version ≥ 2025-11-25 recorded in `decisions.md`.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| SDK doesn't yet speak 2025-11-25 | Check SDK release notes/`npm view @modelcontextprotocol/sdk versions`; upgrade; log friction; if still blocked ask in Discord |
| `better-sqlite3` native build fails on Windows | Use Node 22 prebuilt binaries; fall back to `node:sqlite` (built-in) — decide now, log in `decisions.md` |
| Inspector can't send auth header | Test with curl/SDK client; log friction |

## Time budget
2.5 h (6%). Cut first: CI polish, graceful shutdown.

## Handoff
Phase 2 can assume: workspace builds, tests run with `npm test`, `apps/mcp-server/src/engine/` is free to create. Tag: `git tag phase-1-done` (commit `chore: scaffold monorepo and hello MCP tool`).
