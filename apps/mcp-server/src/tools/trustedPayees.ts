import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PAYEE_KINDS, ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { householdIdSchema, requireApprover, requireHousehold } from './shared';

export function registerTrustedPayees(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'trusted_payees',
    title: 'List or edit the trusted payee list',
    description:
      'Trusted payees (e.g. the pharmacy) lower a request\'s risk score but never override hard rules such as gift cards. ' +
      'list is open; add and remove require requestedBy to be a family approver.',
    input: {
      householdId: householdIdSchema,
      action: z.enum(['list', 'add', 'remove']),
      name: z.string().trim().min(1).max(100).optional(),
      kind: z.enum(PAYEE_KINDS).optional(),
      requestedBy: idSchema.optional(),
    },
    output: { payees: z.array(z.object({ id: z.string(), name: z.string(), kind: z.enum(PAYEE_KINDS) })) },
    annotations: { title: 'List or edit the trusted payee list', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, action, name, kind, requestedBy }) => {
      requireHousehold(deps, householdId);
      if (action !== 'list') {
        if (!requestedBy) throw new ToolError('INVALID_INPUT', 'requestedBy is required for add and remove');
        requireApprover(deps, householdId, requestedBy);
        if (!name) throw new ToolError('INVALID_INPUT', 'name is required for add and remove');
        if (action === 'add') {
          deps.repos.payees.add(householdId, name, kind ?? 'other');
          deps.repos.audit.write('payee.added', householdId, { name, by: requestedBy });
        } else {
          deps.repos.payees.remove(householdId, name);
          deps.repos.audit.write('payee.removed', householdId, { name, by: requestedBy });
        }
      }
      return { payees: deps.repos.payees.list(householdId).map((p) => ({ id: p.id, name: p.name, kind: p.kind })) };
    },
  });
}
