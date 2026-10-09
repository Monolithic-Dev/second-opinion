import { normalize, parseAmountCents } from '@second-opinion/engine';
import type { ActionType } from '@second-opinion/shared';

export type Speaker = 'elder' | 'family';
export type IntentKind = 'PURCHASE_OR_PAY' | 'SCAM_QUESTION' | 'TRUST_ADD' | 'TRUST_LIST' | 'STATUS' | 'FAMILY_DECISION' | 'FALLBACK';

export interface Intent {
  kind: IntentKind;
  actionType?: ActionType;
  amountCents?: number | undefined;
  payee?: string | undefined;
  decision?: 'approve' | 'deny';
  trustName?: string;
}

const MONEY_VERB = /\b(buy|purchase|order|pay|send|transfer|wire|deposit)\b/i;
/** "I got a text...", "is this real", "someone called": asking about a message, not asking for an action. */
const SCAM_LEAD =
  /^(?:i\s+)?(?:just\s+)?(?:got|received|have|had)\s+(?:a|an|another)\s+(?:text|call|email|message|letter|voicemail)|\bis\s+(?:this|that|it)\b|\b(?:scam|suspicious|phishing|fraud|legit|legitimate)\b|\b(?:someone|somebody)\s+(?:called|texted|emailed|messaged)\b/i;
const STATUS = /\b(?:any|what(?:'s| is)?|show|list|are there)\b[^.?!]*\b(?:pending|holds?|waiting)\b/i;
const TRUST_LIST = /\b(?:who|which|list|show)\b[^.?!]*\btrust(?:ed)?\b|\btrusted payees?\b/i;
const APPROVE = /\b(?:approve|let it (?:through|go)|go ahead|allow it)\b/i;
const DENY = /\b(?:deny|decline|reject|cancel|block)\b|^\s*no\b/i;
const TRUST_ADD = /\b(?:add|trust)\s+(.+?)(?:\s+(?:to|as)\s+(?:the\s+)?trusted(?:\s+(?:payees?|list))?)?\s*[.!]?$/i;

function actionTypeOf(text: string): ActionType {
  const t = text.toLowerCase();
  if (/\b(buy|purchase|order)\b/.test(t)) return 'purchase';
  if (/\bpay\b/.test(t)) return 'payment';
  return 'transfer';
}

/** Best-effort payee extraction: gift cards, a capitalised name after the verb ("Pay Greenleaf Pharmacy"), or "to my neighbour". */
export function extractPayee(text: string): string | undefined {
  if (/\bgift[\s-]?cards?\b/i.test(text)) return 'gift cards';
  const named = /\b(?:[Pp]ay|[Ss]end(?:\s+money)?\s+to|[Ww]ire(?:\s+money)?\s+to|[Tt]ransfer(?:\s+money)?\s+to|[Oo]rder\s+from)\s+(?:the\s+)?([A-Z][\w&'-]*(?:\s+[A-Z&][\w&'-]*)*)/.exec(text);
  if (named?.[1]) return named[1].trim();
  const mine = /\bto\s+my\s+([a-z]+)/i.exec(text);
  if (mine?.[1]) return mine[1].toLowerCase();
  const to = /\b(?:to|from|at)\s+(?:the\s+)?([A-Z][\w&'-]*(?:\s+[A-Z&][\w&'-]*)*)/.exec(text);
  return to?.[1]?.trim();
}

export function classifyIntent(rawText: string, speaker: Speaker): Intent {
  const text = rawText.trim();

  if (speaker === 'family') {
    if (APPROVE.test(text) && !DENY.test(text)) return { kind: 'FAMILY_DECISION', decision: 'approve' };
    if (DENY.test(text)) return { kind: 'FAMILY_DECISION', decision: 'deny' };
    const add = TRUST_ADD.exec(text);
    if (add?.[1] && /\b(?:add|trust)\b/i.test(text) && !MONEY_VERB.test(text)) return { kind: 'TRUST_ADD', trustName: add[1].replace(/\s+to\s+trusted.*$/i, '').trim() };
  } else if (APPROVE.test(text) && /^\s*(?:approve|go ahead|allow it)/i.test(text)) {
    // The elder asking to approve their own request: handled with a refusal, never executed.
    return { kind: 'FAMILY_DECISION', decision: 'approve' };
  }

  if (STATUS.test(text)) return { kind: 'STATUS' };
  if (TRUST_LIST.test(text)) return { kind: 'TRUST_LIST' };
  if (SCAM_LEAD.test(text)) return { kind: 'SCAM_QUESTION' };

  if (MONEY_VERB.test(text)) {
    const amountCents = parseAmountCents(normalize(text));
    return { kind: 'PURCHASE_OR_PAY', actionType: actionTypeOf(text), amountCents, payee: extractPayee(text) };
  }
  return { kind: 'FALLBACK' };
}
