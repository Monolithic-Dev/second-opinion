# Testing

**Runner:** Node's built-in `node:test` via `tsx` (no framework to learn). Command: `npm test`. CI runs typecheck + tests + dev-split eval from cache.

## Strategy by layer
| Layer | What | Tool |
|---|---|---|
| Unit — engine | signals, scoring, hard rules, fingerprint, explain | `apps/mcp-server/test/engine.test.ts` |
| Unit — store | schema, repos, expiry, constraints | `store.test.ts` (in-memory SQLite `:memory:`) |
| Integration — tools | each MCP tool through a real in-process MCP client↔server pair | `tools.test.ts` |
| Integration — simulator | `/api/utter` hero flow against a started server | `apps/simulator/test/flow.test.ts` |
| Eval | accuracy on bench dev/test | `npm run eval` |
| Manual | pre-demo checklist below | human |

## Critical cases
- **T-ENG-1** gift card + urgency + bank ⇒ hold, score 100.
- **T-ENG-5** "five hundred dollars" parsed to 50000 cents.
- **T-ENG-6** trusted payee + gift card ⇒ still hold.
- **T-ENG-7** genuine bank alert ⇒ allow.
- **T-ENG-9** Jaccard 0.75 boundary: 3/4 overlap matches, 2/4 doesn't.
- **T-TOOL-1** `check_message` → `place_hold` → `request_family_approval` → `resolve_approval(deny)` full chain.
- **T-TOOL-5..8** concurrent holds, double resolve (`CONFLICT`), self-approve (`FORBIDDEN`), expiry leaves blocked.
- **T-SEC-1** SQL/HTML text stored and returned verbatim, no execution.
- **T-AI-1/2** Bedrock error ⇒ rules result; injection text doesn't change verdict (mock client).
- **T-SIM-1** MCP down ⇒ fail-safe reply.
- **T-INP-1..3** empty, oversize, non-Latin.

## Fixtures
`apps/mcp-server/test/fixtures/` — 12 hand-written utterances (4 scam, 4 benign, 4 tricky) for unit tests; seeded household `hh_demo`. Bench data comes from the other repo via `BENCH_PATH`.

## Eval protocol (honesty rules)
1. Build/tune rules using **dev** only. 2. Run **test** once, record results. 3. Any later rule change ⇒ new dated entry in `decisions.md`, report both numbers. 4. Publish misclassified ids and why.

## Pre-demo manual QA checklist
- [ ] Fresh clone on a second machine: `npm install && npm run demo` works.
- [ ] `/healthz` on both services OK; Reset demo restores seed.
- [ ] Hero flow ×3 in a row identical; replay shows "same as Tuesday".
- [ ] Benign flow (pharmacy) passes without hold.
- [ ] Mic denied → typing/scenario buttons work.
- [ ] Wi-Fi off → router mode still works.
- [ ] Captions readable at video resolution; no trademarks/music in recording.
- [ ] Repo: LICENSE visible in About, no secrets, README run steps verified.

## Not tested (and why)
Real Alexa+ devices (unavailable), real push notifications, load/perf beyond sanity, visual regression, Bedrock output quality beyond schema checks. Stated openly in submission.
