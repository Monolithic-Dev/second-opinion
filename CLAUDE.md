@AGENTS.md

# Claude Code notes
- Start each session by reading `docs/expansion-scope.md` and the current phase file; do not re-read every doc.
- Use plan mode for any task touching more than three files; propose the plan against the phase file's task list first.
- Deterministic guarantees (formatting, blocking commits on failing tests) belong in hooks/CI, not in this file. See `.github/workflows/ci.yml`.
- Prefer small diffs and run `npm run typecheck && npm test` after each task.
