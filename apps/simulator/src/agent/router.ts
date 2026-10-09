import { randomUUID } from 'node:crypto';
import { weekdayOf } from '@second-opinion/engine';
import type { Card, Verdict } from '@second-opinion/shared';
import { GatewayDown, ToolCallError, withTrace, type Gateway } from '../gateway';
import type { Publish } from '../events';
import { classifyIntent, type Intent, type IntentKind, type Speaker } from './intent';

export interface TurnInput {
  householdId: string;
  speaker: Speaker;
  text: string;
  /** Who is speaking when `speaker` is family (defaults to the first approver). */
  personId?: string | undefined;
}

export interface TraceEntry {
  tool: string;
  args: Record<string, unknown>;
  ok: boolean;
  ms: number;
  code?: string;
  summary: string;
}

export interface PolicyDecision {
  outcome: 'allow' | 'require_approval' | 'block';
  reasons: string[];
  reasonText: string[];
  quorum: number;
}

export interface TurnResult {
  intent: IntentKind;
  /** Text shown on screen (captions). */
  reply: string;
  /** Text read aloud: at most two short sentences. */
  spoken: string;
  card: Card | null;
  verdict?: Verdict;
  decision?: PolicyDecision;
  holdId?: string;
  /** True only when the action was actually carried out (simulated). Never true for a held, blocked or unverified request. */
  executed: boolean;
  blocked?: boolean;
  trace: TraceEntry[];
  traceId: string;
}

interface CheckOut {
  checkId: string;
  verdict: Verdict;
  spokenSummary: string;
  card: Card;
  decision: PolicyDecision;
  similarTo: { date: string } | null;
}
interface HouseholdOut { people: Array<{ id: string; name: string; role: 'elder' | 'family'; canApprove: boolean; approverRank: number }> }
interface HoldRow { holdId: string; description: string; status: string }

const FAIL_SAFE = "I couldn't verify this, so I haven't done it.";

export function money(cents: number | undefined): string {
  if (cents === undefined) return '';
  const whole = cents % 100 === 0;
  return `$${(cents / 100).toLocaleString('en-US', { minimumFractionDigits: whole ? 0 : 2, maximumFractionDigits: 2 })}`;
}

export function describeAction(intent: Intent, text: string): string {
  const what = intent.payee ? ` to ${intent.payee}` : '';
  const amount = money(intent.amountCents);
  const verb = intent.actionType === 'purchase' ? 'Purchase' : intent.actionType === 'payment' ? 'Payment' : 'Transfer';
  const d = amount ? `${verb} of ${amount}${what}` : `${verb}${what}`;
  return (d.length > 3 ? d : text).slice(0, 200);
}

function sentences(text: string): string[] {
  return (text.match(/[^.!?]+[.!?]+/g) ?? [text]).map((s) => s.trim()).filter(Boolean);
}

function firstSentences(text: string, max = 2): string {
  return sentences(text).slice(0, max).join(' ');
}

/**
 * What is read aloud when a request is paused: always the pause, the single most important reason, "same as <day>" when we
 * have seen it before, and who was asked. Never cut off in the middle of that list.
 */
function pausedSpeech(reason: string, similarDate: string | undefined, who: string): string {
  const parts = [`I've paused this.`, firstSentences(reason, 1)];
  if (similarDate) parts.push(`It's the same kind of request as ${weekdayOf(similarDate)}.`);
  parts.push(`I've asked ${who} to check.`);
  return parts.filter(Boolean).join(' ');
}

/**
 * One conversational turn. Fixed rules decide what to call; the MCP server decides risk. Every failure leaves the action
 * NOT executed (fail closed). The agent never releases a hold by itself.
 */
export async function runTurn(input: TurnInput, gw: Gateway, publish: Publish): Promise<TurnResult> {
  const traceId = randomUUID();
  const turn = randomUUID().slice(0, 8);
  const trace: TraceEntry[] = [];
  const intent = classifyIntent(input.text, input.speaker);

  const call = async <T>(tool: string, args: Record<string, unknown>): Promise<T> => {
    const t0 = performance.now();
    try {
      const out = await gw.call<T>(tool, args);
      trace.push({ tool, args, ok: true, ms: Math.round(performance.now() - t0), summary: summarize(tool, out) });
      return out;
    } catch (e) {
      trace.push({
        tool, args, ok: false, ms: Math.round(performance.now() - t0),
        ...(e instanceof ToolCallError ? { code: e.code } : { code: 'UNAVAILABLE' }),
        summary: e instanceof Error ? e.message.slice(0, 160) : 'failed',
      });
      throw e;
    }
  };

  const done = (partial: Omit<TurnResult, 'trace' | 'traceId' | 'intent' | 'card'> & { card?: Card | null }): TurnResult => ({
    intent: intent.kind, card: null, ...partial, trace, traceId,
  });

  try {
    return await withTrace(traceId, async () => {
      const hh = input.householdId;
      const key = (tool: string) => `sim-${turn}-${tool}`;

      switch (intent.kind) {
        case 'PURCHASE_OR_PAY': {
          const context = {
            actionType: intent.actionType,
            ...(intent.amountCents !== undefined ? { amountCents: intent.amountCents } : {}),
            ...(intent.payee ? { payee: intent.payee } : {}),
          };
          const check = await call<CheckOut>('check_message', { householdId: hh, text: input.text, channel: 'voice', context, idempotencyKey: key('check') });
          publish('check.done', { householdId: hh, checkId: check.checkId, verdict: check.verdict });

          if (check.decision.outcome === 'block') {
            const spoken = "I can't do that one. It is over your household's limit, so a family member needs to handle it.";
            return done({ reply: spoken, spoken, card: check.card, verdict: check.verdict, decision: check.decision, executed: false, blocked: true });
          }

          if (check.verdict === 'hold' || check.decision.outcome === 'require_approval') {
            const hold = await call<{ holdId: string }>('place_hold', {
              householdId: hh, checkId: check.checkId, actionType: intent.actionType ?? 'purchase',
              ...(intent.amountCents !== undefined ? { amountCents: intent.amountCents } : {}),
              ...(intent.payee ? { payee: intent.payee } : {}),
              description: describeAction(intent, input.text), idempotencyKey: key('hold'),
            });
            const approval = await call<{ notified: string[] }>('request_family_approval', { holdId: hold.holdId });
            const house = await call<HouseholdOut>('get_household', { householdId: hh });
            const who = house.people.find((p) => p.id === approval.notified[0])?.name ?? 'your family';
            const reason = check.verdict === 'allow'
              ? `It breaks one of your household rules: ${(check.decision.reasonText[0] ?? 'it needs a second look').toLowerCase()}.`
              : check.spokenSummary;
            const spoken = pausedSpeech(reason, check.similarTo?.date, who);
            publish('hold.created', { householdId: hh, holdId: hold.holdId });
            return done({ reply: `${spoken} ${check.card.advice}`.trim(), spoken, card: check.card, verdict: check.verdict, decision: check.decision, holdId: hold.holdId, executed: false });
          }

          if (check.verdict === 'caution') {
            const spoken = `${check.spokenSummary} I haven't done it. Ask your family if you're unsure.`;
            return done({ reply: spoken, spoken: firstSentences(spoken, 2), card: check.card, verdict: check.verdict, decision: check.decision, executed: false });
          }

          const spoken = `Okay, ${describeAction(intent, input.text).charAt(0).toLowerCase()}${describeAction(intent, input.text).slice(1)} is done.`;
          return done({ reply: spoken, spoken, card: check.card, verdict: check.verdict, decision: check.decision, executed: true });
        }

        case 'SCAM_QUESTION': {
          const check = await call<CheckOut>('check_message', { householdId: hh, text: input.text, channel: 'unknown', idempotencyKey: key('check') });
          publish('check.done', { householdId: hh, checkId: check.checkId, verdict: check.verdict });
          const risky = check.verdict !== 'allow';
          const spoken = risky ? `${check.spokenSummary} ${check.card.advice}` : "That doesn't look like a scam, but if you're unsure, ask your family.";
          return done({ reply: spoken, spoken: firstSentences(spoken, 2), card: check.card, verdict: check.verdict, decision: check.decision, executed: false });
        }

        case 'STATUS': {
          const list = await call<{ holds: HoldRow[] }>('list_holds', { householdId: hh, status: 'pending' });
          const n = list.holds.length;
          const spoken = n === 0 ? 'Nothing is waiting for approval.' : `${n} ${n === 1 ? 'request is' : 'requests are'} waiting: ${list.holds.slice(0, 3).map((h) => h.description).join('; ')}.`;
          return done({ reply: spoken, spoken, executed: false });
        }

        case 'TRUST_LIST': {
          const out = await call<{ payees: Array<{ name: string }> }>('trusted_payees', { householdId: hh, action: 'list' });
          const names = out.payees.map((p) => p.name);
          const spoken = names.length ? `You trust ${names.join(', ')}.` : "You haven't added anyone to your trusted list yet.";
          return done({ reply: spoken, spoken, executed: false });
        }

        case 'TRUST_ADD': {
          if (input.speaker !== 'family') return done({ reply: 'Only your family can change the trusted list.', spoken: 'Only your family can change the trusted list.', executed: false });
          const by = await approverFor(input, hh, call);
          const out = await call<{ payees: Array<{ name: string }> }>('trusted_payees', { householdId: hh, action: 'add', name: intent.trustName, requestedBy: by });
          publish('payee.updated', { householdId: hh });
          const spoken = `${intent.trustName} is now on the trusted list (${out.payees.length} trusted).`;
          return done({ reply: spoken, spoken, executed: false });
        }

        case 'FAMILY_DECISION': {
          if (input.speaker !== 'family') {
            const spoken = "Only a family member can approve that. I'll ask them for you.";
            return done({ reply: spoken, spoken, executed: false });
          }
          const list = await call<{ holds: HoldRow[] }>('list_holds', { householdId: hh, status: 'pending' });
          const hold = list.holds[0];
          if (!hold) return done({ reply: 'Nothing is waiting for a decision.', spoken: 'Nothing is waiting for a decision.', executed: false });
          const by = await approverFor(input, hh, call);
          const res = await call<{ status: string; votes: { approve: number; required: number } }>('resolve_approval', {
            holdId: hold.holdId, decision: intent.decision, resolvedBy: by, idempotencyKey: key('resolve'),
          });
          publish('hold.resolved', { householdId: hh, holdId: hold.holdId, status: res.status });
          const spoken =
            res.status === 'denied' ? `Okay, I've cancelled ${hold.description}.`
            : res.status === 'released' ? `Approved. ${hold.description} can go ahead.`
            : `Noted. ${res.votes.approve} of ${res.votes.required} approvals so far.`;
          return done({ reply: spoken, spoken, holdId: hold.holdId, executed: res.status === 'released' });
        }

        default: {
          const spoken = 'I can check a message or a payment for you. Try "pay the pharmacy $24" or "is this text a scam?".';
          return done({ reply: spoken, spoken, executed: false });
        }
      }
    });
  } catch (e) {
    if (e instanceof ToolCallError) {
      const msg = e.code === 'FORBIDDEN' ? 'That needs a family member.' : e.code === 'CONFLICT' ? 'That was already decided.' : FAIL_SAFE;
      return done({ reply: msg, spoken: msg, executed: false });
    }
    if (e instanceof GatewayDown) return done({ reply: FAIL_SAFE, spoken: FAIL_SAFE, executed: false });
    return done({ reply: FAIL_SAFE, spoken: FAIL_SAFE, executed: false });
  }
}

async function approverFor(
  input: TurnInput,
  householdId: string,
  call: <T>(tool: string, args: Record<string, unknown>) => Promise<T>,
): Promise<string> {
  if (input.personId) return input.personId;
  const house = await call<HouseholdOut>('get_household', { householdId });
  const first = house.people.filter((p) => p.canApprove).sort((a, b) => a.approverRank - b.approverRank)[0];
  if (!first) throw new ToolCallError('INVALID_INPUT', 'no approver configured');
  return first.id;
}

function summarize(tool: string, out: unknown): string {
  const o = out as Record<string, unknown>;
  switch (tool) {
    case 'check_message': return `${o.verdict} ${o.score} · policy ${(o.decision as { outcome?: string } | undefined)?.outcome ?? '?'}`;
    case 'place_hold': return `hold ${o.holdId} ${o.status}`;
    case 'request_family_approval': return `notified ${(o.notified as string[] | undefined)?.join(', ') ?? ''}`;
    case 'resolve_approval': return `${o.status} · ${(o.votes as { approve?: number; required?: number } | undefined)?.approve ?? 0}/${(o.votes as { required?: number } | undefined)?.required ?? 1}`;
    case 'list_holds': return `${(o.holds as unknown[] | undefined)?.length ?? 0} holds`;
    case 'trusted_payees': return `${(o.payees as unknown[] | undefined)?.length ?? 0} payees`;
    default: return 'ok';
  }
}
