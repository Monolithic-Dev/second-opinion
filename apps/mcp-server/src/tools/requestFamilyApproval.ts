import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { holdStatusSchema, requireApprover } from './shared';

export function registerRequestFamilyApproval(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'request_family_approval',
    title: 'Ask a family member to approve a held action',
    description:
      'Notifies a trusted family approver about a pending hold. The notification is simulated in this build ' +
      '(an audit event and a live event for the family view). Defaults to the first approver in the household.',
    input: { holdId: idSchema, approverId: idSchema.optional() },
    output: { holdId: z.string(), status: holdStatusSchema, notified: z.array(z.string()) },
    annotations: { title: 'Ask a family member to approve a held action', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: ({ holdId, approverId }) => {
      const hold = deps.repos.holds.get(holdId);
      if (!hold) throw new ToolError('NOT_FOUND', `hold ${holdId} not found`);
      if (hold.status !== 'pending') throw new ToolError('CONFLICT', `hold ${holdId} is already ${hold.status}`);
      const id = approverId ?? deps.repos.people.approvers(hold.household_id)[0]?.id;
      if (!id) throw new ToolError('INVALID_INPUT', 'this household has no approver configured');
      const approver = requireApprover(deps, hold.household_id, id);
      deps.repos.holds.setApprover(holdId, approver.id);
      deps.repos.audit.write('approval.requested', hold.household_id, { holdId, approverId: approver.id });
      return { holdId, status: hold.status, notified: [approver.id] };
    },
  });
}
