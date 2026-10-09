import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool } from './define';
import { householdIdSchema, requireHousehold } from './shared';

export function registerGetHousehold(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'get_household',
    title: 'Get the household and its people',
    description: 'Returns the household and the people in it: the elder, and the family members who can approve, with their approval rank. Read-only.',
    input: { householdId: householdIdSchema },
    output: {
      household: z.object({ id: z.string(), name: z.string() }),
      people: z.array(
        z.object({
          id: z.string(), name: z.string(), role: z.enum(['elder', 'family']), canApprove: z.boolean(),
          approverRank: z.number().int(), contactLabel: z.string().nullable(),
        }),
      ),
    },
    annotations: { title: 'Get the household and its people', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId }) => {
      requireHousehold(deps, householdId);
      const h = deps.repos.households.get(householdId)!;
      return {
        household: { id: h.id, name: h.name },
        people: deps.repos.people.list(householdId).map((p) => ({
          id: p.id, name: p.name, role: p.role, canApprove: p.can_approve === 1, approverRank: p.approver_rank, contactLabel: p.contact_label,
        })),
      };
    },
  });
}
