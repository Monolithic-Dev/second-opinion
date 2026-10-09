# Spec conventions (how these docs are written for coding agents)

Researched Oct 9 2026 (secondary sources: vendor/community blogs; numbers are rules of thumb, not measured facts). Sources: [Spec-driven development in 2026](https://dev.to/krlz/spec-driven-development-in-2026-what-it-is-the-tooling-and-how-teams-actually-use-it-2fk2), [AGENTS.md guide](https://www.morphllm.com/agents-md-guide), [AGENTS.md best practices](https://www.betterclaw.io/blog/agents-md-best-practices), [Agent experience](https://marmelab.com/blog/2026/01/21/agent-experience.html), [Spec-driven development for AI agents](https://www.truefoundry.com/blog/spec-driven-development-ai-agents), [CLAUDE.md best practices](https://reliasoftware.com/blog/claude-md-file), [CLAUDE.md best practices (2)](https://www.heyuan110.com/posts/ai/2026-03-05-claude-code-claudemd-best-practices/).

## What the research says → what we did
| Practice | Our application |
|---|---|
| Short, specific `AGENTS.md`; exact commands, style deviations, hard boundaries; no README duplication; ~150–200 instruction ceiling | Root [`AGENTS.md`](../AGENTS.md) (~50 lines): commands, 8 non-negotiable rules, never-touch list, workflow. `CLAUDE.md` imports it with `@AGENTS.md` and adds only Claude-specific notes |
| Add rules from real agent mistakes, prune conflicts | "Agent mistakes log" below; delete conflicting rules rather than arbitrate |
| Put checkable guarantees in CI/hooks, not prose | Fail-closed, purity, tests enforced by tests and CI (`observability-and-quality.md`) |
| Long procedures belong in skills/workflow files | Phase files are the procedures; `skills/second-opinion/SKILL.md` is the product skill |
| Constitution first (durable project-wide decisions) | `AGENTS.md` rules + `decisions.md` |
| Spec → plan → tasks with review gates, per feature | `prd.md` + feature docs = **spec**; `architecture.md`/`project-structure.md` = **plan**; `phases/*.md` and `phases/expansion/*.md` = **tasks**. Review each gate before coding |
| Explicit out-of-scope; domain language over implementation | PRD §4 non-goals; `expansion-scope.md` non-goals and tier rules |
| Acceptance criteria in EARS ("WHEN … the system SHALL …") | [`acceptance-criteria.md`](acceptance-criteria.md): every FR has EARS statements mapped to test ids |
| Clarification pass before code | Each phase file has "Risks and blockers"; agents must list ambiguities before guessing (AGENTS.md workflow) |
| Specs outlive code; keep 1–3 pages; split big ones | One concern per doc; features split into their own files (policy, console, SDK, quality) |
| Stable names and contracts across files | `api-spec.md` and `data-model.md` are canonical; AGENTS.md rule 4 |

## Doc roles
| Layer | Files |
|---|---|
| Constitution | `AGENTS.md`, `CLAUDE.md`, `decisions.md` |
| Spec (what/why) | `prd.md`, `acceptance-criteria.md`, `ux-flows.md`, `rules-digest.md` |
| Plan (how) | `architecture.md`, `project-structure.md`, `data-model.md`, `api-spec.md`, `detection-engine.md`, `policy-and-approvals.md`, `family-console.md`, `guard-sdk.md`, `simulator.md`, `security-privacy.md`, `observability-and-quality.md`, `deployment.md` |
| Tasks (do) | `roadmap.md`, `phases/`, `phases/expansion/`, `testing.md`, `submission-checklist.md` |

## Writing rules
1. One concern per file; ≤ ~3 pages; link instead of repeating.
2. Imperative and checkable ("returns 401 without token"), never vague ("secure").
3. Name real files, functions, fields, endpoints; keep names identical everywhere.
4. Mark unknowns `[UNKNOWN]`/`[UNVERIFIED]` instead of guessing.
5. When code diverges from a doc, fix the doc in the same commit.

## Agent mistakes log (add as they happen)
_(empty — add one line per recurring mistake, then add or sharpen the matching AGENTS.md rule)_
