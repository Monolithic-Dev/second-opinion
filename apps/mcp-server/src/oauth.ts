import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type Request, type Response, type Router } from 'express';
import type { Deps } from './deps';

/**
 * OAuth 2.1 authorization server + resource-server helpers for linking an assistant (Alexa+) to ONE household.
 * Follows the Alexa+ MCP Toolkit requirements: authorization-code flow with PKCE (S256 only), a statically registered client
 * (no dynamic registration), the `resource` parameter, protected-resource metadata (RFC 9728) and authorization-server metadata.
 * Codes and tokens are signed (HMAC-SHA256), so nothing is stored; single-use codes are tracked in memory
 * (ponytail: single process; use a table if this ever runs on several instances).
 */
export interface OAuthConfig {
  publicUrl: string;
  clientId: string;
  clientSecret: string | undefined;
  redirectUris: string[];
  signingKey: string;
  /** The code a family member types on the link page to prove they control the household. */
  linkCode: string;
  householdId: string;
  accessTtlSec: number;
  refreshTtlSec: number;
}

export const OAUTH_SCOPE = 'second-opinion';
/** Tools an assistant token must never call: approvals and rule changes belong to the family console. */
export const ASSISTANT_FORBIDDEN_TOOLS: ReadonlySet<string> = new Set(['resolve_approval', 'set_policy']);

type TokenType = 'code' | 'access' | 'refresh';
interface Payload {
  t: TokenType;
  sub: string;
  cid: string;
  aud: string;
  exp: number;
  jti: string;
  /** code only */
  cc?: string;
  ru?: string;
}

const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url');

export function sign(cfg: OAuthConfig, p: Payload): string {
  const body = b64(JSON.stringify(p));
  return `so1.${body}.${b64(createHmac('sha256', cfg.signingKey).update(body).digest())}`;
}

export function verify(cfg: OAuthConfig, token: string, type: TokenType, now = Date.now()): Payload | null {
  const m = /^so1\.([\w-]+)\.([\w-]+)$/.exec(token);
  if (!m) return null;
  const expected = createHmac('sha256', cfg.signingKey).update(m[1]!).digest();
  const given = Buffer.from(m[2]!, 'base64url');
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(m[1]!, 'base64url').toString('utf8')) as Payload;
    if (p.t !== type || p.aud !== cfg.publicUrl || p.exp * 1000 < now) return null;
    return p;
  } catch {
    return null;
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function page(title: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<style>body{font:18px/1.5 system-ui,sans-serif;max-width:30rem;margin:3rem auto;padding:0 1rem;color:#1b1b1f}
input,button{font:inherit;padding:.6rem .8rem;border-radius:.5rem;border:1px solid #767680}button{background:#1a56db;color:#fff;border-color:#1a56db;cursor:pointer}
label{display:block;margin:1rem 0 .3rem}.err{color:#b00020}</style></head><body><main>${body}</main></body></html>`;
}

function oauthError(res: Response, status: number, error: string, description: string): void {
  res.status(status).setHeader('Cache-Control', 'no-store').json({ error, error_description: description });
}

export function createOAuth(cfg: OAuthConfig, deps: Deps) {
  const router: Router = express.Router();
  const usedCodes = new Map<string, number>();
  const attempts = new Map<string, { start: number; n: number }>();
  const resource = cfg.publicUrl;

  const prune = (now: number) => {
    for (const [k, exp] of usedCodes) if (exp < now) usedCodes.delete(k);
  };

  // --- discovery ---------------------------------------------------------------------------------------------------
  const prm = (_req: Request, res: Response) =>
    res.json({ resource, authorization_servers: [cfg.publicUrl], bearer_methods_supported: ['header'], scopes_supported: [OAUTH_SCOPE] });
  router.get('/.well-known/oauth-protected-resource', prm);
  router.get('/.well-known/oauth-protected-resource/mcp', prm);
  router.get('/.well-known/oauth-authorization-server', (_req, res) =>
    res.json({
      issuer: cfg.publicUrl,
      authorization_endpoint: `${cfg.publicUrl}/oauth/authorize`,
      token_endpoint: `${cfg.publicUrl}/oauth/token`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      code_challenge_methods_supported: ['S256'],
      token_endpoint_auth_methods_supported: cfg.clientSecret ? ['client_secret_post', 'client_secret_basic'] : ['none'],
      scopes_supported: [OAUTH_SCOPE],
    }),
  );

  // --- authorization -----------------------------------------------------------------------------------------------
  interface AuthRequest {
    clientId: string;
    redirectUri: string;
    state: string;
    challenge: string;
  }

  /** Validate an authorization request. Problems with client or redirect are shown to the user, never redirected. */
  function parseAuthRequest(q: Record<string, unknown>): { ok: AuthRequest } | { html: string } | { redirectError: string; redirectUri: string; state: string } {
    const s = (k: string) => (typeof q[k] === 'string' ? (q[k] as string) : '');
    const bad = (msg: string) => ({ html: page('Cannot link', `<h1>Cannot link</h1><p class="err">${esc(msg)}</p>`) });
    if (s('client_id') !== cfg.clientId) return bad('Unknown application.');
    if (!cfg.redirectUris.includes(s('redirect_uri'))) return bad('The return address is not registered for this application.');
    const base = { redirectUri: s('redirect_uri'), state: s('state') };
    if (s('response_type') !== 'code') return { redirectError: 'unsupported_response_type', ...base };
    if (s('code_challenge_method') !== 'S256' || !/^[A-Za-z0-9._~-]{43,128}$/.test(s('code_challenge'))) return { redirectError: 'invalid_request', ...base };
    if (s('resource') && s('resource') !== resource) return { redirectError: 'invalid_target', ...base };
    return { ok: { clientId: s('client_id'), redirectUri: s('redirect_uri'), state: s('state'), challenge: s('code_challenge') } };
  }

  const redirectWith = (res: Response, uri: string, params: Record<string, string>) => {
    const u = new URL(uri);
    for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
    res.setHeader('Cache-Control', 'no-store').redirect(302, u.toString());
  };

  const form = (r: AuthRequest, error?: string) => {
    const name = deps.repos.households.get(cfg.householdId)?.name ?? cfg.householdId;
    const hidden = (k: string, v: string) => `<input type="hidden" name="${k}" value="${esc(v)}">`;
    return page(
      'Link Alexa+ to Second Opinion',
      `<h1>Link Alexa+ to ${esc(name)}</h1>
<p>Second Opinion will check payment and purchase requests made through Alexa+ and ask your family before risky ones go ahead. Alexa+ can never approve a request itself.</p>
${error ? `<p class="err" role="alert">${esc(error)}</p>` : ''}
<form method="post" action="/oauth/authorize">${hidden('client_id', r.clientId)}${hidden('redirect_uri', r.redirectUri)}${hidden('state', r.state)}${hidden('code_challenge', r.challenge)}${hidden('code_challenge_method', 'S256')}${hidden('response_type', 'code')}${hidden('resource', resource)}
<label for="link_code">Family link code</label><input id="link_code" name="link_code" type="password" autocomplete="off" required>
<p><button type="submit">Link</button></p></form>`,
    );
  };

  router.get('/oauth/authorize', (req, res) => {
    const r = parseAuthRequest(req.query);
    if ('html' in r) return void res.status(400).send(r.html);
    if ('redirectError' in r) return redirectWith(res, r.redirectUri, { error: r.redirectError, state: r.state });
    res.setHeader('Cache-Control', 'no-store').send(form(r.ok));
  });

  router.post('/oauth/authorize', express.urlencoded({ extended: false, limit: '10kb' }), (req, res) => {
    const r = parseAuthRequest(req.body ?? {});
    if ('html' in r) return void res.status(400).send(r.html);
    if ('redirectError' in r) return redirectWith(res, r.redirectUri, { error: r.redirectError, state: r.state });
    const now = Date.now();
    const key = req.ip ?? 'anon';
    const w = attempts.get(key);
    if (!w || now - w.start > 60_000) attempts.set(key, { start: now, n: 1 });
    else if (++w.n > 10) return void res.status(429).send(form(r.ok, 'Too many attempts. Wait a minute and try again.'));
    const given = typeof req.body?.link_code === 'string' ? req.body.link_code : '';
    const same = createHash('sha256').update(given).digest();
    if (!timingSafeEqual(same, createHash('sha256').update(cfg.linkCode).digest())) {
      deps.repos.audit.write('oauth.link_failed', cfg.householdId, { ip: key });
      return void res.status(401).send(form(r.ok, 'That code is not right.'));
    }
    const code = sign(cfg, { t: 'code', sub: cfg.householdId, cid: r.ok.clientId, aud: resource, exp: Math.floor(now / 1000) + 120, jti: randomUUID(), cc: r.ok.challenge, ru: r.ok.redirectUri });
    deps.repos.audit.write('oauth.code_issued', cfg.householdId, { clientId: r.ok.clientId });
    redirectWith(res, r.ok.redirectUri, { code, state: r.ok.state });
  });

  // --- token -------------------------------------------------------------------------------------------------------
  function clientAuthOk(req: Request): boolean {
    if (!cfg.clientSecret) return req.body?.client_id === cfg.clientId;
    let id = req.body?.client_id as string | undefined;
    let secret = req.body?.client_secret as string | undefined;
    const basic = /^Basic (.+)$/.exec(req.headers.authorization ?? '');
    if (basic) {
      const [u, ...rest] = Buffer.from(basic[1]!, 'base64').toString('utf8').split(':');
      id = decodeURIComponent(u ?? '');
      secret = decodeURIComponent(rest.join(':'));
    }
    if (id !== cfg.clientId || !secret) return false;
    return timingSafeEqual(createHash('sha256').update(secret).digest(), createHash('sha256').update(cfg.clientSecret).digest());
  }

  function issue(sub: string, now: number) {
    const sec = Math.floor(now / 1000);
    return {
      access_token: sign(cfg, { t: 'access', sub, cid: cfg.clientId, aud: resource, exp: sec + cfg.accessTtlSec, jti: randomUUID() }),
      token_type: 'Bearer',
      expires_in: cfg.accessTtlSec,
      refresh_token: sign(cfg, { t: 'refresh', sub, cid: cfg.clientId, aud: resource, exp: sec + cfg.refreshTtlSec, jti: randomUUID() }),
      scope: OAUTH_SCOPE,
    };
  }

  router.post('/oauth/token', express.urlencoded({ extended: false, limit: '10kb' }), (req, res) => {
    const now = Date.now();
    prune(now);
    if (!clientAuthOk(req)) return oauthError(res, 401, 'invalid_client', 'Client authentication failed.');
    const b = req.body ?? {};
    if (b.resource && b.resource !== resource) return oauthError(res, 400, 'invalid_target', 'resource does not match this server.');
    if (b.grant_type === 'authorization_code') {
      const p = typeof b.code === 'string' ? verify(cfg, b.code, 'code', now) : null;
      if (!p || p.cid !== cfg.clientId) return oauthError(res, 400, 'invalid_grant', 'The code is invalid or expired.');
      if (usedCodes.has(p.jti)) return oauthError(res, 400, 'invalid_grant', 'The code was already used.');
      if (b.redirect_uri !== p.ru) return oauthError(res, 400, 'invalid_grant', 'redirect_uri does not match.');
      const verifier = typeof b.code_verifier === 'string' ? b.code_verifier : '';
      if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier) || createHash('sha256').update(verifier).digest('base64url') !== p.cc) {
        return oauthError(res, 400, 'invalid_grant', 'PKCE verification failed.');
      }
      usedCodes.set(p.jti, p.exp * 1000);
      deps.repos.audit.write('oauth.token_issued', p.sub, { grant: 'authorization_code' });
      return void res.setHeader('Cache-Control', 'no-store').json(issue(p.sub, now));
    }
    if (b.grant_type === 'refresh_token') {
      const p = typeof b.refresh_token === 'string' ? verify(cfg, b.refresh_token, 'refresh', now) : null;
      if (!p || p.cid !== cfg.clientId) return oauthError(res, 400, 'invalid_grant', 'The refresh token is invalid or expired.');
      deps.repos.audit.write('oauth.token_issued', p.sub, { grant: 'refresh_token' });
      return void res.setHeader('Cache-Control', 'no-store').json(issue(p.sub, now));
    }
    oauthError(res, 400, 'unsupported_grant_type', 'Use authorization_code or refresh_token.');
  });

  return { router, config: cfg, verifyAccess: (token: string, now = Date.now()) => verify(cfg, token, 'access', now) };
}

export type OAuth = ReturnType<typeof createOAuth>;
