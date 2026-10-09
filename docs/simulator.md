# Simulator (stand-in for Alexa+ and the family phone) — as built

The Rules allow a simulated Alexa+ experience if the repo contains its source and the video shows it working. `apps/simulator` is more than a mock: it is a real **MCP client** (Streamable HTTP, official SDK) calling the real MCP server, plus the backend for the web app.

## Honest framing (say it in README and video)
- We cannot run on a real Alexa+ device. The simulator plays the assistant; payments and purchases are **simulated** (nothing moves money).
- In real Alexa+ a third-party MCP server only sees requests routed to it. In the simulator every pay/buy intent is routed through the guard to show the intended integration. The Guard SDK (`guard-sdk.md`) shows how a merchant server routes its own tools.
- Family notification is simulated (in-app inbox + HTML email rendered to a file).

## Run it
`npm run demo` seeds the database, starts the MCP server (:3001) and the simulator (:3000), waits for both and prints the URLs. No AWS account or network access.

## Components (`apps/simulator/src`)
| File | Role |
|---|---|
| `gateway.ts` | `McpGateway`: lazy MCP client, one reconnect on failure, per-call timeout, `x-request-id` propagated through `AsyncLocalStorage` so the MCP server stores it as the decision `trace_id`. `GatewayDown` and `ToolCallError` are distinct. |
| `agent/intent.ts` | Deterministic intent classifier (below). No model. |
| `agent/router.ts` | `runTurn()`: fixed tool sequences, fail-closed, builds `reply` (captions), `spoken` (read aloud), `card`, `trace`. |
| `events.ts` | `EventHub`: SSE fan-out with heartbeat and a connection cap. |
| `session.ts` | HMAC-signed, expiring, HttpOnly SameSite=Lax session cookie; constant-time PIN check. |
| `app.ts` | Express API, security headers, CSRF header check, rate-limited login, static web app with SPA fallback. |
| `config.ts` | Validated env; production refuses default secrets, PINs or MCP token. |

## Intents (`agent/intent.ts`)
| Intent | Examples | Calls |
|---|---|---|
| `PURCHASE_OR_PAY` | "Buy five $200 gift cards", "Pay Greenleaf Pharmacy $24", "Wire $500 to my neighbour" | `check_message` → (if hold or policy needs approval) `place_hold` → `request_family_approval` → `get_household` |
| `SCAM_QUESTION` | "I got a text saying…", "Is this legit?", "Someone called…" | `check_message` only (no action context) |
| `STATUS` | "What's pending?" | `list_holds` |
| `TRUST_LIST` / `TRUST_ADD` (family) | "Who do I trust?", "Add City Power & Light to trusted" | `trusted_payees` |
| `FAMILY_DECISION` (family) | "Approve it", "Deny it" | `list_holds` → `resolve_approval`. The **elder** saying "approve" is refused. |
| `FALLBACK` | anything else | help text |
Questions about a message are never treated as actions, even when they mention money. Every state-changing call carries an idempotency key, so the gateway's single retry cannot create a second hold.

## What is read aloud
When a request is paused the spoken text is always: *"I've paused this."* + the single most important reason (concrete red flags first, not the generic "known scam pattern") + *"It's the same kind of request as Tuesday."* when we have seen it before + *"I've asked Priya to check."* It is never cut in the middle of that list. Captions (`reply`) additionally carry the advice line.

## HTTP API (see `api-spec.md` §B)
`POST /api/utter`, `GET /api/state`, `GET /api/events` (SSE), `POST /api/auth/login|logout`, `GET /api/auth/me`, `POST /api/family/holds/:id/vote`, `PUT /api/family/policy`, `POST|DELETE /api/family/payees`, `GET /api/family/insights`, `POST /api/reset`, `GET /healthz`. Family voice (`speaker: "family"`) and all `/api/family/*` need a session. Non-GET API calls need `X-Requested-With: so`.

## Fail-safe
MCP server down, slow or erroring ⇒ *"I couldn't verify this, so I haven't done it."*, `executed: false`, no hold released, `/api/state` answers 503. Tested with a gateway pointed at a dead port.

## Auth (demo-grade, honest)
Seeded PINs (Priya `1234`, Arjun `5678`) are **demo credentials** and are refused in production config. Production would use real identity (e.g. Login with Amazon) and per-user consent.
