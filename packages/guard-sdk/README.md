# @second-opinion/guard-sdk

Add a family safety check to any MCP tool that moves money, in a few lines.

```ts
import { createGuard } from '@second-opinion/guard-sdk';

const guard = createGuard({ url: process.env.SO_URL!, token: process.env.SO_TOKEN!, householdId: 'hh_demo' });

server.registerTool('place_order', { inputSchema }, guard.protect(
  async (args) => realPlaceOrder(args),                       // your existing handler, unchanged
  { describe: (a) => ({ actionType: 'purchase', amountCents: a.totalCents, payee: 'FreshMart', text: a.note ?? '' }) },
));
```

| Second Opinion says | Your handler | Caller gets |
|---|---|---|
| allow | runs once | your normal result |
| hold / needs approval | **does not run**; a hold is created and a family member is asked | `{ status: 'held', holdId }` |
| blocked by household rules | **does not run** | error `{ status: 'blocked' }` |
| unreachable, timeout, or `describe` throws | **does not run** (`failMode: 'closed'`, the default) | error `{ status: 'unverified' }` |

`guard.release(holdId)` runs the stored handler once, only if a family approver has released the hold (never twice, even concurrently). Pending actions live in memory for `pendingTtlMs` (24h); a production merchant would persist them.

`failMode: 'open'` runs the handler when the guard is unreachable. It exists for completeness and is unsafe.

A complete example is in [`examples/freshmart-mcp`](../../examples/freshmart-mcp). Tests run the SDK against a real in-process Second Opinion server (`test/guard.test.ts`).
