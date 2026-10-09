# Guard SDK (shipped) — `packages/guard-sdk`

**Status:** implemented with 10 contract tests (`packages/guard-sdk/test/guard.test.ts`) and a working merchant example (`examples/freshmart-mcp`, 3 tests). Differences from the plan below: `createGuard` also accepts a `caller` (so other transports and tests can plug in), `GuardClient` and npm publishing are not done, and `protect` returns a tool result with `isError` for blocked/unverified. See [packages/guard-sdk/README.md](../packages/guard-sdk/README.md).

**Idea:** Alexa+ integrations are MCP servers. Any brand with a money-moving tool (`place_order`, `send_payment`) can add Second Opinion in a few lines. This turns the project from "an app" into an **ecosystem component** — strong for Quality of the Idea ("understanding of the developer ecosystem") and a natural Open Source artifact.

## API
```ts
import { createGuard } from '@second-opinion/guard-sdk';

const guard = createGuard({
  url: process.env.SO_URL!,            // Second Opinion MCP endpoint
  token: process.env.SO_TOKEN!,
  householdId: 'hh_demo',
  failMode: 'closed',                  // default: if guard unreachable, do NOT run the action
  timeoutMs: 3000,
});

server.registerTool('place_order', { inputSchema }, guard.protect(
  async (args, extra) => realPlaceOrder(args),          // your existing handler
  { describe: (a) => ({ actionType: 'purchase', amountCents: a.totalCents, payee: a.merchant, text: a.note ?? '' }) }
));
```
### Behaviour of `guard.protect(handler, opts)`
1. Build action via `opts.describe(args)`.
2. `check_message` (+ policy decision server-side).
3. `allow` ⇒ run `handler`; `require_approval` ⇒ `place_hold` + `request_family_approval`, return tool result `{status:'held', holdId, message, reasons}` **without** running `handler`; `block` ⇒ return `{status:'blocked', message}`.
4. Errors/timeouts ⇒ per `failMode`: `closed` (default) returns `{status:'unverified'}` and does not run; `open` runs (documented as unsafe).
5. After approval, `guard.release(holdId, handler)` re-runs the stored handler with the original args if the hold is `approved` (SDK keeps args in memory for `pendingTtlMs`; production would persist).

### Other exports
`GuardClient` (typed wrapper over the six + policy tools), `GuardError` (`code`), `types` re-exported from `@second-opinion/shared`.

## Example server (`examples/freshmart-mcp`)
A merchant MCP server ("FreshMart") exposing `search_products`, `place_order`. `place_order` is wrapped in 10 lines. Demo clip: the simulator's agent orders "$900 of gift cards" from FreshMart ⇒ held by Second Opinion; "$24 of groceries" ⇒ allowed. Shows the guard is reusable, not hard-coded to our own tools.

## Tests
`guard.test.ts`: `allow runs handler once`, `hold does not run handler`, `block never runs handler`, `failMode closed on timeout`, `failMode open runs handler (documented)`, `release runs handler only if approved`, `release is idempotent (single execution)`, `describe error fails closed`. Contract test against a real in-process `mcp-server`.

## Packaging
`package.json` with `exports`, `types`, `files`, MIT license, README with the 10-line quick start; `npm pack` verified in CI. Publishing to npm is optional (Tier 2); the repo link is enough for the Open Source narrative. Mention in the Open Source mini-challenge description: bench dataset **and** SDK.
