import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { localDay } from '@second-opinion/policy';
import type { Signal } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool } from './define';
import { holdStatusSchema, householdIdSchema, requireHousehold } from './shared';

const DAY_MS = 24 * 60 * 60 * 1000;

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

export function registerHouseholdInsights(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'household_insights',
    title: 'Household protection summary',
    description:
      'Summarises what Second Opinion did for the household over the last N days: dollars protected (denied or expired holds), checks per day by verdict, ' +
      'holds by status, the most common scam signals and the median family response time. Read-only.',
    input: { householdId: householdIdSchema, days: z.number().int().min(1).max(90).optional() },
    output: {
      days: z.number().int(),
      protectedCents: z.number(),
      checksByDay: z.array(z.object({ date: z.string(), allow: z.number(), caution: z.number(), hold: z.number() })),
      holdsByStatus: z.record(holdStatusSchema, z.number()),
      topSignals: z.array(z.object({ id: z.string(), count: z.number() })),
      medianResponseSec: z.number().nullable(),
    },
    annotations: { title: 'Household protection summary', readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, days }) => {
      requireHousehold(deps, householdId);
      const n = days ?? 30;
      const now = deps.clock();
      const since = new Date(now.getTime() - n * DAY_MS).toISOString();
      const tz = deps.repos.policies.get(householdId).timezone;

      const byDay = new Map<string, { date: string; allow: number; caution: number; hold: number }>();
      for (const c of deps.repos.insights.checksSince(householdId, since)) {
        const date = localDay(new Date(c.created_at), tz);
        const row = byDay.get(date) ?? { date, allow: 0, caution: 0, hold: 0 };
        row[c.verdict] += 1;
        byDay.set(date, row);
      }

      const holds = deps.repos.insights.holdsSince(householdId, since);
      const holdsByStatus: Record<string, number> = { pending: 0, approved: 0, denied: 0, expired: 0, released: 0 };
      let protectedCents = 0;
      const responseSec: number[] = [];
      for (const h of holds) {
        holdsByStatus[h.status] = (holdsByStatus[h.status] ?? 0) + 1;
        if (h.status === 'denied' || h.status === 'expired') protectedCents += h.amount_cents ?? 0;
        if (h.resolved_at && (h.status === 'denied' || h.status === 'released')) {
          responseSec.push((Date.parse(h.resolved_at) - Date.parse(h.created_at)) / 1000);
        }
      }

      const counts = new Map<string, number>();
      for (const r of deps.repos.insights.reasonsSince(householdId, since)) {
        const signals = (JSON.parse(r.reasons_json) as { signals?: Signal[] }).signals ?? [];
        for (const s of signals) if (s.weight > 0) counts.set(s.id, (counts.get(s.id) ?? 0) + 1);
      }
      const topSignals = [...counts.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count || (a.id < b.id ? -1 : 1)).slice(0, 8);

      return {
        days: n,
        protectedCents,
        checksByDay: [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : 1)),
        holdsByStatus: holdsByStatus as Record<'pending' | 'approved' | 'denied' | 'expired' | 'released', number>,
        topSignals,
        medianResponseSec: median(responseSec),
      };
    },
  });
}
