# Phase 4 — Simulator (4A agent/API, 4B UI)

**Goal / done:** from a fresh `npm run demo`, clicking the "Gift cards" scenario produces the full hold-and-approve flow across the elder and family panes, with real MCP calls visible in the trace drawer.
**Preconditions:** Phase 3 complete (MCP server running on :3001 with seed).
**Implements:** `simulator.md` (all), `ux-flows.md` (Flows A–D, accessibility), `api-spec.md` §B, `prd.md` FR-3, FR-7, FR-8; `edge-cases.md` #12, #14, #15; `architecture.md` §3.
**Parallelism:** one person on 4A, one on 4B; contract is `api-spec.md` §B.

## 4A — Agent and HTTP API (`apps/simulator/src`)
1. **`config.ts`** — `loadConfig()` (`SIM_PORT`, `MCP_URL`, `MCP_AUTH_TOKEN`, `AGENT_MODE` ∈ router|bedrock, default router) validated with `zod`.
2. **`mcpClient.ts`** — `class McpGateway { constructor(url, token); connect(); callTool<T>(name, args): Promise<T>; isUp(): boolean }` using the SDK `Client` + `StreamableHTTPClientTransport` with `requestInit.headers.Authorization`. 5 s timeout per call; one retry on connection reset; on persistent failure throw `GatewayDown`. Parse `structuredContent`; throw `ToolCallError {code,message}` when `isError`.
3. **`agent/intent.ts`** — `classifyIntent(text: string, speaker: 'elder'|'family'): Intent` (`PURCHASE_OR_PAY|SCAM_QUESTION|TRUST_ADD|TRUST_LIST|STATUS|FALLBACK`) with the regexes in `simulator.md`; `extractAction(text): {actionType, amountCents?, payee?}` (reuse the engine's amount parser by importing from `@second-opinion/engine` **only if** exposed as a workspace package — otherwise duplicate the 20-line parser and note it in `decisions.md`).
4. **`agent/router.ts`** — `runTurn(input: {householdId, speaker, text}, gw: McpGateway, hub: EventHub): Promise<TurnResult>` implementing the tool sequences; on `verdict === 'hold'` automatically `place_hold` then `request_family_approval` (never left to model judgment). Builds `reply`, `spoken` (≤ 2 sentences), `card`, `holdId`, `verdict`, `trace[] {tool,args,ok,ms,summary}`. **Fail-safe:** any `GatewayDown`/`ToolCallError` ⇒ reply "I couldn't verify this, so I haven't done it." and `executed:false`.
5. **`events.ts`** — `class EventHub { subscribe(res), publish(type, data) }` writing SSE frames (`event:`/`data:`), 15 s heartbeat comment, cleanup on `close`.
6. **`server.ts`** — Express: `POST /api/utter` (zod body: `householdId` regex, `speaker`, `text` 1–2000), `GET /api/state?householdId=` (calls `list_holds` + `trusted_payees list` + people), `GET /api/events` (SSE), `POST /api/family/resolve` (calls `resolve_approval`, publishes `hold.resolved`), `POST /api/reset` (calls reset script/function, publishes `reset`), `GET /healthz` → `{ok, mcp: gw.isUp()}`; static `public/`. Per-IP rate limit 60 req/min (tiny in-memory limiter). Error handler returns JSON `{error}` without stack.
7. **`scripts/demo.ts`** — spawn mcp-server and simulator (`child_process.spawn` with inherited env), wait for both `/healthz`, run `seedDemo`, print `http://localhost:3000`, forward SIGINT.
8. **Tests** `apps/simulator/test/flow.test.ts`: `T-SIM-1 MCP down returns fail-safe reply and executed=false`, `T-SIM-2 hero utterance returns hold + holdId + card`, `T-SIM-3 family deny updates state to denied and emits hold.resolved`, `T-SIM-4 replay returns similarTo message`, `T-SIM-5 pharmacy payment returns allow without hold`, `T-SIM-6 invalid body → 400`, `T-SIM-7 rate limit returns 429`, `intent classification table (12 cases)`.

## 4B — Lite UI (`apps/simulator/public`) — fallback, cap at ~2 h
The main UI becomes the React app in `expansion/x3-web-app-and-family-console.md`. Keep this static page minimal; it stays served at `/lite` as a no-build safety net for recording the video.
1. **`index.html`** — landmarks (`<main>`, two `<section aria-label>` panes), mic button, text input, scenario buttons (Gift cards, Scam text, Pharmacy, Replay), Reset, trace drawer (`<details>`), mode badge.
2. **`app.js`** (vanilla ES modules): `speak(text)` via `speechSynthesis`; `listen()` via `SpeechRecognition` with feature detection (hide mic if absent, edge-case #14); `sendUtterance(text)`; `renderCard(card)`; `renderHolds(holds)`; `connectEvents()` with `EventSource` auto-reconnect and `GET /api/state` resync on reopen (edge-case #15); optimistic UI disabled — the pane reflects server state only.
3. **`styles.css`** — tokens: amber/red/green card levels, 20 px body, 32 px captions, ≥ 4.5:1 contrast, 44 px targets, `prefers-reduced-motion`.
4. **States** per `ux-flows.md`: idle, listening, thinking, answering, held-waiting, resolved; family pane: pending / history / empty state.
5. **Accessibility:** `aria-live="polite"` on reply region, visible focus rings, keyboard operable Approve/Deny, text alternative for every audio reply.
6. **Manual QA script** (to run before moving on): hero flow ×3; Wi-Fi off still works (router mode); mic denied → typing works; resize to 1280×720 (video capture size).

## Real-world engineering concerns
- **No secrets in the browser:** token lives only in the simulator server env.
- **XSS:** render all text via `textContent`, never `innerHTML`; test with `<img onerror>` payload.
- **Idempotent Approve/Deny:** disable buttons on click; server `CONFLICT` shown as "already decided".
- **SSE scaling:** single process, N pages; cap 20 subscribers.
- **Demo determinism:** `AGENT_MODE=router`, no network calls; scenario buttons send fixed utterances.

## Definition of done
- [ ] `npm run demo` starts both services; `/healthz` on :3000 reports `mcp:true`.
- [ ] Gift-card scenario: red card in elder + family panes < 1 s; Deny → elder hears/sees cancellation; trace drawer shows `check_message → place_hold → request_family_approval → resolve_approval`.
- [ ] Replay scenario text contains "same" and the earlier weekday.
- [ ] Pharmacy scenario completes without hold.
- [ ] Killing the MCP process yields the fail-safe reply within 6 s.
- [ ] All T-SIM tests green; `<img onerror>` input renders as text.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Web Speech API flaky in the recording browser | Scenario buttons + typing are the primary demo path; voice is a bonus take |
| UI time sink | Ship the ugly-but-clear version first; polish in Phase 6 |
| Import sharing between workspaces | Prefer duplication of the small amount parser over a new package |

## Time budget
8 h (18%): 4A 4 h, 4B 4 h. Cut first: Flow D voice trust-add, history list, rate limiter.

## Handoff
Phase 5 can assume: end-to-end demo works offline; engine can be exercised through `eval/run.ts` independently. Tag `phase-4-done` (commit `feat(simulator): router agent, SSE, elder and family panes`).
