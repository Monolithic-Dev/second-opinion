import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { tally } from '@second-opinion/policy';
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
      "Records one family approver's vote. The hold is released when the required number of distinct approvers approve (quorum 1 or 2) " +
      'and denied as soon as any approver denies. Only family members with approval rights can vote (never the elder). ' +
      'The same vote repeated is a no-op; a changed vote or a vote on a finished hold is a CONFLICT. Expired holds stay blocked.',
    input: {
      holdId: idSchema,
      decision: z.enum(['approve', 'deny']),
      resolvedBy: idSchema,
      note: z.string().trim().max(300).optional(),
    },
    output: {
      holdId: z.string(),
      decision: z.enum(['approve', 'deny']),
      status: holdStatusSchema,
      resolvedAt: z.string().nullable(),
      votes: z.object({ approve: z.number().int(), deny: z.number().int(), required: z.number().int() }),
    },
    idempotent: true,
    annotations: { title: 'Approve or deny a held action', readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
    handler: ({ holdId, decision, resolvedBy, note }) => {
      const hold = deps.repos.holds.get(holdId);
      if (!hold) throw new ToolError('NOT_FOUND', `hold ${holdId} not found`);
      requireApprover(deps, hold.household_id, resolvedBy);
      if (hold.status !== 'pending') throw new ToolError('CONFLICT', `hold ${holdId} is already ${hold.status}`);

      const existing = deps.repos.approvals.list(holdId).find((v) => v.approver_id === resolvedBy);
      if (existing && existing.decision !== decision) {
        throw new ToolError('CONFLICT', `${resolvedBy} already voted ${existing.decision} on this hold`);
      }
      if (!existing) {
        deps.repos.approvals.add(holdId, resolvedBy, decision, note);
        deps.repos.audit.write('approval.vote', hold.household_id, { holdId, approverId: resolvedBy, decision });
      }

      const t = tally(
        deps.repos.approvals.list(holdId).map((v) => ({ approverId: v.approver_id, decision: v.decision })),
        hold.quorum_required,
      );
      const votes = { approve: t.approvals, deny: t.denials, required: t.required };
      if (t.state === 'pending') return { holdId, decision, status: hold.status, resolvedAt: null, votes };

      const final = deps.repos.holds.finalize(holdId, t.state === 'approved' ? 'released' : 'denied', resolvedBy, note);
      return { holdId, decision, status: final.status, resolvedAt: final.resolved_at, votes };
    },
  });
}
