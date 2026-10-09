# Second Opinion

> Before a vulnerable person acts on a suspicious call, text or payment request, Alexa+ gives a spoken second opinion and **holds the action until a trusted family member approves**.

Built for the **Build, Ship, Shape: Amazon Developer Hackathon 2026** — Alexa+ track (+ AWS Builder and Open Source mini challenges).

## The problem
Scams push older adults to pay *now* — gift cards, wire/crypto, fake "bank security" calls. Family finds out afterwards. Second Opinion sits at the moment a payment or purchase is requested through the home voice assistant, explains the red flags in plain language, pauses the action, and asks family to decide.

## How it works
- **MCP server** (spec 2025-11-25+, Streamable HTTP): `check_message`, `place_hold`, `request_family_approval`, `resolve_approval`, `trusted_payees`, `list_holds`.
- **Deterministic risk engine**: explainable signals (gift cards, urgency, impersonation, secrecy, remote access…) → score → `allow | caution | hold`. AI (Bedrock, optional) only phrases or suggests known signals — it never decides.
- **Memory across sessions** (SQLite): scam fingerprints, holds, trusted payees → "this is the same request as Tuesday".
- **Agent Skill** (`skills/second-opinion/SKILL.md`) telling an assistant when and how to use the tools.
- **Simulator**: a web stand-in for Alexa+ (voice + captions) and "Priya's phone" (Approve / Deny), calling the real MCP server through a real MCP client.
- **Measured**: accuracy on [`scam-script-bench`](https://github.com/Monolithic-Dev/scam-script-bench) (dev/test split, different authors).

## Honest limits
Alexa+ cannot intercept phone calls; we gate pay/buy requests and answer "is this a scam?". The Alexa+ experience is **simulated**; family notification is **simulated**; all data is **synthetic**. Decision support, not a guarantee.

## Quick start (target: < 5 min)
```bash
git clone https://github.com/Monolithic-Dev/second-opinion && cd second-opinion
npm install && cp .env.example .env
npm run demo          # http://localhost:3000  (no AWS needed)
```

## Docs index (`docs/`)
| File | What's inside |
|---|---|
| [prd.md](docs/prd.md) | Problem, users, requirements, scope, metrics, judging map |
| [architecture.md](docs/architecture.md) | Diagram, components, flow, trade-offs |
| [project-structure.md](docs/project-structure.md) | Repo layout and conventions |
| [data-model.md](docs/data-model.md) | SQLite schema and samples |
| [api-spec.md](docs/api-spec.md) | MCP tools and simulator HTTP API |
| [detection-engine.md](docs/detection-engine.md) | Signals, weights, thresholds, eval, optional AI |
| [simulator.md](docs/simulator.md) | Alexa+/family-phone stand-in |
| [agent-skill.md](docs/agent-skill.md) | SKILL.md plan |
| [security-privacy.md](docs/security-privacy.md) | Threats, auth, data rules |
| [ux-flows.md](docs/ux-flows.md) | Voice and screen flows, accessibility |
| [edge-cases.md](docs/edge-cases.md) | Failure cases and fixes |
| [testing.md](docs/testing.md) | Strategy, cases, manual QA |
| [deployment.md](docs/deployment.md) | Local run, CI, optional AWS |
| [roadmap.md](docs/roadmap.md) + [phases/](docs/phases) | Plan and per-phase task files |
| [demo-script.md](docs/demo-script.md) | 90 s beat sheet, video outline |
| [rules-digest.md](docs/rules-digest.md) · [submission-checklist.md](docs/submission-checklist.md) | Rules and what to submit |
| [friction-log.md](docs/friction-log.md) · [decisions.md](docs/decisions.md) | Bonus log; decision records |
| [expansion-scope.md](docs/expansion-scope.md) | **Start here:** tiers, gates, what judges see |
| [backend-architecture.md](docs/backend-architecture.md) | Production decisioning blueprint: versioned rules, decision log, idempotency, shadow mode, outbox, hexagonal layers |
| [policy-and-approvals.md](docs/policy-and-approvals.md) | Household policy, quorum, escalation, notification outbox |
| [family-console.md](docs/family-console.md) | React web app and Family Console |
| [guard-sdk.md](docs/guard-sdk.md) | Reusable gate for any MCP server |
| [observability-and-quality.md](docs/observability-and-quality.md) | Logs, metrics, test pyramid, CI, Docker |
| [acceptance-criteria.md](docs/acceptance-criteria.md) · [spec-conventions.md](docs/spec-conventions.md) | EARS criteria; how specs are written for agents |
| [phases/expansion/](docs/phases/expansion) | Tier 1 runbooks X1–X5 |
| [AGENTS.md](AGENTS.md) · [CLAUDE.md](CLAUDE.md) | Instructions for coding agents |

## Platform features (Tier 1)
Layered explainable detection with ablation · household policy engine (limits, daily cap, cool-off, quiet hours) · multi-approver quorum with escalation · notification outbox · React Family Console with "protected dollars" · **Guard SDK** so any Alexa+ merchant MCP server can add the gate in ~10 lines · metrics, structured logs, Playwright E2E, Docker Compose.

## Team
Roles (lenses): Backend/MCP · Frontend/simulator · Data/QA/docs. _(fill in names)_

## License
MIT — see [LICENSE](LICENSE).
