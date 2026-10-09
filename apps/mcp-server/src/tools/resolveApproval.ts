import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { holdStatusSchema, requireApprover } from './shared';

export function registerResolveApproval(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'resolve_approval',
    title: 'Approve or deny a held action',
    description:
      'Records a family approver\'s decision. approve releases the action, deny cancels it. Only family members with approval rights ' +
      'can decide (never the elder). A hold can be resolved once; expired holds stay blocked.',
    input: {
      holdId: idSchema,
      decision: z.enum(['approve', 'deny']),
      resolvedBy: idSchema,
      note: z.string().trim().max(300).optional(),
    },
    output: { holdId: z.string(), decision: z.enum(['approve', 'deny']), status: holdStatusSchema, resolvedAt: z.string() },
    annotations: { title: 'Approve or deny a held action', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    handler: ({ holdId, decision, resolvedBy, note }) => {
      const hold = deps.repos.holds.get(holdId);
      if (!hold) throw new ToolError('NOT_FOUND', `hold ${holdId} not found`);
      requireApprover(deps, hold.household_id, resolvedBy);
      const done = deps.repos.holds.resolve(holdId, decision, resolvedBy, note);
      return { holdId, decision, status: done.status, resolvedAt: done.resolved_at ?? deps.repos.now() };
    },
  });
}
