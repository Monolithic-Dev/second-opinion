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
### FL-1 — better-sqlite3 has no usable prebuilt binary in a fresh Node 22 Docker image
Tool/API/SDK: better-sqlite3 (native module) on `node:22-slim`
Task attempted: build a Docker image that runs `npm ci`.
Steps taken: `FROM node:22-slim`, `COPY`, `RUN npm ci`.
Expected: the prebuilt binary is downloaded and install finishes.
Actual: `node-gyp rebuild` ran and failed with "gyp ERR! find Python" (no python, make or g++ in the slim image).
Severity: major (the build fails outright)
Workaround used: install `python3 make g++` in the build stage, build there, copy `node_modules` into the runtime stage.
Suggestion (actionable): the error should say that no prebuilt binary matched this Node version and name the OS packages needed; the README could include the slim-image recipe.
Date / time spent lost: 2026-10-09, about 15 minutes.

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
