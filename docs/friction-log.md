# Friction log (up to +10% judging bonus)

Write an entry **the moment** something annoys you. Specific, reproducible, actionable entries score; vague ones don't.

## Entry template
```
### FL-<n> — <short title>
Tool/API/SDK: <e.g. MCP TypeScript SDK 1.x>
Task attempted:
Steps taken:
Expected:
Actual:
Severity: blocker | major | minor | cosmetic
Workaround used:
Suggestion (actionable):
Date / time spent lost:
```

## Entries
### FL-1 — npm tries to compile better-sqlite3 even though it ships prebuilt binaries
Tool/API/SDK: better-sqlite3 13.0.3 (native module), npm 10 / Node 22.16 on Windows, and `node:22-slim` in Docker
Task attempted: `npm install` on a clean clone.
Steps taken: `git clone`, `npm install`.
Expected: the bundled prebuilt binary is used.
Actual: the package has a `binding.gyp` and no `install` script, so npm runs `node-gyp rebuild` by default. It fails with "could not find Visual Studio" on Windows and "find Python" in the slim Docker image, even though `prebuilds/win32-x64.node` and `linux-x64.node` are inside the package.
Severity: major (a judge's first command fails)
Workaround used: tried `ignore-scripts=true` in `.npmrc` first; that broke Linux because our lockfile relies on esbuild's postinstall to fetch its platform binary. Final fix: dropped the native module and moved to Node's built-in `node:sqlite` (decision D20).
Suggestion (actionable): add an explicit no-op `"install"` script (or a prebuild check) to the package so npm does not fall back to node-gyp, and document it in the README.
Date / time spent lost: 2026-10-09, about 45 minutes (found only by testing a clean clone).

### FL-2 — a workflow cannot check out another private repository with the default token
Tool/API/SDK: GitHub Actions `actions/checkout@v4`
Task attempted: CI for the product repo checks out the benchmark repo to run a regression gate.
Steps taken: `repository: Monolithic-Dev/scam-script-bench` with `path: .bench`, both repos private.
Expected: the checkout works inside the same owner.
Actual: "Repository not found" (the job token only reaches the current repo).
Severity: minor (the tests skip, but the gate silently stops running)
Workaround used: `continue-on-error: true` on that step and tests that skip when the checkout is missing, plus a comment; the proper fix is making the bench public or adding a read token secret.
Suggestion (actionable): the error text could say "the default GITHUB_TOKEN cannot read other private repositories; use a PAT or deploy key" instead of a generic not-found.
Date / time spent lost: 2026-10-09, about 20 minutes (one failed run, one wrong assumption about the cause).

### FL-3 — registerTool handler types reject a plain result type without an index signature
Tool/API/SDK: `@modelcontextprotocol/sdk` 1.32.1, `McpServer.registerTool`
Task attempted: wrap a tool handler in a helper that may return either the handler's own result or a "held" result.
Steps taken: declared a `ToolResultLike` interface with `content`, `structuredContent`, `isError`.
Expected: assignable to `CallToolResult`.
Actual: TS2345 "Index signature for type 'string' is missing in type 'ToolResultLike'" with a very long union in the message.
Severity: cosmetic (compile-time only)
Workaround used: add `[key: string]: unknown;` to the interface.
Suggestion (actionable): export a documented helper type for tool results (or document the index-signature requirement next to `registerTool`).
Date / time spent lost: 2026-10-09, about 5 minutes.

Seed prompts of where friction usually appears: finding how outsiders test against Alexa+; MCP spec version vs SDK version; Streamable HTTP session handling; Agent Skill packaging for Alexa+; Bedrock model access approval; Bedrock Converse tool-spec format; MCP Inspector auth headers.
