import { randomBytes } from 'node:crypto';

export type IdPrefix = 'hh' | 'p' | 'chk' | 'dec' | 'hold' | 'pay' | 'evt' | 'appr' | 'ntf' | 'pol';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

/** `prefix_` + 10 random chars (CSPRNG). */
export function newId(prefix: IdPrefix): string {
  const bytes = randomBytes(10);
  let out = '';
  for (const b of bytes) out += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${out}`;
}

export const ID_PATTERN = /^[a-z]+_[A-Za-z0-9_]{1,64}$/;
