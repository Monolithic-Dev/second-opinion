import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { actionTypeSchema, amountSchema, holdStatusSchema, householdIdSchema, requireHousehold } from './shared';

export function registerPlaceHold(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'place_hold',
    title: 'Hold a risky payment or purchase',
    description:
      'Pauses a payment/purchase that check_message rated hold or caution. The action must NOT run until a family approver ' +
      'resolves the hold. Holds expire after a timeout and then stay blocked.',
    input: {
      householdId: householdIdSchema,
      checkId: idSchema,
      actionType: actionTypeSchema,
      amountCents: amountSchema.optional(),
      payee: z.string().trim().max(100).optional(),
      description: z.string().trim().min(1).max(200).describe('Short human description, e.g. "5 x $200 gift cards"'),
    },
    output: { holdId: z.string(), status: holdStatusSchema, expiresAt: z.string() },
    annotations: { title: 'Hold a risky payment or purchase', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, checkId, actionType, amountCents, payee, description }) => {
      requireHousehold(deps, householdId);
      const check = deps.repos.checks.get(checkId);
      if (!check || check.household_id !== householdId) throw new ToolError('NOT_FOUND', `check ${checkId} not found`);
      if (check.verdict === 'allow') throw new ToolError('INVALID_INPUT', 'only checks rated caution or hold can be held');
      const open = deps.repos.holds.byCheck(checkId).find((h) => h.status === 'pending');
      if (open) throw new ToolError('CONFLICT', `check ${checkId} already has pending hold ${open.id}`);
      const hold = deps.repos.holds.create({
        householdId, checkId, actionType, amountCents, payee, description, ttlMs: deps.config.holdTtlMs,
      });
      deps.repos.audit.write('hold.created', householdId, { holdId: hold.id, checkId, verdict: check.verdict });
      return { holdId: hold.id, status: hold.status, expiresAt: hold.expires_at };
    },
  });
}
