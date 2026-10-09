import type { Context, Signal, SignalId } from '@second-opinion/shared';
import { deleet, normalize } from '../normalize';
import { parseAmountCents } from '../amount';

export const WEIGHTS: Record<SignalId, number> = {
  GIFT_CARD: 45,
  WIRE_OR_CRYPTO: 40,
  REMOTE_ACCESS: 40,
  VERIFICATION_CODE: 35,
  CREDENTIAL_REQUEST: 35,
  FAMILY_EMERGENCY: 30,
  PRIZE_OR_LOTTERY: 30,
  AUTHORITY_IMPERSONATION: 25,
  SECRECY: 25,
  URGENCY: 20,
  UNSOLICITED_CONTACT: 10,
  NEW_PAYEE: 15,
  HIGH_AMOUNT: 15,
  TRUSTED_PAYEE: -40,
  OFFICIAL_CHANNEL_ADVICE: -25,
  // Tier 1 layers set their own weights; listed so the record is total.
  PLAYBOOK_MATCH: 0,
  AMOUNT_ANOMALY: 20,
  PAYEE_VELOCITY: 15,
  QUIET_HOURS: 10,
  RETRY_AFTER_DENY: 30,
};

export const HIGH_AMOUNT_CENTS = 50_000;

/** Phrases that mark a *warning* ("we will never ask for gift cards") rather than a request. */
const NEGATION = /\b(?:never|will not|won'?t|do not|don'?t|does not|doesn'?t|no (?:real|legitimate|genuine))\s+(?:ever\s+)?(?:ask|request|require|demand|accept|share|give|send)\b/;

/** First match of `re` that is not part of a warning sentence. */
/**
 * Pack v2 guard: up to four words may sit between "never"/"do not" and the verb ("we will never call you to ask you to share ...").
 * A comma or full stop ends the warning, so "don't tell anyone, buy gift cards" is still a request.
 */
const NEGATION_V2 = /\b(?:never|will not|won'?t|do not|don'?t|does not|doesn'?t|no (?:real|legitimate|genuine))\s+(?:ever\s+)?(?:\w+\s+){0,4}?(?:ask|request|require|demand|accept|share|give|send)\b/;

function firstRequestMatch(t: string, re: RegExp, negation: RegExp = NEGATION): string | undefined {
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const m of t.matchAll(g)) {
    const start = m.index ?? 0;
    const before = t.slice(Math.max(0, start - 70), start);
    const sentenceStart = Math.max(before.lastIndexOf('. '), before.lastIndexOf('! '), before.lastIndexOf('? '));
    const sameSentence = sentenceStart >= 0 ? before.slice(sentenceStart + 2) : before;
    if (!negation.test(sameSentence)) return m[0];
  }
  return undefined;
}

function firstMatch(t: string, re: RegExp): string | undefined {
  return re.exec(t)?.[0];
}

const P = {
  GIFT_CARD: [
    /\bgift[\s-]?cards?\b/,
    /\b(?:itunes|google play|steam|apple|amazon|target|walmart|vanilla|ebay)\s+(?:gift\s*)?cards?\b/,
    /\bprepaid\s+(?:visa\s+|debit\s+)?cards?\b/,
    /\bread (?:me )?(?:the )?(?:numbers|codes?) (?:on|from) the (?:back|card)\b/,
  ],
  WIRE_OR_CRYPTO: [
    /\bwire (?:transfer|the money|money|funds)\b/,
    /\b(?:western union|moneygram)\b/,
    /\b(?:bitcoin|btc|ethereum|usdt|crypto(?:currency)?)\b/,
  ],
  REMOTE_ACCESS: [
    /\b(?:anydesk|teamviewer|ultraviewer|logmein|remote (?:access|desktop|support))\b/,
    /\b(?:connect|log ?in) to your (?:computer|pc|laptop|device)\b/,
    /\binstall (?:this|the|an?) (?:app|software|program)\b/,
    /\bgive me (?:remote )?access\b/,
  ],
  VERIFICATION_CODE: [
    /\b(?:read|tell|give|share|send|repeat)\b[^.!?]{0,30}\b(?:code|passcode|otp|pin)\b/,
  ],
  FAMILY_EMERGENCY: [
    /\b(?:grand(?:son|daughter|child|kid)|nephew|niece|your (?:son|daughter))\b[^.!?]{0,80}\b(?:jail|arrested|accident|hospital|bail|custody)\b/,
    /\bdon'?t tell (?:mom|dad|your (?:mom|dad|parents|family))\b/,
  ],
  SECRECY: [
    /\b(?:don'?t|do not|never) (?:tell|mention|let) (?:anyone|anybody|your (?:family|bank|kids|son|daughter)|the (?:bank|teller|staff))\b/,
    /\bkeep (?:this|it) (?:a )?(?:secret|between us|quiet|confidential)\b/,
    /\b(?:don'?t|do not) hang up\b/,
  ],
  URGENCY: [
    /\b(?:today|right now|immediately|at once|asap|urgent(?:ly)?|last chance|final notice|arrest(?:ed)?|suspended|frozen|within (?:the |an? )?(?:hour|\d+ (?:minutes?|hours?)))\b/,
  ],
  UNSOLICITED_CONTACT: [
    /\b(?:i'?m|i am|this is|we are|we'?re)\b[^.!?]{0,40}\b(?:calling|contacting|writing) (?:from|about|regarding)\b/,
    /\b(?:we (?:have )?noticed|we detected|your account (?:has been|was|is))\b/,
    /\bsuspicious (?:activity|charge|transaction)\b/,
  ],
  OFFICIAL_CHANNEL_ADVICE: [
    /\b(?:call|contact)(?: us at)? the (?:phone )?number (?:on|printed on) (?:the back of )?your (?:card|statement|bill)\b/,
    /\b(?:log ?in|sign ?in) (?:through|using|via|to) (?:the |our )?(?:official )?(?:app|website)\b/,
    /\bwe (?:will )?never (?:ask|call|text|email) (?:you )?(?:for|to)\b/,
    /\bnever share your (?:pin|password|code|otp)\b/,
    /\bif (?:this|that|it) (?:wasn'?t|was not) you\b/,
  ],
};

/**
 * Rule packs. A published pack never changes (stored decisions are pinned to the rule set that used it); improving the
 * detector means a new pack. 'v2' = 'v1' plus the additions below, made after measuring 'v1' on the benchmark's dev split.
 */
export type RulePack = 'v1' | 'v2';

const V2_ADDITIONS: Partial<Record<SignalId, RegExp[]>> = {
  // asking for a code with a plain "I need ..." instead of "read me ..."
  VERIFICATION_CODE: [/\b(?:need|require|provide|confirm|verify)\b[^.!?]{0,40}\b(?:code|passcode|otp|pin)\b/],
  // credential phishing: card photos, PINs, passwords
  CREDENTIAL_REQUEST: [
    /\b(?:photo|picture|scan|copy)\s+of\s+your\s+(?:debit|credit|bank|atm)\s+card\b/,
    /\b(?:send|give|share|tell|provide|enter|confirm)\b[^.!?]{0,30}\b(?:your|the)\s+(?:pin|password|passcode|login|social security number|ssn)\b/,
  ],
  // "wire $8,000", "wire me $400", "wire it"
  WIRE_OR_CRYPTO: [/\bwire\s+(?:me\s+|him\s+|her\s+|them\s+)?(?:\$|\d)/, /\bwire\s+(?:it|them|cash)\b/],
};

function patterns(pack: RulePack): Record<keyof typeof P | 'CREDENTIAL_REQUEST', RegExp[]> {
  const base = { ...P, CREDENTIAL_REQUEST: [] as RegExp[] };
  if (pack === 'v1') return base;
  const out = { ...base };
  for (const [id, extra] of Object.entries(V2_ADDITIONS) as Array<[keyof typeof out, RegExp[]]>) out[id] = [...out[id], ...extra];
  return out;
}
const PACKS: Record<RulePack, ReturnType<typeof patterns>> = { v1: patterns('v1'), v2: patterns('v2') };

const AUTHORITY =
  /\b(?:the )?(?:bank|irs|ssa|social security|medicare|police|sheriff|fbi|fraud (?:department|team)|security department|amazon (?:support|security)|microsoft support|apple support|your credit union|treasury|court|government)\b/;
const DEMAND = /\b(?:must|have to|has to|need to|required|immediately|now|today|or (?:your|you will)|unless|else)\b/;
const PRIZE = /\b(?:you'?ve won|you have won|you won|winner|sweepstakes|lottery|jackpot|prize)\b/;
const PRIZE_FEE = /\b(?:claim|fee|processing|taxes|pay)\b/;

function sig(id: SignalId, evidence: string | undefined): Signal[] {
  return evidence ? [{ id, weight: WEIGHTS[id], evidence: evidence.slice(0, 80) }] : [];
}

function anyRequest(t: string, res: RegExp[], negation: RegExp = NEGATION): string | undefined {
  for (const re of res) {
    const m = firstRequestMatch(t, re, negation);
    if (m) return m;
  }
  return undefined;
}

function any(t: string, res: RegExp[]): string | undefined {
  for (const re of res) {
    const m = firstMatch(t, re);
    if (m) return m;
  }
  return undefined;
}

function payeeKey(s: string): string {
  return normalize(s);
}

/** Layer 1: deterministic rule signals for text + context. `text` is raw user input. */
export function detectRuleSignals(text: string, ctx: Context = {}, pack: RulePack = 'v2'): Signal[] {
  const P = PACKS[pack];
  const neg = pack === 'v2' ? NEGATION_V2 : NEGATION;
  const clean = normalize(text);
  const t = deleet(clean);
  const out: Signal[] = [];

  out.push(...sig('GIFT_CARD', anyRequest(t, P.GIFT_CARD, neg)));
  out.push(...sig('WIRE_OR_CRYPTO', anyRequest(t, P.WIRE_OR_CRYPTO, neg)));
  out.push(...sig('REMOTE_ACCESS', anyRequest(t, P.REMOTE_ACCESS, neg)));
  out.push(...sig('VERIFICATION_CODE', anyRequest(t, P.VERIFICATION_CODE, neg)));
  out.push(...sig('CREDENTIAL_REQUEST', anyRequest(t, P.CREDENTIAL_REQUEST, neg)));
  out.push(...sig('FAMILY_EMERGENCY', any(t, P.FAMILY_EMERGENCY)));
  out.push(...sig('SECRECY', any(t, P.SECRECY)));
  out.push(...sig('URGENCY', any(t, P.URGENCY)));
  out.push(...sig('UNSOLICITED_CONTACT', any(t, P.UNSOLICITED_CONTACT)));
  out.push(...sig('OFFICIAL_CHANNEL_ADVICE', any(t, P.OFFICIAL_CHANNEL_ADVICE)));

  const prize = firstMatch(t, PRIZE);
  if (prize && PRIZE_FEE.test(t)) out.push(...sig('PRIZE_OR_LOTTERY', prize));

  const authority = firstMatch(t, AUTHORITY);
  if (authority && DEMAND.test(t)) out.push(...sig('AUTHORITY_IMPERSONATION', authority));

  const amount = ctx.amountCents ?? parseAmountCents(clean);
  if (amount !== undefined && amount >= HIGH_AMOUNT_CENTS) {
    out.push({ id: 'HIGH_AMOUNT', weight: WEIGHTS.HIGH_AMOUNT, evidence: `$${(amount / 100).toLocaleString('en-US')}` });
  }

  if (ctx.payee && ctx.actionType && ctx.actionType !== 'none') {
    const trusted = (ctx.trustedPayees ?? []).map(payeeKey);
    if (trusted.includes(payeeKey(ctx.payee))) {
      out.push({ id: 'TRUSTED_PAYEE', weight: WEIGHTS.TRUSTED_PAYEE, evidence: ctx.payee });
    } else {
      out.push({ id: 'NEW_PAYEE', weight: WEIGHTS.NEW_PAYEE, evidence: ctx.payee });
    }
  }

  return out;
}
