import type { Card, Signal, SignalId, Similar, Verdict } from '@second-opinion/shared';
import { isPositive } from './score';

/** Short card bullets. */
export const FLAG_TEXT: Partial<Record<SignalId, string>> = {
  GIFT_CARD: 'Asks for gift cards',
  WIRE_OR_CRYPTO: 'Asks for a wire transfer or crypto',
  REMOTE_ACCESS: 'Wants access to your computer',
  VERIFICATION_CODE: 'Asks you to read out a security code',
  CREDENTIAL_REQUEST: 'Asks for your card details, PIN or password',
  ADVANCE_FEE: 'Asks you to pay a fee first to release money or goods',
  FAMILY_EMERGENCY: 'Claims a relative is in trouble',
  PRIZE_OR_LOTTERY: 'Says you won a prize but asks you to pay',
  AUTHORITY_IMPERSONATION: 'Claims to be your bank or an official',
  SECRECY: 'Asks you to keep it secret',
  URGENCY: 'Pressure to act right now',
  UNSOLICITED_CONTACT: 'Contact you did not ask for',
  NEW_PAYEE: 'Someone you have not paid before',
  HIGH_AMOUNT: 'A large amount of money',
  PLAYBOOK_MATCH: 'Matches a known scam pattern',
  AMOUNT_ANOMALY: 'Much larger than usual',
  PAYEE_VELOCITY: 'Several new payees recently',
  QUIET_HOURS: 'An unusual time of day',
  RETRY_AFTER_DENY: 'Tried again after family said no',
};

/** Spoken fragments ("a common scam: gift cards, pressure to act now, and ..."). */
const SPOKEN_TEXT: Partial<Record<SignalId, string>> = {
  GIFT_CARD: 'gift cards',
  WIRE_OR_CRYPTO: 'a wire or crypto payment',
  REMOTE_ACCESS: 'remote access to your computer',
  VERIFICATION_CODE: 'a security code',
  CREDENTIAL_REQUEST: 'a request for your card details or PIN',
  ADVANCE_FEE: 'a fee you must pay first',
  FAMILY_EMERGENCY: 'a relative in trouble',
  PRIZE_OR_LOTTERY: 'a prize with a fee',
  AUTHORITY_IMPERSONATION: 'someone claiming to be an official',
  SECRECY: 'a request for secrecy',
  URGENCY: 'pressure to act now',
  UNSOLICITED_CONTACT: 'contact you did not ask for',
  NEW_PAYEE: 'a new payee',
  HIGH_AMOUNT: 'a large amount',
  PLAYBOOK_MATCH: 'a known scam pattern',
  AMOUNT_ANOMALY: 'an unusual amount',
  PAYEE_VELOCITY: 'several new payees',
  QUIET_HOURS: 'an unusual time',
  RETRY_AFTER_DENY: 'a repeat of something family declined',
};

/** Which advice to show, most important first. */
const ADVICE_ORDER: Array<[SignalId, string]> = [
  ['GIFT_CARD', 'Real banks and agencies never ask for gift cards.'],
  ['REMOTE_ACCESS', 'Never let a caller control your computer.'],
  ['VERIFICATION_CODE', 'Never read a security code to someone who contacted you.'],
  ['CREDENTIAL_REQUEST', 'Never send your PIN, password or card photos to someone who contacted you.'],
  ['ADVANCE_FEE', 'Anyone who asks you to pay a fee before you can get money or goods is a scammer.'],
  ['WIRE_OR_CRYPTO', 'Wire transfers and crypto cannot be taken back.'],
  ['FAMILY_EMERGENCY', 'Hang up and call your family member on a number you know.'],
  ['PRIZE_OR_LOTTERY', 'Real prizes never ask you to pay first.'],
  ['AUTHORITY_IMPERSONATION', 'Hang up and call the number on your card or statement.'],
  ['SECRECY', 'Anyone asking for secrecy about money is a warning sign.'],
  ['URGENCY', 'Scammers rush you. Take a moment and talk to family.'],
];

export function weekdayOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}

function listPhrases(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

export function explain(
  verdict: Verdict,
  signals: Signal[],
  similarTo: Similar | null,
): { spokenSummary: string; card: Card } {
  const positives = signals.filter((s) => isPositive(s.id) && s.weight > 0).sort((a, b) => b.weight - a.weight);
  const flags = positives.map((s) => (s.id === 'PLAYBOOK_MATCH' ? `Matches a known scam: ${s.evidence}` : FLAG_TEXT[s.id])).filter((x): x is string => Boolean(x)).slice(0, 5);
  // "a known scam pattern" adds little when we can name concrete red flags, so it is spoken only when it is all we have.
  const concrete = positives.filter((s) => s.id !== 'PLAYBOOK_MATCH');
  const spokenSource = concrete.length >= 2 ? concrete : positives;
  const spoken = spokenSource.map((s) => SPOKEN_TEXT[s.id]).filter((x): x is string => Boolean(x)).slice(0, 3);
  const ids = new Set(positives.map((s) => s.id));
  const advice = ADVICE_ORDER.find(([id]) => ids.has(id))?.[1] ?? 'When in doubt, check with family before paying.';

  let spokenSummary: string;
  let title: string;
  if (verdict === 'hold') {
    spokenSummary = `This matches a common scam: ${listPhrases(spoken)}.`;
    title = 'Held: possible scam';
  } else if (verdict === 'caution') {
    spokenSummary = `This looks a little risky: ${listPhrases(spoken)}. Let's double-check first.`;
    title = 'Be careful';
  } else {
    spokenSummary = 'That looks fine.';
    title = 'Looks OK';
  }
  if (similarTo && verdict !== 'allow') {
    spokenSummary += ` This is the same kind of request as ${weekdayOf(similarTo.date)}.`;
  }

  return { spokenSummary, card: { title, level: verdict, flags, advice: verdict === 'allow' ? '' : advice } };
}
