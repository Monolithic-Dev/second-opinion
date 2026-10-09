# PRD — Second Opinion

**Track:** Alexa+ (Build, Ship, Shape: Amazon Developer Hackathon). **Mini challenges:** AWS Builder, Open Source (via `scam-script-bench`).
**Deadline:** Fri Oct 23 2026 12:00 PM PT (Oct 24 12:30 AM IST). We submit by Oct 22.

## 1. Problem
Older adults lose money to scams that pressure them to pay *now* (gift cards, wire/crypto, "bank security" calls, remote-access requests). Family typically learns afterwards. Existing tools warn on calls/SMS after the fact; none sit at the moment a payment or purchase is requested through the home voice assistant and put a family member in the loop.
(Loss statistics must be verified from FTC/FBI IC3 before they appear in any submission text. [UNVERIFIED])

## 2. Product in one line
Alexa+ checks every pay/buy/send-money request (and any "is this a scam?" question) with a deterministic risk engine; risky requests are **held** until a trusted family member approves or denies by voice/phone.

## 3. Users
| Persona | Need |
|---|---|
| **Dorothy, 78** (elder) | Hands-free help, no new app, no shame in asking. Wants to be kept safe without being treated as incapable. |
| **Priya, 45** (daughter, trusted approver) | Knows *before* money moves; one-tap approve/deny with the red flags explained. |

## 4. Goals / non-goals
**Goals**
1. Hold risky payment/purchase requests until family approves (hold-and-approve gate).
2. Remember across sessions (scam fingerprints, holds, trusted payees): "same gift-card request as Tuesday".
3. Measured detection quality on a public benchmark (`scam-script-bench`), headline slide.
4. Spec-compliant MCP server (Streamable HTTP, spec 2025-11-25+) **and** an Agent Skill.
5. Runs locally from the repo in < 5 minutes (judges may only read repo + watch video).

**Non-goals (WON'T)**: intercepting real phone calls/SMS, a mobile app, training a custom model, real money movement, real personal data, medical/legal advice.

## 5. User stories
- US-1 As Dorothy, I say "buy five $200 gift cards, the bank says I must", so that I get stopped before paying.
- US-2 As Priya, I see why the request was held and tap Approve/Deny, so that I decide in seconds.
- US-3 As Dorothy, I ask "is this text a scam?", so that I get a plain-language second opinion.
- US-4 As Priya, I add Dorothy's pharmacy to trusted payees, so that routine payments aren't blocked.
- US-5 As Dorothy, I'm told "this is the same as Tuesday's request", so that repeat scams are recognised.
- US-6 As a judge, I run `npm run demo` and see the full flow without AWS credentials.

## 6. Functional requirements (testable)
| ID | Requirement |
|---|---|
| FR-1 | MCP server exposes tools `check_message`, `place_hold`, `request_family_approval`, `resolve_approval`, `trusted_payees`, `list_holds` over Streamable HTTP at `/mcp`. |
| FR-2 | `check_message` returns `verdict` ∈ {allow, caution, hold}, integer `score` 0–100, triggered `signals[]` with evidence, `spokenSummary`, and a `card`. Deterministic: same input → same output. |
| FR-3 | Any pay/buy/transfer intent in the simulator calls `check_message` first; `verdict=hold` automatically calls `place_hold` + `request_family_approval`. |
| FR-4 | A hold stays `pending` until `resolve_approval`; timeout (default 10 min) leaves the action **blocked** (`expired`), never auto-released. |
| FR-5 | Fingerprint matching: a new check with signal-set Jaccard ≥ 0.75 to an earlier check returns `similarTo`. |
| FR-6 | Trusted payee on the list lowers score (−40) but never overrides hard rules (gift card + any other signal ⇒ hold). |
| FR-7 | Family pane shows pending holds with red-flag card and Approve/Deny; updates live (SSE). |
| FR-8 | All state persists in SQLite; `POST /api/reset` restores the seeded demo household. |
| FR-9 | `eval/run.ts` scores the engine on `scam-script-bench` (dev + test) and writes `eval/results/*.json` + a markdown table. |
| FR-10 | Optional Bedrock mode (`AGENT_MODE=bedrock`) phrases explanations / adds signals; system fully works without it. |
| FR-11 | Every tool call is written to `audit_events`. |

## 7. Non-functional requirements
- Latency: `check_message` p95 < 50 ms (rules only); simulator turn < 2 s (router mode).
- Reliability: demo path has **zero** network dependence in `AGENT_MODE=router`.
- Safety: synthetic data only; decision-support wording; fail-safe (blocked, not released) on any error.
- Portability: Node 22, no native services; `better-sqlite3` is the only native dep.
- Accessibility: large type, high contrast, captions of every spoken reply, keyboard operable.

## 8. Scope
- **MVP (today)**: FR-1…FR-8, router agent, seeded household, simulator UI with family pane.
- **SHOULD**: FR-9 eval harness with dev/test split, FR-5 fingerprints, cards, Agent Skill file, CI.
- **COULD**: Bedrock mode (FR-10), MCP App UI, weekly digest, AWS deploy.
- **Out**: see non-goals.

## 8b. Tier 1 requirements (see `expansion-scope.md`, `acceptance-criteria.md`)
| ID | Requirement |
|---|---|
| FR-20 | Layered detection (rules, playbook similarity, household behavior, optional LLM) with `layerBreakdown` and an ablation report. |
| FR-21 | Household policy (limits, daily cap, cool-off, quiet hours, quorum, escalation, TTL) combined with risk via a tighten-only decision matrix. |
| FR-22 | Multi-approver workflow: quorum 1–2, veto on deny, timed escalation to next approver rank, expiry stays blocked. |
| FR-23 | Notification outbox with retry/backoff; adapters console, db, email-HTML (simulated). |
| FR-24 | React web app: `/demo` split view and Family Console (dashboard, holds, circle, policy, insights, digest, audit). |
| FR-25 | `@second-opinion/guard-sdk` and a protected third-party example server (`freshmart-mcp`). |
| FR-26 | MCP resources and a prompt in addition to tools; contract snapshots. |
| FR-27 | `/metrics`, `/readyz`, structured logs, Docker Compose run, CI with security scans, Playwright E2E. |

## 9. Success metrics
- Detection on held-out **test** split (30 scripts): scam recall ≥ 0.90, benign false-positive rate ≤ 0.10 at the *hold* operating point (targets, not claims; report actuals honestly incl. failures).
- Demo completes in ≤ 90 s with no manual steps.
- Fresh clone → running demo in ≤ 5 min on a clean machine.

## 10. Judging map (4 equal criteria)
| Criterion | Where we earn it |
|---|---|
| Tech Implementation | Spec-compliant MCP server, Agent Skill, deterministic engine, SQLite state, eval harness, CI, tests |
| Design | 3-turn voice flow, red-flag card, family approval pane, captions, hold state clearly visible |
| Potential Impact | Real pain (verify stats), hold-and-approve is deployable as an Alexa+ guard, open benchmark others can reuse |
| Quality of the Idea | Stateful, purchase-gating, human-in-loop; hits rules' "creative" examples |
| Bonus | Friction log (up to +10%) kept from hour 0 |

## 11. Assumptions
- Real Alexa+ testing is unavailable to us; we use the permitted simulated path **plus** a real MCP server (both visible).
- Free-tier AWS only; no credits guaranteed.
- Team of 2–4; roles are lenses (see `roadmap.md`).
- Agent Skill format follows the open Agent Skills standard (SKILL.md); exact Alexa+ packaging [UNKNOWN] — check the docs link on the Resources page.

## 12. Open questions
1. Exact Alexa+ Agent Skill packaging requirements.
2. Whether judges expect a hosted URL (rules say repo + video suffice).
3. Whether the Open Source mini challenge counts a new dataset repo (we believe yes; confirm in Discord).
