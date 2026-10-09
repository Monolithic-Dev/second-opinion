# X4 — Guard SDK and merchant example (Tier 1)

**Goal / done:** `@second-opinion/guard-sdk` wraps any MCP tool handler with the hold-and-approve gate; `examples/freshmart-mcp` shows a third-party merchant server protected in ~10 lines; demo shows a *different* MCP server being guarded.
**Preconditions:** Phase 3 (tools); X2 helpful for policy outcomes (`require_approval`/`block`).
**Implements:** `guard-sdk.md` (all), AC-30, AC-31, Open Source narrative.

## Task breakdown
1. **Package scaffold** `packages/guard-sdk`: `package.json` (`name @second-opinion/guard-sdk`, `exports`, `types`, `files`, MIT), `tsconfig` build to `dist` (ESM + d.ts), deps `@modelcontextprotocol/sdk`, `@second-opinion/shared`.
2. **`client.ts`**: `class GuardClient` over `StreamableHTTPClientTransport` with bearer token, timeouts, `x-request-id`; typed methods `check`, `placeHold`, `requestApproval`, `getHold`; errors → `GuardError {code, cause}`.
3. **`guard.ts`**: `createGuard(opts)` returning `{ protect, release, client }`. `protect(handler, {describe, onHeld?})` implements: describe → check → decide (`allow`: run handler; `require_approval`: place hold + request approval, store `{holdId → {args, extra, handler}}` in an LRU with `pendingTtlMs` (default 15 min), return held result; `block`: return blocked result) → `failMode` semantics. Held/blocked/unverified results use the MCP tool result shape with `structuredContent {status, holdId?, reasons?}` and `isError:false` (a hold is a valid outcome) so agents relay it to users.
4. **`release(holdId)`**: fetch hold; if `approved`, run stored handler **exactly once** (idempotency by deleting from the map before invoking and re-adding on failure); if `pending` return `pending`; if `denied|expired` return `cancelled`.
5. **Example** `examples/freshmart-mcp`: `src/index.ts` (own port 3002, bearer auth), tools `search_products` (static catalogue of ~10 items) and `place_order` (`items[]`, `totalCents`, `merchant`, `note`) wrapped with `guard.protect`; handler writes an order to an in-memory list and returns `{orderId}`.
6. **Simulator integration**: `McpGateway` supports multiple servers (`SO_URL`, `FRESHMART_URL`); router intent `ORDER` ("order/buy groceries/gift cards from FreshMart") calls `place_order`; when result `status:'held'` the reply uses the standard card + trace shows both servers; family approval triggers `guard.release` via a small `/api/merchant/release` BFF call.
7. **Docs**: package README with 10-line quick start, API table, failMode warning; add link in root README.
8. **Tests** (`guard.test.ts` with real in-process MCP server): `T-G-1 allow runs handler once`, `T-G-2 hold does not run handler`, `T-G-3 block never runs`, `T-G-4 fail closed on timeout`, `T-G-5 fail open runs and warns`, `T-G-6 release runs handler once when approved`, `T-G-7 release is idempotent (double call → one execution)`, `T-G-8 denied hold cancels and never runs`, `T-G-9 describe() throwing fails closed`, `T-G-10 pending TTL eviction`; example integration test: `$900 gift cards via FreshMart is held; $24 groceries completes`.
9. **CI**: `npm pack --dry-run -w packages/guard-sdk` verifies publishable contents.

## Real-world engineering concerns
Exactly-once handler execution (map removal before call); never leak token in errors; bounded memory (LRU 500); timeouts and abort signals; result shape stable for agents.

## Definition of done
- [ ] Guard tests green; `npm pack` produces a tarball containing `dist/` and README only.
- [ ] Demo: "Order $900 of gift cards from FreshMart" is held and appears in the family console; after Approve the order is created once; "$24 groceries" completes immediately.
- [ ] The root README shows the 10-line integration.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Looks like extra complexity | It is the ecosystem story; cut `release()` persistence, keep in-memory |
| Agent confusion about held results | Clear `message` text + `status` enum documented |

## Time budget
6 h. Cut first: `onHeld` hook, LRU TTL test, npm pack CI step.

## Handoff
Phase 6 can reference the SDK and example in the video, the Open Source mini-challenge text, and README. Tag `x4-done`.
