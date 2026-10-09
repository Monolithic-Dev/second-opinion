# Roadmap

Today is Oct 9 (IST). Hard deadline: Oct 23 12:00 PM PT. Plan: **working MVP today (phases 1–4)**, then use the remaining days for the thing that wins — measured accuracy, polish, video, submission paperwork. Freeze Oct 21, submit Oct 22, Oct 23 = buffer only.

| Phase | Window | Goal | Done when |
|---|---|---|---|
| 1 Foundation | Oct 9, 2.5 h | Scaffold monorepo, hello MCP tool on Streamable HTTP, tested with MCP Inspector | `npm run dev` starts; Inspector lists + calls `ping`; CI green |
| 2 Engine | Oct 9, 4 h | Pure risk engine + unit tests | All T-ENG tests pass; hero input scores 100/hold |
| 3 State & tools | Oct 9–10, 5 h | SQLite + six MCP tools | T-TOOL chain test passes via real MCP client |
| 4 Simulator & UI | Oct 10–11, 8 h | Router agent, SSE, elder + family panes, cards | Hero flow works end to end by clicking Scenario buttons |
| 5 Eval & bench | Oct 11–15, 9 h | 60 scripts (dev/test), scoring, results table, optional Bedrock variant | `npm run eval` produces `latest.md`; numbers recorded |
| 6 Polish & submit | Oct 15–22, 16 h | Agent Skill, README, video, product feedback, friction log, final QA | Submission checklist 100% |

Note: "do everything today" is not realistic at this depth. Phases 1–3 (engine + MCP server) are achievable today with an AI coding agent; the simulator, accuracy test and video need the following days.

Phase detail files: `docs/phases/phase-N-*.md` (tasks, acceptance, files).

## Expanded schedule (Tier 1, assumes 3 people ≈ 4 h/day each)
| Day | Person A (backend/MCP) | Person B (frontend/simulator) | Person C (data/QA/docs) |
|---|---|---|---|
| Oct 9 | P1, P2 engine L1 | P1 help → P4A prep | Bench scripts (`dev`) start |
| Oct 10 | P3 store + tools | P4A simulator BFF | Bench `dev` finish; AC tests |
| Oct 11 | X1 layers (start) | P4B lite UI → **G1 check** | Bench `test` authored (blind) |
| Oct 12–13 | X1 → X2 policy/quorum | X3 web scaffold, `/demo` | Playbook KB (20 files), eval runner |
| Oct 14–15 | X2 jobs/outbox/tools | X3 console pages | Eval + ablation; friction log |
| Oct 16 | X1/X2 freeze → **G2** | X3 holds/detail/policy | Run `test` split once |
| Oct 17–18 | X4 guard SDK + example | X3 insights/digest/a11y | X5 CI/E2E/Docker |
| Oct 19 | **G3 feature freeze**, bugfix | Polish | Video script + QA |
| Oct 20 | Fix, Agent Skill | UI polish | Record video |
| Oct 21 | Freeze, tag, final QA | — | Product feedback, friction log |
| Oct 22 | Submit | Submit support | Submit support |
Gates: **G1** Oct 11 end (Tier 0 demo works) · **G2** Oct 16 end (detection frozen) · **G3** Oct 19 (feature freeze). Cut order if behind: X5 → X4 → X3 secondary pages → X2 notifications → X1 L4. Phase files: `phases/` (core) and `phases/expansion/x1…x5` (Tier 1).

## MVP milestone ("done enough to demo")
`npm run demo` → Scenario "Gift cards" → held → Priya Deny → Dorothy told → replay shows "same as Tuesday"; benign pharmacy payment passes. No network needed.

## Stretch (ranked by payoff/effort)
1. Bedrock phrasing + `rules+ai` eval variant (high payoff for AWS Builder, low effort with cache).
2. Agent Skill file + doc (low effort, named in rules).
3. MCP App UI card (`ui://` resource) — only if the SDK supports it cleanly [UNKNOWN].
4. Weekly digest tool, AWS EC2 deploy.
5. Second language strings (Hindi/Spanish) — only if time.

## Demo script
See `demo-script.md` (90 s beat sheet + 3-minute video outline).

## Post-hackathon (3 months)
Real Alexa+ integration pending Amazon access; multi-approver quorum; bank/payment-provider webhooks as a second guard; larger multilingual corpus; partnerships with elder-care orgs; evaluation on real (consented, de-identified) scripts with partner organisations.

## Roles (lenses; one person can wear several)
A Backend/MCP (engine, store, tools) · B Frontend/simulator (UI, SSE, voice) · C Data/QA/docs (bench scripts, eval, video, paperwork). Different people must author `dev` and `test` splits.
