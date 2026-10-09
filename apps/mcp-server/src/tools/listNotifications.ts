import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Deps } from '../deps';
import { cap, defineTool, idSchema } from './define';
import { householdIdSchema, requireHousehold } from './shared';

export function registerListNotifications(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'list_notifications',
    title: 'List approver notifications',
    description:
      'Lists notifications queued for family approvers (new request, escalation, final outcome) with delivery status. Delivery is simulated: ' +
      'the in-app inbox is these rows and emails are rendered to files, nothing is sent. Read-only.',
    input: { householdId: householdIdSchema, recipientId: idSchema.optional(), limit: z.number().int().min(1).max(200).optional() },
    output: {
      notifications: z.array(
        z.object({
          id: z.string(),
          recipientId: z.string(),
          channel: z.enum(['console', 'db', 'email_html']),
          kind: z.enum(['hold_requested', 'hold_escalated', 'hold_resolved']),
          status: z.enum(['queued', 'sent', 'failed']),
          attempts: z.number().int(),
          holdId: z.string(),
          description: z.string(),
          createdAt: z.string(),
          sentAt: z.string().nullable(),
        }),
      ),
      truncated: z.boolean(),
    },
    annotations: { title: 'List approver notifications', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, recipientId, limit }) => {
      requireHousehold(deps, householdId);
      const { items, truncated } = cap(deps.repos.notifications.list(householdId, { recipientId, limit: limit ?? 50 }));
      return {
        notifications: items.map((n) => {
          const p = JSON.parse(n.payload_json) as { holdId: string; description: string };
          return {
            id: n.id, recipientId: n.recipient_id, channel: n.channel, kind: n.kind, status: n.status, attempts: n.attempts,
            holdId: p.holdId, description: p.description, createdAt: n.created_at, sentAt: n.sent_at,
          };
        }),
        truncated,
      };
    },
  });
}
