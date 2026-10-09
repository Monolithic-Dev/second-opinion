import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { patchPolicy, validatePolicy, type Policy } from '@second-opinion/policy';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { householdIdSchema, requireApprover, requireHousehold } from './shared';

export const policySchema = z.object({
  maxSingleCents: z.number().int(),
  dailyCapCents: z.number().int(),
  newPayeeCooloffMin: z.number().int(),
  requireApprovalAboveCents: z.number().int(),
  quietHoursStart: z.string(),
  quietHoursEnd: z.string(),
  timezone: z.string(),
  quorum: z.number().int(),
  escalateAfterMin: z.number().int(),
  holdTtlMin: z.number().int(),
});

/** Same fields, all optional, no unknown keys. Range checks live in validatePolicy. */
const policyPatchSchema = z
  .object({
    maxSingleCents: z.number().int(),
    dailyCapCents: z.number().int(),
    newPayeeCooloffMin: z.number().int(),
    requireApprovalAboveCents: z.number().int(),
    quietHoursStart: z.string(),
    quietHoursEnd: z.string(),
    timezone: z.string(),
    quorum: z.union([z.literal(1), z.literal(2)]),
    escalateAfterMin: z.number().int(),
    holdTtlMin: z.number().int(),
  })
  .partial()
  .strict();

export function registerPolicyTools(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'get_policy',
    title: 'Get the household protection policy',
    description: 'Returns the household policy (payment limits, daily cap, new-payee cool-off, quiet hours, quorum, escalation). Defaults apply until a policy is saved. Read-only.',
    input: { householdId: householdIdSchema },
    output: { policy: policySchema, isDefault: z.boolean() },
    annotations: { title: 'Get the household protection policy', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId }) => {
      requireHousehold(deps, householdId);
      const saved = deps.db.prepare('SELECT 1 FROM policies WHERE household_id = ?').get(householdId);
      return { policy: deps.repos.policies.get(householdId), isDefault: !saved };
    },
  });

  defineTool(server, deps, {
    name: 'set_policy',
    title: 'Change the household protection policy',
    description:
      'Updates policy fields for the household. Only a family approver can change it. The policy can only add friction around a risk verdict, ' +
      'never remove it. Values are range-checked; a quorum larger than the number of approvers is refused. Returns the new policy and the fields that changed.',
    input: { householdId: householdIdSchema, requestedBy: idSchema, patch: policyPatchSchema },
    output: { policy: policySchema, changed: z.array(z.string()) },
    annotations: { title: 'Change the household protection policy', readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, requestedBy, patch }) => {
      requireHousehold(deps, householdId);
      requireApprover(deps, householdId, requestedBy);
      const current = deps.repos.policies.get(householdId);
      const { policy: next, changed } = patchPolicy(current, patch as Partial<Policy>);
      if (changed.length === 0) return { policy: current, changed: [] as string[] };
      const check = validatePolicy(next, deps.repos.people.approvers(householdId).length);
      if (!check.ok) throw new ToolError('INVALID_INPUT', check.errors.join('; '));
      deps.repos.policies.upsert(householdId, next, requestedBy);
      deps.repos.audit.write('policy.updated', householdId, {
        by: requestedBy,
        changes: Object.fromEntries(changed.map((k) => [k, { from: current[k], to: next[k] }])),
      });
      return { policy: next, changed: changed as string[] };
    },
  });
}
