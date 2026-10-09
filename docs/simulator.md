# Simulator (stand-in for Alexa+ and the family phone)

The Rules allow a simulated Alexa+ experience if the repo contains its source and the video shows it working. Our simulator is more than a mock: it is a real MCP **client** calling the real server.

## Honest framing (say it in README and video)
- We cannot run on a real Alexa+ device. The simulator plays the assistant.
- In real Alexa+, a third-party MCP server only sees requests routed to it. In the simulator we route pay/buy intents through the guard to show the intended integration.
- Family notification is simulated (second pane + SSE).

## Agent modes (`AGENT_MODE`)
| Mode | Behaviour | Needs AWS |
|---|---|---|
| `router` (default) | Deterministic intent classifier → fixed tool sequence | No |
| `bedrock` | Bedrock Converse with MCP tools exposed as tool specs; model chooses calls; guardrail: system prompt + a code-level rule that `place_hold` is auto-invoked on `verdict=hold` | Yes |

## Router intents (`agent/intent.ts`)
| Intent | Trigger (regex, case-insens.) | Tool sequence |
|---|---|---|
| PURCHASE_OR_PAY | `\b(buy|order|purchase|pay|send|transfer|wire|deposit)\b` + money/gift words | `check_message(ctx.actionType)` → if hold: `place_hold` → `request_family_approval` |
| SCAM_QUESTION | `scam|suspicious|is this (real|legit)|someone (called|texted|emailed)|got a (text|call|email)` | `check_message` only |
| TRUST_ADD | `add .* (to )?trusted` / `trust .*` (family speaker only) | `trusted_payees add` |
| TRUST_LIST | `who (can|do) i trust|trusted` | `trusted_payees list` |
| STATUS | `any (holds|pending)|what('s| is) pending` | `list_holds` |
| FALLBACK | none | "I can check a message or a payment for you." |
Amount parsing: `$(\d[\d,]*)(?:\.\d\d)?`, "N x $M", "N hundred" → `amountCents`. Payee: text after "to|from" or the gift-card/merchant noun.

## Response composition
`reply` (display), `spoken` (TTS text; no markdown), `card` (from tool), `holdId`, `verdict`, `trace[]` (tool name, args, result summary, ms). Spoken replies ≤ 2 sentences.
Voice: Web Speech API `SpeechRecognition` + `speechSynthesis`; typing box always available (fallback + accessibility). Captions always shown.

## UI (`public/`)
Left: **Elder pane** (big mic button, transcript, spoken reply captions, red-flag card). Right: **Family pane — "Priya's phone"** (pending holds, flags, Approve/Deny, history). Bottom drawer: **Developer trace** (live MCP calls + engine signals). Top bar: mode badge, Reset demo, Scenario buttons (seeded utterances for reliable demo).

## Realtime
Simulator keeps one SSE channel per page; broadcasts `hold.created`, `hold.resolved`, `check.done`, `reset`. The simulator polls nothing: it emits events after its own MCP calls complete.

## MCP client (`mcpClient.ts`)
Official SDK `Client` + `StreamableHTTPClientTransport(MCP_URL)` with `Authorization` header from `MCP_AUTH_TOKEN`. One connection per process, reconnect on failure; `/healthz` reports `mcp:true|false`. If the MCP server is down, replies "I can't reach the safety checker, so I haven't done anything." (fail-safe).
