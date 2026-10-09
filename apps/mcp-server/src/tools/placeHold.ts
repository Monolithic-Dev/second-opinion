import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { holdTtlMs } from '../services/policyService';
import { defineTool, idSchema } from './define';
import { actionTypeSchema, amountSchema, holdStatusSchema, householdIdSchema, requireHousehold } from './shared';

export function registerPlaceHold(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'place_hold',
    title: 'Hold a risky payment or purchase',
    description:
      'Pauses a payment/purchase that check_message rated hold or caution, or that the household policy says needs approval. ' +
      'The action must NOT run until the required family approvers resolve the hold. Holds expire after a timeout and then stay blocked. ' +
      'Requests the policy blocks outright (e.g. daily limit) cannot be held; a family member must act in the family console.',
    input: {
      householdId: householdIdSchema,
      checkId: idSchema,
      actionType: actionTypeSchema,
      amountCents: amountSchema.optional(),
      payee: z.string().trim().max(100).optional(),
      description: z.string().trim().min(1).max(200).describe('Short human description, e.g. "5 x $200 gift cards"'),
    },
    output: { holdId: z.string(), status: holdStatusSchema, expiresAt: z.string(), quorumRequired: z.number().int(), reasons: z.array(z.string()) },
    idempotent: true,
    annotations: { title: 'Hold a risky payment or purchase', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, checkId, actionType, amountCents, payee, description }) => {
      requireHousehold(deps, householdId);
      const check = deps.repos.checks.get(checkId);
      if (!check || check.household_id !== householdId) throw new ToolError('NOT_FOUND', `check ${checkId} not found`);
      const decision = deps.repos.decisions.getByCheck(checkId);
      const outcome = decision?.policy_outcome ?? 'allow';
      const reasons = decision ? (JSON.parse(decision.policy_reasons_json) as string[]) : [];

      if (outcome === 'block') {
        throw new ToolError('FORBIDDEN', `blocked by household policy (${reasons.join(', ')}); a family member must act in the family console`);
      }
      if (check.verdict === 'allow' && outcome === 'allow') {
        throw new ToolError('INVALID_INPUT', 'only checks rated caution or hold, or needing approval by policy, can be held');
      }
      const open = deps.repos.holds.byCheck(checkId).find((h) => h.status === 'pending');
      if (open) throw new ToolError('CONFLICT', `check ${checkId} already has pending hold ${open.id}`);

      const policy = deps.repos.policies.get(householdId);
      const quorumRequired = Math.max(1, Math.min(2, decision?.quorum ?? policy.quorum));
      const hold = deps.repos.holds.create({
        householdId, checkId, actionType, amountCents, payee, description, ttlMs: holdTtlMs(deps, policy), quorumRequired, reasons,
      });
      deps.repos.audit.write('hold.created', householdId, { holdId: hold.id, checkId, verdict: check.verdict, outcome, quorumRequired });
      return { holdId: hold.id, status: hold.status, expiresAt: hold.expires_at, quorumRequired, reasons };
    },
  });
}
