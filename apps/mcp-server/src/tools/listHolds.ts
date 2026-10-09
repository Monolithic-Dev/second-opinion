import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FLAG_TEXT, isPositive } from '@second-opinion/engine';
import { REASON_TEXT, type ReasonCode } from '@second-opinion/policy';
import type { Signal } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { cap, defineTool } from './define';
import { holdStatusSchema, householdIdSchema, requireHousehold } from './shared';

export function registerListHolds(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'list_holds',
    title: 'List held actions',
    description: 'Lists held payments/purchases for a household, newest first, optionally filtered by status, with vote progress and policy reasons. Read-only.',
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
          reasonText: z.array(z.string()),
          approverId: z.string().nullable(),
          quorumRequired: z.number().int(),
          votes: z.object({ approve: z.number().int(), deny: z.number().int() }),
          escalationLevel: z.number().int(),
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
        const reasonText = (JSON.parse(h.reasons_json) as ReasonCode[]).map((r) => REASON_TEXT[r]).filter(Boolean);
        const votes = deps.repos.approvals.list(h.id);
        return {
          holdId: h.id, status: h.status, description: h.description, amountCents: h.amount_cents, payee: h.payee, flags, reasonText,
          approverId: h.approver_id, quorumRequired: h.quorum_required,
          votes: { approve: votes.filter((v) => v.decision === 'approve').length, deny: votes.filter((v) => v.decision === 'deny').length },
          escalationLevel: h.escalation_level, createdAt: h.created_at, expiresAt: h.expires_at,
        };
      });
      return { holds, truncated };
    },
  });
}
