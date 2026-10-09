# MCP best practices applied to this project

Researched Oct 9 2026 from the official spec ([2025-11-25 changelog](https://modelcontextprotocol.io/specification/2025-11-25/changelog), [transports](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools), [security best practices](https://modelcontextprotocol.io/specification/2025-11-25/basic/security_best_practices)), the [TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) / [v2 docs](https://ts.sdk.modelcontextprotocol.io/v2), and community guides ([production architecture](https://www.sitepoint.com/building-production-mcp-servers-in-typescript/), [TypeScript production guide](https://theroadtoenterprise.com/blog/build-mcp-server-typescript), [OAuth 2.1 + Streamable HTTP](https://nerdleveltech.com/mcp-server-typescript-oauth-streamable-http-production-tutorial), [contract testing](https://qaskills.sh/blog/mcp-server-contract-testing-guide)). Secondary sources are tagged as rules of thumb.

## 1. Transport (Streamable HTTP, spec 2025-11-25)
| Rule (source) | Our implementation |
|---|---|
| One MCP endpoint path supporting POST and GET (spec MUST) | `/mcp`; POST handles JSON-RPC; GET and DELETE return **405** because we are stateless and offer no standalone SSE stream (spec permits 405) |
| Validate `Origin`; invalid ⇒ **403** (spec MUST, changed in 2025-11-25) | `originGuard` middleware with allow-list `MCP_ALLOWED_ORIGINS`; requests without `Origin` are allowed (non-browser clients) |
| Bind to `127.0.0.1` when local (spec SHOULD) | `HOST` default `127.0.0.1`; Docker sets `0.0.0.0` + explicit allowed hosts |
| Authenticate all connections (SHOULD) | Bearer token (`MCP_AUTH_TOKEN`); production note below |
| Client sends `MCP-Protocol-Version` header; invalid/unsupported ⇒ **400** | Check header on non-initialize requests; accept `2025-11-25` and the SDK's other supported versions; reject unknown with 400 |
| Session IDs optional; MUST NOT be used for authentication | **Stateless**: new `McpServer` + transport per request (`sessionIdGenerator: undefined`). No server-side session state; household context travels in tool arguments and is authorised by token |
| Response is JSON or SSE; client must support both | Use `enableJsonResponse: true` (plain JSON) for predictable behavior in tests and simple clients |
| SSE deprecated; stdio for local single-user | We ship Streamable HTTP only; stdio optional (Tier 2) for Claude Desktop testing |
| Graceful shutdown on SIGTERM/SIGINT; drain in-flight (guide, rule of thumb) | `shutdown()` closes HTTP server, stops jobs, closes DB |

## 2. Tool design
| Rule | Our implementation |
|---|---|
| Names 1–128 chars, `[A-Za-z0-9_.-]`, unique (spec SHOULD, SEP-986) | `snake_case` names in `api-spec.md` |
| Provide `title` and clear `description` | Every tool has both; descriptions state side effects and fail-closed behavior |
| `inputSchema` must be valid JSON Schema (2020-12 default); no-parameter tools use `{type:'object', additionalProperties:false}` | Generated from zod (`.strict()` objects) |
| `outputSchema` ⇒ server MUST return conforming `structuredContent`; also return serialized JSON in a text block for older clients | All tools declare `outputSchema` (zod) and return `structuredContent` + `content[0].text = JSON.stringify(...)` |
| Input validation errors and business errors are **tool execution errors** (`isError:true`), not protocol errors, so the model can self-correct (SEP-1303) | `ToolError` codes `INVALID_INPUT|NOT_FOUND|FORBIDDEN|CONFLICT|INTERNAL` returned as `isError:true` with text + `structuredContent {code,message}`; protocol errors only for unknown tool/malformed JSON-RPC |
| Annotations are **hints, untrusted by clients**; do not use them as enforcement | Set accurately (table below); enforcement lives in handlers (roles, fail-closed) |
| Cap tool output size (rule of thumb: 256 KiB) | `capOutput()` truncates lists (max 200 items) and sets `truncated:true` |
| Rate-limit tool invocations; sanitize outputs (spec MUST) | per-token token-bucket (60/min default); outputs contain only fictional data and escaped text |
| Pin/diff tool definitions (OWASP draft idea) | Contract snapshot test of `tools/list` including annotations and schemas (hash recorded in CI) |
| Human in the loop for sensitive operations (spec SHOULD) | This *is* the product: `place_hold` + `request_family_approval` |

### Annotation table (`readOnlyHint` / `destructiveHint` / `idempotentHint` / `openWorldHint`)
| Tool | readOnly | destructive | idempotent | openWorld | Notes |
|---|---|---|---|---|---|
| `check_message` | false | false | false | false | writes a check row, audit |
| `place_hold` | false | false | false | false | creates a hold (blocks an action) |
| `request_family_approval` | false | false | true | false | deduped per hold+approver |
| `resolve_approval` | false | **true** | true | false | releases or cancels a financial action; same vote is a no-op |
| `trusted_payees` | false | false | true | false | list/add/remove are idempotent |
| `list_holds` | **true** | false | true | false | |
| `get_policy` | **true** | false | true | false | |
| `set_policy` | false | false | true | false | approver-only |
| `household_insights` | **true** | false | true | false | |

## 3. Resources, prompts, other primitives
- **Resources** for read-only reference data: `so://playbooks`, `so://playbooks/{id}`, `so://household/{id}/summary` (declare `resources` capability; `listChanged` false).
- **Prompt** `guard_instructions` mirrors the Agent Skill so any client can load the same rules.
- **Pagination**: `tools/list` is small (9); resource lists implement `cursor` for >50 items (SDK default).
- **Icons** (new in 2025-11-25): optional on tools/resources; Tier 2.
- **Tasks** (experimental in 2025-11-25) and **elicitation** (URL mode): *not used*. Approval is async by design (family decision), modelled as holds; revisit tasks post-hackathon.

## 4. Security (spec security best practices + OWASP-style rules)
1. **No token passthrough**: the server accepts only tokens issued for itself. Hackathon build uses a static bearer token; production would be an **OAuth 2.1 resource server** publishing RFC 9728 protected-resource metadata, validating audience (RFC 8707) and **minimal scopes** per tool (`so:read`, `so:check`, `so:approve`, `so:admin`), with incremental consent via `WWW-Authenticate`. Documented, not built (Tier 2).
2. **Sessions are not authentication**; we have none. If added, bind IDs to the authenticated principal (`<user_id>:<session_id>`) and use CSPRNG IDs.
3. **Confused deputy / SSRF**: the server makes no outbound requests except optional Bedrock; Guard SDK client only calls the configured URL; block redirects and private ranges if URL is user-supplied.
4. **Authorization inside handlers**, never trusting annotations or client-claimed roles; household access derived from the token (`token → householdIds`), not only from the `householdId` argument (see `security-privacy.md`).
5. **Origin/Host validation** and localhost binding (section 1).
6. **Prompt-injection hygiene**: tool outputs are data; the model never sets verdicts; text rendered with `textContent`.
7. **Audit** every tool call; correlate with `x-request-id`.

## 5. SDK decision (D14)
| Option | Facts | Decision |
|---|---|---|
| `@modelcontextprotocol/sdk` **1.32.1** (npm `latest`) | Mature API (`McpServer`, `registerTool`, `StreamableHTTPServerTransport`), widest tooling/docs, Node ≥ 18 | **Use for the hackathon.** Verify at install that `LATEST_PROTOCOL_VERSION`/supported list includes `2025-11-25` (test T-PROTO-1) |
| `@modelcontextprotocol/server|client|node|express` **2.x** | Split packages implementing the 2026-07-28 "modern" protocol (`server/discover`, no `initialize`) and serving 2025-era traffic through a `legacy` mode; new `createMcpHandler`, `createMcpExpressApp` | Defer. Rules accept "2025-11-25 or later", but docs/tooling are thinner and Inspector/clients may lag. Re-evaluate after Phase 3 if time allows; log friction |

## 6. Project-structure patterns adopted (from guides)
Capability-oriented modules (`tools/`, `resources/`, `prompts/`), registration separate from business logic (handlers are thin: validate → call `packages/*` → shape result), observability and auth as separate modules, a single `buildServer(deps)` factory used by HTTP entry point and tests, and transport wiring kept in `index.ts`. This matches `project-structure.md`.

## 7. Testing patterns adopted
Schema validity before instance validity; invalid-input error types per tool; contract snapshots for `tools/list` (names, schemas, annotations); annotations-vs-behavior test (read-only tools must not change DB row counts); protocol-version tests (`T-PROTO-1` supported version list, `T-PROTO-2` bad `MCP-Protocol-Version` ⇒ 400, `T-PROTO-3` bad Origin ⇒ 403).
