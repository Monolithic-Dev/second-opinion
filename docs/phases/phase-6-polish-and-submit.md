# Phase 6 — Agent Skill, polish, video, submission

**Goal / done:** every item in `submission-checklist.md` is ticked by Oct 22; Oct 23 is buffer only.
**Preconditions:** Phases 1–5 complete (or explicitly cut — see Time budget).
**Implements:** `agent-skill.md`, `demo-script.md`, `submission-checklist.md`, `rules-digest.md`, `friction-log.md`, `testing.md` (manual QA), `deployment.md` (CI, optional AWS), `ux-flows.md` (polish).

## Task breakdown
1. **Agent Skill** — create `skills/second-opinion/SKILL.md` (front matter `name`, `description`; steps 1–6 from `agent-skill.md`). Verify packaging against the Resources "Build with Agent Skills" doc; record result and any divergence in `decisions.md` (D10). Add `test/skill.test.ts`: `front matter parses`, `description mentions buy|pay|transfer|scam`, `references only existing tool names`. In `AGENT_MODE=bedrock`, load the SKILL.md body as the system prompt so the skill is exercised at runtime (optional stretch).
2. **Optional Bedrock agent mode** (only if time): `agent/bedrock.ts` using Converse with tool specs derived from MCP `tools/list`; hard rule in code that `verdict=hold` triggers `place_hold`+`request_family_approval` regardless of model output; same fail-safe; cached transcripts for the video.
3. **UI polish pass** — card typography, empty states, error toasts, captions size at 1080p, consistent iconography (inline SVG, no third-party logos), reduced motion; run an automated contrast check (axe via `npx @axe-core/cli http://localhost:3000`) and fix criticals.
4. **README final** — pitch, GIF/screenshot, 5-minute quick start (verified), architecture diagram (render the mermaid to PNG), accuracy table, honesty section, rule mapping, docs index, team names.
5. **Clean-machine test** — on a second computer or fresh VM: `git clone`, `npm install`, `cp .env.example .env`, `npm run demo`; time it (< 5 min); fix every snag; note friction.
6. **Statistics check** — look up FTC Consumer Sentinel / FBI IC3 elder-fraud figures; cite source and year in README and video; delete any number you can't source.
7. **Record the video** per `demo-script.md`: 1080p, local run, Scenario buttons, best moment in the first 20 s, < 3:00, English, captions burned in or YouTube-generated and checked; no Amazon/Alexa logos or music; upload **Public** to YouTube/Vimeo; verify playback logged-out.
8. **Product Feedback** — one section per tool actually used: MCP TypeScript SDK, MCP Inspector, Alexa+ docs/Agent Skills docs, Amazon Bedrock (if used, with "which AWS services and how"), GitHub Actions, Node/tsx/SQLite. For each: what we used it for, what worked, what needs work, onboarding experience, would-build-again Yes/No and why.
9. **Friction log** — finalise 8–15 concrete entries from `friction-log.md` with severity, workaround, suggestion (up to +10% bonus).
10. **Devpost form** — description (features, how it works, honesty about simulation), track Alexa+, mini challenges (AWS Builder only if Bedrock/AWS use is documented; Open Source with bench repo URL, repo URL, GitHub username, what/how/why), video link, repo link, product feedback, optional feature requests and friction log, Representative appointed, teammates added.
11. **Freeze and tag** — Oct 21: stop features; run full manual QA (`testing.md`) + `npm test` + `npm run eval -- --cache-only`; `git tag v1.0-submission` in both repos.
12. **Submit Oct 22**; then open the public submission page as a stranger and click every link. Oct 23: fixes only.

## Real-world engineering concerns
- **Secrets hygiene:** `git log -p | grep -E "AKIA|secret|token"` before the repo is judged; rotate any exposed key.
- **Public repo hygiene:** no `.env`, no local DB, no TODO-with-names; license shows in About.
- **Rate/availability of YouTube processing:** upload ≥ 24 h before the deadline.
- **Rule drift:** re-read the live Rules tab on Oct 21 for changes.

## Definition of done
- [ ] All boxes in `submission-checklist.md` ticked.
- [ ] A teammate not on the project runs the demo from the README in < 5 min.
- [ ] Video is public, < 3:00, passes the logged-out playback check.
- [ ] No unsourced statistic anywhere.
- [ ] `v1.0-submission` tag exists in both repos; submission shows "Submitted" on Devpost.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Video takes longer than planned | Script and rehearse Oct 19; record once on Oct 20, re-record only for errors |
| Agent Skill packaging requirement differs | Ask in Discord/office hours Oct 15; keep SKILL.md minimal and standard |
| Last-minute bug | Freeze Oct 21; only P0 fixes after |
| Devpost form surprises | Create the draft submission on Oct 15 to see every field |

## Time budget
16 h (36%) across Oct 15–22. Cut first (in order): Bedrock agent mode, AWS EC2 deploy, MCP App card, extra UI polish, optional feature requests.

## Handoff
End state: submitted project. Post-submission: keep repos stable until judging ends Nov 20; do not push breaking changes. Tag `v1.0-submission`.
