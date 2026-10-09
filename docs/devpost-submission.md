# Devpost submission draft

Paste-ready text for the Devpost form. Keep it honest: the Alexa+ experience, payments and notifications are simulated. Facts here match the repo at the time of writing; re-check numbers before submitting (`npm test`, `npm run eval`).

## Name
Second Opinion

## Tagline (one line)
When someone asks Alexa+ to pay or buy something that looks like a scam, it says why, holds the action, and waits for family to approve.

## Track and challenges
Alexa+ track · Open Source mini challenge (`scam-script-bench` dataset + Guard SDK) · AWS Builder (only if an AWS service is actually used and documented; today nothing in the product requires AWS)

## Inspiration
Scams work because they say "pay now". The people most at risk are often alone at home with a voice assistant that will happily place an order. Family usually learns about it afterwards. The assistant is exactly where the money moves, so that is where a second opinion belongs.

## What it does
- A voice request such as "buy five $200 gift cards, the bank says I must today" is checked before anything happens.
- Alexa+ answers in two kind sentences ("I've paused this and asked Priya. This looks like a gift card request, which is a common scam") and **does not carry the action out**.
- A trusted family member sees the same red flags on their phone and approves or denies. One or two approvers are required (a household choice), any denial vetoes, and unanswered requests escalate and then expire **blocked**.
- Ordinary requests (a $24 refill at the pharmacy the family trusts) go straight through.
- Asking "is this a scam?" about a text or call gets a plain-language answer with the matching scam playbook.

## How it works
- **A real MCP server** (spec 2025-11-25, Streamable HTTP, `@modelcontextprotocol/sdk` 1.32.1) with 12 tools: `check_message`, `place_hold`, `request_family_approval`, `resolve_approval`, `trusted_payees`, `list_holds`, `get_hold`, `get_household`, `get_policy`, `set_policy`, `household_insights`, `list_notifications`. Every tool has a title, an output schema and honest annotations.
- **A deterministic, explainable risk engine**, no model deciding: phrase rules, 20 scam playbooks (idf-weighted keyword coverage), a household behavior layer (unusual amount, new payees, night hours, retry after "no"), fused under per-layer caps with a few decisive rules. Every decision is pinned to an immutable rule-set version (`rules-2026.10.1` to `.4`) in an append-only log, so any past verdict can be replayed and explained.
- **A household policy engine** that can only add friction (limits, new-payee cool-off, quiet hours, daily cap, quorum with veto).
- **Reliability**: idempotency keys, a transactional outbox with retry for notifications, escalation and expiry jobs, request tracing from the screen to the decision row, fail-closed behavior on any error.
- **Agent Skill** (`skills/second-opinion/SKILL.md`) telling an agent when to check, hold and ask family. A test keeps it in sync with the real tool names.
- **Guard SDK** (`packages/guard-sdk`): wrap any merchant MCP tool that moves money in a few lines; it checks first, holds when risky, and fails closed if the guard is unreachable. Example: `examples/freshmart-mcp`.
- **Alexa+ stand-in + family console**: a real MCP client with a live demo screen, and a React console (requests, votes and timeline, trusted payees, rules, insights, notification inbox), axe-checked on every page.
- **Ops**: Prometheus `/metrics`, a Dockerfile and compose file, CI with typecheck, unit and contract tests, and real-browser Playwright tests.

## Honest results
Measured on [`scam-script-bench`](https://github.com/Monolithic-Dev/scam-script-bench), a 100-script synthetic benchmark we built for this (dev 30, held-out test 30, fresh test2 40):
- On the held-out test split the detector held **46.7%** of scams (flagged 80%), with **0%** of benign messages wrongly held. The dev split, which we tuned on, was 86.7%. We publish the gap and the list of what was missed.
- The newest rule set (`rules-2026.10.4`) holds 95% on test2 with 0% false holds, **but the same author wrote test2 and the new rules, so we do not claim that number generalises**. The older detector held 30% of test2, written before tuning, which is the fairer picture of unfamiliar wording.
- Every number here reproduces with `npm run eval`. No benchmark claim is made about real-world accuracy; the scripts are invented and English-only.

## Challenges
- Making "hold and approve" safe when anything can fail: every error path leaves the action unexecuted.
- Not fooling ourselves with a tiny dataset: tuning only on dev, freezing the test split after one run, immutable versioned rule sets, and golden tests so a published version can never change.
- Warnings that sound like scams ("we will never ask for your PIN") must not be held.

## Accomplishments
A complete, tested, runnable system rather than a mock-up, and an evaluation we are willing to publish with its weaknesses.

## What we learned
Rules plus playbooks go a long way on text, but the household context (new payee, large amount, night time) catches things the words alone never will. And measuring honestly on a small set matters more than a high number.

## What's next
Independently written scripts to re-score the detector; real Alexa+ integration once the packaging for Agent Skills and account linking is verified; optional language-model suggestions as an additive signal that can never decide; push-notification and email delivery behind the existing outbox.

## Simulated vs real (say this in the video too)
| Real | Simulated |
|---|---|
| MCP server, tools, schemas, protocol | The Alexa+ voice assistant (our simulator is an MCP client standing in for it) |
| Risk engine, policy engine, approvals, audit log | Payments (no money moves) |
| Guard SDK and example merchant server | Family notifications (rendered to a file / inbox) |
| Benchmark and scorer | All household data is synthetic |

## Built with
TypeScript, Node 22, Model Context Protocol SDK, Express, SQLite (Node's built-in node:sqlite), React, Vite, Playwright, axe-core, GitHub Actions, Docker.

## Product feedback (fill from `friction-log.md` before submitting)
Cover each tool actually used, with what worked, what needs work, onboarding, and would-build-again:
1. **MCP TypeScript SDK**: see FL-3.
2. **GitHub Actions**: see FL-2.
3. **Node tooling / native modules**: see FL-1 (the native-module problem that made us use the built-in SQLite).
4. **Alexa+ developer documentation**: not verified at the time of writing; do not claim anything here until it is read and tried.
5. **MCP Inspector, AWS/Bedrock**: write only if used.
