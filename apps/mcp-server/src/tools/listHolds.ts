import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FLAG_TEXT, isPositive } from '@second-opinion/engine';
import type { Signal } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { cap, defineTool } from './define';
import { holdStatusSchema, householdIdSchema, requireHousehold } from './shared';

export function registerListHolds(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'list_holds',
    title: 'List held actions',
    description: 'Lists held payments/purchases for a household, newest first, optionally filtered by status. Read-only.',
    input: { householdId: householdIdSchema, status: holdStatusSchema.optional() },
    output: {
      holds: z.array(
        z.object({
          holdId: z.string(),
          status: holdStatusSchema,
          description: z.string(),
          amountCents: z.number().nullable(),
          payee: z.string().nullable(),
          flags: z.array(z.string()),
          approverId: z.string().nullable(),
          createdAt: z.string(),
          expiresAt: z.string(),
        }),
      ),
      truncated: z.boolean(),
    },
    annotations: { title: 'List held actions', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, status }) => {
      requireHousehold(deps, householdId);
      const { items, truncated } = cap(deps.repos.holds.listByStatus(householdId, status));
      const holds = items.map((h) => {
        const check = deps.repos.checks.get(h.check_id);
        const signals = check ? (JSON.parse(check.signals_json) as Signal[]) : [];
        const flags = signals.filter((s) => isPositive(s.id) && s.weight > 0).map((s) => FLAG_TEXT[s.id]).filter((f): f is string => Boolean(f));
        return {
          holdId: h.id, status: h.status, description: h.description, amountCents: h.amount_cents, payee: h.payee, flags,
          approverId: h.approver_id, createdAt: h.created_at, expiresAt: h.expires_at,
        };
      });
      return { holds, truncated };
    },
  });
}
