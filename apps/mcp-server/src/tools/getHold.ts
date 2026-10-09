import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { FLAG_TEXT, isPositive } from '@second-opinion/engine';
import { REASON_TEXT, type ReasonCode } from '@second-opinion/policy';
import { ToolError, type Signal } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool, idSchema } from './define';
import { holdStatusSchema } from './shared';

/** Audit event types that belong on a hold's timeline, with the sentence shown to a family member. */
const TIMELINE_TEXT: Record<string, string> = {
  'hold.created': 'Request paused',
  'approval.requested': 'Family asked to review',
  'approval.vote': 'Vote recorded',
  'hold.escalated': 'Escalated to the next approver',
  'hold.resolved': 'Decision made',
  'hold.expired': 'Expired (stays blocked)',
};

export function registerGetHold(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'get_hold',
    title: 'Get one held action with its votes and timeline',
    description:
      'Returns a held payment/purchase with the risk flags, household-rule reasons, every approver vote (who, decision, note), and a timeline of what ' +
      'happened and when. Read-only.',
    input: { holdId: idSchema },
    output: {
      hold: z.object({
        holdId: z.string(), householdId: z.string(), status: holdStatusSchema, description: z.string(), amountCents: z.number().nullable(),
        payee: z.string().nullable(), actionType: z.string(), quorumRequired: z.number().int(), escalationLevel: z.number().int(),
        createdAt: z.string(), expiresAt: z.string(), resolvedAt: z.string().nullable(), resolvedBy: z.string().nullable(), note: z.string().nullable(),
      }),
      risk: z.object({ verdict: z.enum(['allow', 'caution', 'hold']), score: z.number().int(), flags: z.array(z.string()), reasonText: z.array(z.string()), text: z.string() }),
      votes: z.array(z.object({ approverId: z.string(), name: z.string(), decision: z.enum(['approve', 'deny']), note: z.string().nullable(), decidedAt: z.string() })),
      timeline: z.array(z.object({ type: z.string(), label: z.string(), at: z.string(), by: z.string().nullable() })),
    },
    annotations: { title: 'Get one held action with its votes and timeline', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    handler: ({ holdId }) => {
      const h = deps.repos.holds.get(holdId);
      if (!h) throw new ToolError('NOT_FOUND', `hold ${holdId} not found`);
      const check = deps.repos.checks.get(h.check_id);
      const signals = check ? (JSON.parse(check.signals_json) as Signal[]) : [];
      const flags = signals.filter((s) => isPositive(s.id) && s.weight > 0).map((s) => FLAG_TEXT[s.id]).filter((f): f is string => Boolean(f));
      const reasonText = (JSON.parse(h.reasons_json) as ReasonCode[]).map((r) => REASON_TEXT[r]).filter(Boolean);
      const name = (id: string | null) => (id ? (deps.repos.people.get(id)?.name ?? id) : null);

      const votes = deps.repos.approvals.list(holdId).map((v) => ({
        approverId: v.approver_id, name: name(v.approver_id) ?? v.approver_id, decision: v.decision, note: v.note, decidedAt: v.decided_at,
      }));
      const timeline = deps.repos
        .audit.forHold(h.household_id, holdId)
        .filter((e) => e.type in TIMELINE_TEXT)
        .map((e) => {
          const p = JSON.parse(e.payload_json) as { approverId?: string; resolvedBy?: string; decision?: string; status?: string };
          const by = p.approverId ?? p.resolvedBy ?? null;
          const detail = e.type === 'approval.vote' && p.decision ? ` (${p.decision})` : e.type === 'hold.resolved' && p.status ? ` (${p.status})` : '';
          return { type: e.type, label: `${TIMELINE_TEXT[e.type]}${detail}`, at: e.created_at, by: name(by) };
        });

      return {
        hold: {
          holdId: h.id, householdId: h.household_id, status: h.status, description: h.description, amountCents: h.amount_cents, payee: h.payee,
          actionType: h.action_type, quorumRequired: h.quorum_required, escalationLevel: h.escalation_level, createdAt: h.created_at,
          expiresAt: h.expires_at, resolvedAt: h.resolved_at, resolvedBy: h.resolved_by, note: h.note,
        },
        risk: { verdict: check?.verdict ?? 'allow', score: check?.score ?? 0, flags, reasonText, text: check?.text ?? '' },
        votes,
        timeline,
      };
    },
  });
}
