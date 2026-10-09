const ZERO_WIDTH = /[​-‍⁠﻿­]/g;
const LEET: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's', '!': 'i' };

/** NFKC, strip zero-width chars, lowercase, collapse whitespace. Idempotent. */
export function normalize(text: string): string {
  return text.normalize('NFKC').replace(ZERO_WIDTH, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Undo common leetspeak inside word-like tokens ("g1ft c@rd" -> "gift card").
 * Money tokens ($200, 1,000) and pure numbers are left alone. Narrow on purpose.
 */
export function deleet(normalized: string): string {
  return normalized
    .split(' ')
    .map((tok) => {
      if (/^\$?\d[\d,.]*$/.test(tok)) return tok;
      if (!/[a-z]/.test(tok)) return tok;
      return tok.replace(/[013457@$!]/g, (c) => LEET[c] ?? c);
    })
    .join(' ');
}
