# AGENTS.md — Second Opinion

Guard for Alexa+ payments: MCP server + deterministic risk engine + family approval. Hackathon deadline **Oct 23 2026 12:00 PM PT**; we submit Oct 22. Specs live in `docs/`; read `docs/expansion-scope.md` first (tiers and gates).

## Commands (exist once Phase 1 is done)
- Install: `npm install` · Demo (both services, seeded): `npm run demo`
- Typecheck: `npm run typecheck` · Tests: `npm test` · Single file: `node --import tsx --test <file>`
- Eval (offline, cached): `npm run eval -- --split dev --cache-only`
- E2E (Tier 1): `npm run e2e`

## Non-negotiable rules
1. **Fail closed.** Any error in check/hold/approval paths means the action is NOT executed. Never auto-release a hold.
2. **Rules decide, models never do.** The LLM may only rephrase text or suggest ids from the `SignalId` enum. It never sets a verdict.
3. **`packages/engine` and `packages/policy` are pure:** no I/O, no `Date.now()`, no randomness. Inject a `Clock`.
4. **Canonical names come from `docs/api-spec.md` and `docs/data-model.md`.** If code must differ, change the doc and log it in `docs/decisions.md` in the same commit.
5. **Apps never import other apps.** Allowed deps are in `docs/project-structure.md` (Package boundaries).
6. **Synthetic data only.** No real personal data, numbers, URLs or secrets anywhere in the repo.
7. **Parameterised SQL only; render text with `textContent`; validate every input with zod.**
8. **Do not tune on the bench `test` split.** Never edit or open `eval/results/test-frozen.json` logic to re-run without `--force` and a `decisions.md` entry.

9. **MCP rules live in `docs/mcp-best-practices.md`:** stateless Streamable HTTP, `Origin` ⇒ 403, tool errors as `isError:true`, every tool has `title`, `outputSchema`, accurate `annotations`; annotations are hints, enforce in handlers.
10. **Commits use the repo owner's git identity only; do not add Claude/AI co-author trailers.**

## Boundaries (never touch)
`.env`, `data/*.db`, `eval/results/test-frozen.json`, `LICENSE`, anything under `node_modules/`. Ask before adding a dependency; prefer stdlib or an installed package.

## Workflow
- Work from the phase file in `docs/phases/` (or `docs/phases/expansion/`). One task at a time; run `npm run typecheck && npm test` before every commit.
- Spec → plan → tasks: if a task is ambiguous or contradicts a doc, **stop and list the ambiguity** (add to the phase's Risks) instead of guessing.
- Acceptance criteria are in `docs/acceptance-criteria.md` (EARS). A feature is done only when its criteria have a passing test.
- Commits: conventional (`feat(engine): …`). Small, one concern each. Tag phase completion `phase-N-done`.

## Style
TypeScript strict, ESM, no `any` in `packages/*`. File names `camelCase.ts`; React components `PascalCase.tsx`. Errors are typed (`ToolError` codes in `packages/shared`). Logs via the shared logger, never `console.log` in packages.

## Where things are
`docs/prd.md` (what/why) · `docs/architecture.md` (how) · `docs/api-spec.md` (contracts) · `docs/detection-engine.md` · `docs/policy-and-approvals.md` · `docs/family-console.md` · `docs/guard-sdk.md` · `docs/testing.md` · `docs/observability-and-quality.md` · `docs/rules-digest.md` (hackathon rules).
