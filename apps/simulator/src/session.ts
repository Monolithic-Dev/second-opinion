import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'so_session';
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface Session {
  personId: string;
  exp: number;
}

const b64 = (s: string) => Buffer.from(s, 'utf8').toString('base64url');
const unb64 = (s: string) => Buffer.from(s, 'base64url').toString('utf8');
const mac = (data: string, secret: string) => createHmac('sha256', secret).update(data).digest('base64url');

/** `payload.signature`, HMAC-SHA256. Stateless; expiry is inside the signed payload. */
export function signSession(session: Session, secret: string): string {
  const body = b64(JSON.stringify(session));
  return `${body}.${mac(body, secret)}`;
}

export function verifySession(token: string | undefined, secret: string, now = Date.now()): Session | null {
  if (!token) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = mac(body, secret);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const s = JSON.parse(unb64(body)) as Session;
    return typeof s.personId === 'string' && typeof s.exp === 'number' && s.exp > now ? s : null;
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function cookieHeader(token: string, secure: boolean, maxAgeMs = SESSION_TTL_MS): string {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAgeMs / 1000)}${secure ? '; Secure' : ''}`;
}

export function clearCookieHeader(secure: boolean): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
}

/** PIN comparison without leaking length or content through timing. */
export function pinMatches(given: string, expected: string | undefined): boolean {
  if (expected === undefined) return false;
  const a = createHmac('sha256', 'pin').update(given).digest();
  const b = createHmac('sha256', 'pin').update(expected).digest();
  return timingSafeEqual(a, b);
}
