# Decision log (ADR-lite)

| # | Date | Decision | Why | Revisit if |
|---|---|---|---|---|
| D1 | 2026-10-09 | Build **Second Opinion** (P7) on Alexa+ | Best score (78) vs Resilience Copilot (74); no hardware; fits "creative" examples | Alexa+ path proves untestable AND simulated path is judged weak |
| D2 | 2026-10-09 | Hook the guard into pay/buy requests, not call interception | Alexa+ can't hear phone calls; this makes the gate unavoidable in-flow | Amazon docs show different purchase routing |
| D3 | 2026-10-09 | Rules decide, AI phrases/suggests only | Deterministic demo, measurable, free-tier safe | Eval shows rules plateau far below target |
| D4 | 2026-10-09 | TypeScript monorepo, Node 22, SQLite | One toolchain, offline demo | Hosted deploy needs managed DB |
| D5 | 2026-10-09 | Real MCP server + Agent Skill + simulator client | Covers both permitted paths | — |
| D6 | 2026-10-09 | Two repos: product + `scam-script-bench` | Open Source mini challenge; keeps held-out test separate | Organizers say dataset repo doesn't count |
| D7 | 2026-10-09 | Local-first distribution; AWS optional | Free tier only; credits gone Oct 7 | Time remains after P6 |
| D8 | 2026-10-09 | dev/test split, different authors, test frozen | Avoid inflated accuracy | — |
| D9 | _(Phase 1)_ | Record MCP SDK version + negotiated protocol version (must be ≥ 2025-11-25); decide `better-sqlite3` vs built-in `node:sqlite` | Mandatory-tech rule; Windows native-build risk | SDK can't negotiate required version |
| D11 | 2026-10-09 | Expand into a tiered platform (Tier 0 core, Tier 1 depth, Tier 2 stretch) with hard gates G1–G3 | Team wants a large working product; tiers protect the demo | G1 missed or team < 3 people |
| D12 | 2026-10-09 | Monorepo with `packages/*` (shared, engine, policy, store, notify, guard-sdk) and `apps/*` (mcp-server, simulator, web, admin-cli) | Clear boundaries, reusable SDK/engine | — |
| D13 | 2026-10-09 | Adopt agent-friendly spec conventions (AGENTS.md, EARS acceptance criteria, spec→plan→tasks) | Research in `spec-conventions.md` | — |
| D14 | 2026-10-09 | Use `@modelcontextprotocol/sdk` **1.32.1** (v1 line), stateless Streamable HTTP, JSON responses; defer v2 split packages | v2 targets the 2026-07-28 protocol with different handshake; v1 is mature, widely documented, and supports 2025-11-25 (verify in T-PROTO-1) | v1 doesn't negotiate ≥ 2025-11-25, or Alexa+ requires modern era |
| D15 | 2026-10-09 | Commits authored as the repo owner's git identity (`im-rk`) with **no Claude co-author trailer** | User instruction | User says otherwise |
| D10 | _(Phase 6)_ | Record Alexa+ Agent Skill packaging findings | Docs unverified so far | Docs differ from SKILL.md plan |

Log later changes below with date and impact on other docs.

## Implementation log
| Date | Change |
|---|---|
| 2026-10-09 | Phases 1-3 shipped as PRs #1-#4 (scaffold+shared, engine, store, MCP server). MCP SDK 1.32.1 verified: negotiates `2025-11-25`; invalid tool input already returns `isError` results. |
| 2026-10-09 | `resolve_approval` is not idempotent (second call is `CONFLICT`); approve ends in status `released`. Rate-limit default is 600 requests/min. |

| 2026-10-09 | D16: adopt the production decisioning patterns in `backend-architecture.md` (versioned rule sets, append-only decision log, idempotency keys, shadow/backtest, outbox, hexagonal layering). Build order B1 -> B2 -> B4 -> simulator -> B3 -> B5 -> B6. |

| 2026-10-09 | D17: published `rules-2026.10.3` (new rule pack v2 + playbook pack p2), tuned on the benchmark **dev** split only. Old versions stay byte-for-byte reproducible (golden test). Held-out test split scored once: 46.7% held / 80.0% flagged / 0% false holds, versus 86.7% held on dev. Reported as is in `docs/eval-report.md`; the test split is now frozen and must not be tuned on. |
| 2026-10-09 | D18: CI checks out `scam-script-bench` pinned to commit `c2f7b1c` and runs a regression gate (dev recall at hold >= 80%, false holds <= 10%, each layer must beat the previous one). |
| 2026-10-09 | D19: published `rules-2026.10.4` (rule pack v3, playbook pack p3, new signal `ADVANCE_FEE`, hard rule `ADVANCE_FEE_PLUS_PRESSURE`). Rule sets 10.1-10.3 are frozen by golden tests. Before changing the detector we wrote bench split `test2` (40 scripts) and scored 10.1-10.3 on it; 10.4 was scored once. Caveat recorded in `eval-report.md`: the same author wrote test2 and the v4 rules, so the 95% is not a generalisation claim. |
| 2026-10-09 | D20: replaced `better-sqlite3` with Node's built-in `node:sqlite` (Node >= 22.13, thin `Db` wrapper in `packages/store/src/db.ts`). Reason: a clean `npm install` on Windows tried to compile the native module and failed without Visual Studio; judges must be able to run `npm install && npm run demo`. Resolves D9. Cost: Node prints an ExperimentalWarning for `node:sqlite` on 22.x. |
