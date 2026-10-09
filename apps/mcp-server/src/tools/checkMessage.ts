import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { evaluate } from '@second-opinion/engine';
import { ToolError } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { defineTool } from './define';
import { actionTypeSchema, amountSchema, cardSchema, channelSchema, householdIdSchema, requireHousehold, signalSchema, similarSchema } from './shared';
import { VERDICTS } from '@second-opinion/shared';

export function registerCheckMessage(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'check_message',
    title: 'Check a message or payment request',
    description:
      'Scores a message or a requested payment/purchase for scam risk using fixed, explainable rules. ' +
      'Returns verdict allow|caution|hold with reasons. Does not execute anything. ' +
      'If the verdict is hold, call place_hold and do NOT carry out the action.',
    input: {
      householdId: householdIdSchema,
      text: z.string().trim().min(1).max(2000).describe('What the person said or received, verbatim'),
      channel: channelSchema.optional(),
      context: z
        .object({ actionType: actionTypeSchema.optional(), amountCents: amountSchema.optional(), payee: z.string().trim().max(100).optional() })
        .optional(),
    },
    output: {
      checkId: z.string(),
      decisionId: z.string(),
      ruleSetVersion: z.string(),
      verdict: z.enum(VERDICTS),
      score: z.number().int(),
      signals: z.array(signalSchema),
      hardRule: z.string().optional(),
      similarTo: similarSchema.nullable(),
      spokenSummary: z.string(),
      card: cardSchema,
    },
    idempotent: true,
    annotations: { title: 'Check a message or payment request', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, text, channel, context }, ctx) => {
      requireHousehold(deps, householdId);
      const trustedPayees = deps.repos.payees.list(householdId).map((p) => p.name);
      const history = deps.repos.checks.history(householdId);
      let result;
      const t0 = performance.now();
      try {
        result = evaluate(text, { ...context, channel, trustedPayees }, history);
      } catch (e) {
        if (e instanceof RangeError) throw new ToolError('INVALID_INPUT', e.message);
        throw e;
      }
      const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
      const actionType = context?.actionType ?? 'none';
      const row = deps.repos.transaction(() => {
        const inserted = deps.repos.checks.insert({
          householdId, text, channel: channel ?? 'unknown', actionType, amountCents: context?.amountCents, payee: context?.payee,
          signals: result.signals, score: result.score, verdict: result.verdict, fingerprint: result.fingerprint,
        });
        deps.repos.fingerprints.upsert(householdId, result.fingerprint, inserted.id);
        const decision = deps.repos.decisions.insert({
          householdId, checkId: inserted.id, traceId: ctx.traceId, ruleSetVersion: result.ruleSetVersion,
          verdict: result.verdict, score: result.score, latencyMs,
          reasons: { signals: result.signals, hardRule: result.hardRule ?? null, fingerprint: result.fingerprint },
          features: { channel: channel ?? 'unknown', actionType, amountCents: context?.amountCents ?? null, payee: context?.payee ?? null, trustedPayeeCount: trustedPayees.length, historySize: history.length },
        });
        return { inserted, decision };
      });
      return {
        checkId: row.inserted.id,
        decisionId: row.decision.id,
        ruleSetVersion: result.ruleSetVersion,
        verdict: result.verdict,
        score: result.score,
        signals: result.signals,
        ...(result.hardRule ? { hardRule: result.hardRule } : {}),
        similarTo: result.similarTo,
        spokenSummary: result.spokenSummary,
        card: result.card,
      };
    },
  });
}
