import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { evaluate } from '@second-opinion/engine';
import { REASON_TEXT } from '@second-opinion/policy';
import { ToolError, VERDICTS } from '@second-opinion/shared';
import { z } from 'zod';
import type { Deps } from '../deps';
import { evaluatePolicy } from '../services/policyService';
import { defineTool } from './define';
import { actionTypeSchema, amountSchema, cardSchema, channelSchema, householdIdSchema, requireHousehold, signalSchema, similarSchema } from './shared';

const DAY_MS = 24 * 60 * 60 * 1000;

export const decisionSchema = z.object({
  outcome: z.enum(['allow', 'require_approval', 'block']),
  reasons: z.array(z.string()),
  reasonText: z.array(z.string()),
  quorum: z.number().int(),
});

export function registerCheckMessage(server: McpServer, deps: Deps): void {
  defineTool(server, deps, {
    name: 'check_message',
    title: 'Check a message or payment request',
    description:
      'Scores a message or a requested payment/purchase for scam risk using fixed, explainable rules, then applies the household policy ' +
      '(limits, new payees, quiet hours, daily cap). Returns verdict allow|caution|hold plus a policy decision allow|require_approval|block. ' +
      'Does not execute anything. If the verdict is hold or the policy decision is not allow, call place_hold and do NOT carry out the action.',
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
      layerBreakdown: z.record(z.string(), z.number()),
      playbook: z.object({ id: z.string(), name: z.string(), advice: z.string(), similarity: z.number() }).nullable(),
      verdict: z.enum(VERDICTS),
      score: z.number().int(),
      signals: z.array(signalSchema),
      hardRule: z.string().optional(),
      similarTo: similarSchema.nullable(),
      spokenSummary: z.string(),
      card: cardSchema,
      decision: decisionSchema,
    },
    idempotent: true,
    annotations: { title: 'Check a message or payment request', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    household: (a) => a.householdId,
    handler: ({ householdId, text, channel, context }, ctx) => {
      requireHousehold(deps, householdId);
      const trustedPayees = deps.repos.payees.list(householdId).map((p) => p.name);
      const history = deps.repos.checks.history(householdId);
      const now = deps.clock();
      const policy = deps.repos.policies.get(householdId);
      const payments = deps.repos.payments.recent(householdId, new Date(now.getTime() - 30 * DAY_MS).toISOString());
      const denied = deps.repos.holds.deniedSince(householdId, new Date(now.getTime() - DAY_MS).toISOString());
      let result;
      const t0 = performance.now();
      try {
        result = evaluate(text, { ...context, channel, trustedPayees }, history, { payments, denied, now, timezone: policy.timezone });
      } catch (e) {
        if (e instanceof RangeError) throw new ToolError('INVALID_INPUT', e.message);
        throw e;
      }
      const latencyMs = Math.round((performance.now() - t0) * 100) / 100;
      const actionType = context?.actionType ?? 'none';
      const { decision: policyDecision } = evaluatePolicy(deps, {
        householdId, risk: result.verdict, text, actionType, amountCents: context?.amountCents, payee: context?.payee, now,
      });
      const decision = {
        outcome: policyDecision.outcome,
        reasons: policyDecision.reasons as string[],
        reasonText: policyDecision.reasons.map((r) => REASON_TEXT[r]),
        quorum: policyDecision.quorum,
      };

      const row = deps.repos.transaction(() => {
        const inserted = deps.repos.checks.insert({
          householdId, text, channel: channel ?? 'unknown', actionType, amountCents: context?.amountCents, payee: context?.payee,
          signals: result.signals, score: result.score, verdict: result.verdict, fingerprint: result.fingerprint,
        });
        deps.repos.fingerprints.upsert(householdId, result.fingerprint, inserted.id);
        const stored = deps.repos.decisions.insert({
          householdId, checkId: inserted.id, traceId: ctx.traceId, ruleSetVersion: result.ruleSetVersion,
          verdict: result.verdict, score: result.score, latencyMs,
          reasons: { signals: result.signals, hardRule: result.hardRule ?? null, fingerprint: result.fingerprint },
          features: {
            channel: channel ?? 'unknown', actionType, amountCents: context?.amountCents ?? null, payee: context?.payee ?? null,
            trustedPayeeCount: trustedPayees.length, historySize: history.length, paymentsConsidered: payments.length,
            deniedConsidered: denied.length, layerBreakdown: result.layerBreakdown,
          },
          policyOutcome: decision.outcome, policyReasons: decision.reasons, quorum: decision.quorum,
        });
        return { inserted, stored };
      });
      return {
        checkId: row.inserted.id,
        decisionId: row.stored.id,
        ruleSetVersion: result.ruleSetVersion,
        layerBreakdown: result.layerBreakdown,
        playbook: result.playbook,
        verdict: result.verdict,
        score: result.score,
        signals: result.signals,
        ...(result.hardRule ? { hardRule: result.hardRule } : {}),
        similarTo: result.similarTo,
        spokenSummary: result.spokenSummary,
        card: result.card,
        decision,
      };
    },
  });
}
