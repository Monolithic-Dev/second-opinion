# Submission checklist (target: all ticked by Oct 22)

## Repo (`second-opinion`)
- [ ] Public; MIT license visible in the GitHub **About** section
- [ ] README: pitch, run steps, architecture image, honesty section, how it maps to rules
- [ ] `npm run demo` verified on a clean clone
- [ ] MCP server uses spec 2025-11-25+ over Streamable HTTP and is **called at runtime** by `apps/simulator`
- [ ] `apps/simulator` source included; video shows it working
- [ ] `skills/second-opinion/SKILL.md` present and referenced
- [ ] No secrets; `.env.example` only
- [ ] CI green badge

## Second repo (`scam-script-bench`) — Open Source mini challenge
- [ ] Public, MIT, 60 scripts (30 dev / 30 test), schema, scorer, results of our engine
- [ ] Created during the hackathon window; commit history shows it
- [ ] Contribution URL, repo URL, GitHub username, short description (what/how/why) ready for the form

## Video
- [ ] < 3:00, public YouTube/Vimeo, English, best part first, no trademarks/copyrighted music

## Devpost form
- [ ] Text description (features, how it works, honesty about simulation)
- [ ] Track: Alexa+  ·  Mini challenges: AWS Builder (if Bedrock/AWS used and documented), Open Source
- [ ] Product feedback for **each**: MCP SDK, Bedrock (if used), MCP Inspector, GitHub Actions, Node tooling, Alexa+ docs; include what worked, what needs work, onboarding, would-build-again
- [ ] AWS services and how they were used (inside product feedback)
- [ ] Optional: feature requests (priority labelled), **friction log** (task, steps, expected vs actual, severity, workaround, suggestion)
- [ ] Representative appointed; team members added
- [ ] Submit by Oct 22; re-open Oct 23 only to fix mistakes

## Final-day sanity (Oct 21–22)
Freeze code → tag `v1.0-submission` → rerun full QA checklist (`testing.md`) → upload video → paste links → view the submission as a stranger would.
