import { MAX_AMOUNT_CENTS } from '@second-opinion/shared';

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};

/** "five hundred", "two thousand five hundred", "a hundred" -> number; undefined if not a number phrase. */
export function wordsToNumber(words: string[]): number | undefined {
  if (words.length === 0) return undefined;
  let total = 0;
  let current = 0;
  let seen = false;
  for (const w of words) {
    if (w === 'and') continue;
    if (w === 'a') {
      current = current || 1;
      seen = true;
    } else if (w in ONES) {
      current += ONES[w] as number;
      seen = true;
    } else if (w in TENS) {
      current += TENS[w] as number;
      seen = true;
    } else if (w === 'hundred') {
      current = (current || 1) * 100;
      seen = true;
    } else if (w === 'thousand') {
      total += (current || 1) * 1000;
      current = 0;
      seen = true;
    } else return undefined;
  }
  return seen ? total + current : undefined;
}

const QTY_WORDS = Object.keys(ONES).join('|');
const MONEY = String.raw`\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?`;

/**
 * Largest plausible dollar total mentioned, in cents (capped). Handles $1,000, $200.50,
 * "5 x $200", "five $200 gift cards", "500 dollars", "five hundred dollars".
 * Input should be normalized (lowercase) text.
 */
export function parseAmountCents(text: string): number | undefined {
  const candidates: number[] = [];

  // $ amounts, optionally multiplied by a preceding quantity ("five $200", "5 x $200")
  const moneyRe = new RegExp(String.raw`(?:(\d+|${QTY_WORDS})\s*(?:x|×|times)?\s*)?${MONEY}`, 'g');
  for (const m of text.matchAll(moneyRe)) {
    const base = Number((m[2] as string).replace(/,/g, '')) * 100 + Number((m[3] ?? '0').padEnd(2, '0'));
    const qtyRaw = m[1];
    let qty = 1;
    if (qtyRaw) qty = /^\d+$/.test(qtyRaw) ? Number(qtyRaw) : (ONES[qtyRaw] ?? 1);
    // a bare number directly before "$" (e.g. "paid 5 $20") is treated as quantity only when small
    candidates.push(base * (qty > 0 && qty <= 100 ? qty : 1));
  }

  // "500 dollars", "1,200 bucks", "300 usd"
  for (const m of text.matchAll(/(\d{1,3}(?:,\d{3})+|\d+)\s*(?:dollars?|bucks|usd)\b/g)) {
    candidates.push(Number((m[1] as string).replace(/,/g, '')) * 100);
  }

  // "five hundred dollars", "two thousand dollars"
  for (const m of text.matchAll(/((?:(?:a|and|\w+)\s+){1,5})(?:dollars?|bucks)\b/g)) {
    const words = (m[1] as string).trim().split(/\s+/);
    // take the longest trailing run of number words
    for (let i = 0; i < words.length; i++) {
      const n = wordsToNumber(words.slice(i));
      if (n !== undefined) {
        candidates.push(n * 100);
        break;
      }
    }
  }

  const valid = candidates.filter((c) => Number.isFinite(c) && c > 0);
  if (valid.length === 0) return undefined;
  return Math.min(Math.max(...valid), MAX_AMOUNT_CENTS);
}
