import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import { loadConfig } from '../src/config';
import { sign, verify } from '../src/oauth';
import { HERO, startTestServer } from './helpers';

const PUBLIC = 'https://so.example.test';
const REDIRECT = 'https://pitangui.amazon.com/api/skill/link/TEST';
const ENV = {
  PUBLIC_URL: PUBLIC, OAUTH_CLIENT_ID: 'alexa-plus', OAUTH_CLIENT_SECRET: 'client-secret-0123456789', OAUTH_REDIRECT_URIS: REDIRECT,
  OAUTH_SIGNING_KEY: 'k'.repeat(40), OAUTH_LINK_CODE: 'family-link-1', OAUTH_HOUSEHOLD: 'hh_demo',
};

const pkce = () => {
  const verifier = randomBytes(48).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};
const authQuery = (challenge: string, over: Record<string, string> = {}) =>
  new URLSearchParams({
    response_type: 'code', client_id: 'alexa-plus', redirect_uri: REDIRECT, state: 'st-1', code_challenge: challenge, code_challenge_method: 'S256', resource: PUBLIC, ...over,
  });

async function setup() {
  const t = await startTestServer(ENV);
  const post = (path: string, body: URLSearchParams, headers: Record<string, string> = {}) =>
    fetch(`${t.baseUrl}${path}`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body });
  /** Run the browser part: submit the link form, return the authorization code from the redirect. */
  async function authorize(challenge: string, linkCode = ENV.OAUTH_LINK_CODE) {
    const q = authQuery(challenge);
    q.set('link_code', linkCode);
    const res = await post('/oauth/authorize', q);
    const loc = res.headers.get('location');
    return { res, code: loc ? new URL(loc).searchParams.get('code') : null, location: loc };
  }
  const token = (fields: Record<string, string>) =>
    post('/oauth/token', new URLSearchParams({ client_id: 'alexa-plus', client_secret: ENV.OAUTH_CLIENT_SECRET, ...fields }));
  async function tokens() {
    const { verifier, challenge } = pkce();
    const { code } = await authorize(challenge);
    const res = await token({ grant_type: 'authorization_code', code: code!, redirect_uri: REDIRECT, code_verifier: verifier, resource: PUBLIC });
    return (await res.json()) as { access_token: string; refresh_token: string; token_type: string; expires_in: number };
  }
  return { t, post, authorize, token, tokens };
}

test('T-OAUTH-1 discovery: protected-resource and authorization-server metadata say S256, our endpoints and our resource', async () => {
  const { t } = await setup();
  try {
    const prm = (await (await fetch(`${t.baseUrl}/.well-known/oauth-protected-resource`)).json()) as Record<string, unknown>;
    assert.equal(prm.resource, PUBLIC);
    assert.deepEqual(prm.authorization_servers, [PUBLIC]);
    const as = (await (await fetch(`${t.baseUrl}/.well-known/oauth-authorization-server`)).json()) as Record<string, unknown>;
    assert.deepEqual(as.code_challenge_methods_supported, ['S256']);
    assert.equal(as.authorization_endpoint, `${PUBLIC}/oauth/authorize`);
    assert.equal(as.token_endpoint, `${PUBLIC}/oauth/token`);
    assert.deepEqual(as.grant_types_supported, ['authorization_code', 'refresh_token']);
  } finally {
    await t.close();
  }
});

test('T-OAUTH-2 full flow: link page, code, PKCE token exchange, then a real MCP client calls a tool with the access token', async () => {
  const { t, tokens } = await setup();
  try {
    const { challenge } = pkce();
    const page = await fetch(`${t.baseUrl}/oauth/authorize?${authQuery(challenge)}`);
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Link Alexa\+ to Dorothy/);

    const tk = await tokens();
    assert.equal(tk.token_type, 'Bearer');
    assert.equal(tk.expires_in, 3600);

    const { client } = await t.connect(tk.access_token);
    const r = await t.call<{ verdict: string }>(client, 'check_message', { householdId: 'hh_demo', text: HERO, context: { actionType: 'purchase', amountCents: 100000, payee: 'gift cards' } });
    assert.equal(r.structuredContent?.verdict, 'hold');
    await client.close();
  } finally {
    await t.close();
  }
});

test('T-OAUTH-3 a wrong link code gets no code and is audited; the form is shown again', async () => {
  const { t, authorize } = await setup();
  try {
    const { res, code } = await authorize(pkce().challenge, 'not-the-code');
    assert.equal(res.status, 401);
    assert.equal(code, null);
    assert.match(await res.text(), /not right/);
    const n = (t.deps.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'oauth.link_failed'").get() as { n: number }).n;
    assert.equal(n, 1);
  } finally {
    await t.close();
  }
});

test('T-OAUTH-4 requests with a bad client or redirect are never redirected; plain PKCE and wrong resource are refused', async () => {
  const { t } = await setup();
  try {
    const { challenge } = pkce();
    const go = (over: Record<string, string>) => fetch(`${t.baseUrl}/oauth/authorize?${authQuery(challenge, over)}`, { redirect: 'manual' });
    assert.equal((await go({ client_id: 'evil' })).status, 400);
    assert.equal((await go({ redirect_uri: 'https://evil.example/cb' })).status, 400);
    const plain = await go({ code_challenge_method: 'plain' });
    assert.equal(plain.status, 302);
    assert.equal(new URL(plain.headers.get('location')!).searchParams.get('error'), 'invalid_request');
    const wrongResource = await go({ resource: 'https://other.example' });
    assert.equal(new URL(wrongResource.headers.get('location')!).searchParams.get('error'), 'invalid_target');
  } finally {
    await t.close();
  }
});

test('T-OAUTH-5 a code works once, only with the right verifier, redirect_uri and client secret', async () => {
  const { t, authorize, token } = await setup();
  try {
    const a = pkce();
    const { code } = await authorize(a.challenge);
    const base = { grant_type: 'authorization_code', code: code!, redirect_uri: REDIRECT };
    assert.equal((await token({ ...base, code_verifier: pkce().verifier })).status, 400, 'wrong verifier');
    assert.equal((await token({ ...base, redirect_uri: 'https://evil.example/cb', code_verifier: a.verifier })).status, 400, 'wrong redirect');
    const noSecret = await t.deps.config.oauth && (await fetch(`${t.baseUrl}/oauth/token`, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ ...base, client_id: 'alexa-plus', code_verifier: a.verifier }),
    }));
    assert.equal(noSecret?.status, 401, 'client secret required');
    assert.equal((await token({ ...base, code_verifier: a.verifier })).status, 200);
    const again = await token({ ...base, code_verifier: a.verifier });
    assert.equal(again.status, 400);
    assert.equal(((await again.json()) as { error: string }).error, 'invalid_grant');
  } finally {
    await t.close();
  }
});

test('T-OAUTH-6 refresh tokens mint new access tokens; an access token is not a refresh token; tampering and expiry are rejected', async () => {
  const { t, token, tokens } = await setup();
  try {
    const tk = await tokens();
    const refreshed = await token({ grant_type: 'refresh_token', refresh_token: tk.refresh_token });
    assert.equal(refreshed.status, 200);
    assert.equal((await token({ grant_type: 'refresh_token', refresh_token: tk.access_token })).status, 400);
    const forged = tk.access_token.slice(0, -2) + 'AA';
    const res = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: { authorization: `Bearer ${forged}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: '{}' });
    assert.equal(res.status, 401);

    const cfg = t.deps.config.oauth!;
    const stale = sign(cfg, { t: 'access', sub: 'hh_demo', cid: 'alexa-plus', aud: PUBLIC, exp: 1000, jti: 'x' });
    assert.equal(verify(cfg, stale, 'access'), null, 'expired');
    const otherAudience = sign(cfg, { t: 'access', sub: 'hh_demo', cid: 'alexa-plus', aud: 'https://other.example', exp: 9_999_999_999, jti: 'y' });
    assert.equal(verify(cfg, otherAudience, 'access'), null, 'token for another resource');
  } finally {
    await t.close();
  }
});

test('T-OAUTH-7 the assistant token cannot approve a hold, change rules or reach another household; the operator token can', async () => {
  const { t, tokens } = await setup();
  try {
    const tk = await tokens();
    const { client: assistant } = await t.connect(tk.access_token);
    const hold = await t.call<{ checkId: string }>(assistant, 'check_message', { householdId: 'hh_demo', text: HERO, context: { actionType: 'purchase', amountCents: 100000, payee: 'gift cards' } });
    const placed = await t.call<{ holdId: string }>(assistant, 'place_hold', { householdId: 'hh_demo', checkId: hold.structuredContent!.checkId, actionType: 'purchase', amountCents: 100000, payee: 'gift cards', description: '5 x $200 gift cards' });
    const holdId = placed.structuredContent!.holdId;

    const asCall = (name: string, args: Record<string, unknown>) =>
      fetch(`${t.baseUrl}/mcp`, {
        method: 'POST',
        headers: { authorization: `Bearer ${tk.access_token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
      });
    assert.equal((await asCall('resolve_approval', { holdId, decision: 'approve', resolvedBy: 'p_priya' })).status, 403);
    assert.equal((await asCall('set_policy', { householdId: 'hh_demo' })).status, 403);
    assert.equal((await asCall('get_household', { householdId: 'hh_other' })).status, 403);
    assert.equal(t.deps.repos.holds.get(holdId)?.status, 'pending', 'the hold is still pending');

    const { client: operator } = await t.connect();
    const ok = await t.call<{ status: string }>(operator, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_priya' });
    assert.equal(ok.isError, undefined);
    await assistant.close();
    await operator.close();
  } finally {
    await t.close();
  }
});

test('T-OAUTH-8 with OAuth on, an unauthenticated /mcp request is 401 without a WWW-Authenticate header (Alexa+ requirement)', async () => {
  const { t } = await setup();
  try {
    const res = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.status, 401);
    assert.equal(res.headers.get('www-authenticate'), null);
  } finally {
    await t.close();
  }
  const plain = await startTestServer();
  try {
    const res = await fetch(`${plain.baseUrl}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    assert.equal(res.headers.get('www-authenticate'), 'Bearer');
    assert.equal((await fetch(`${plain.baseUrl}/.well-known/oauth-authorization-server`)).status, 404, 'no OAuth endpoints when it is off');
  } finally {
    await plain.close();
  }
});

test('T-OAUTH-9 configuration is validated: secrets, link code, redirect URIs and https in production', () => {
  const base = { NODE_ENV: 'test', ...ENV };
  assert.ok(loadConfig(base).oauth);
  assert.equal(loadConfig({ NODE_ENV: 'test' }).oauth, undefined);
  assert.throws(() => loadConfig({ ...base, OAUTH_SIGNING_KEY: 'short' }), /Invalid configuration/);
  assert.throws(() => loadConfig({ ...base, OAUTH_LINK_CODE: undefined }), /OAuth needs/);
  assert.throws(() => loadConfig({ ...base, OAUTH_REDIRECT_URIS: 'http://evil.example/cb' }), /must be https/);
  assert.throws(() => loadConfig({ ...base, NODE_ENV: 'production', MCP_AUTH_TOKEN: 'x'.repeat(30), PUBLIC_URL: 'http://so.example.test' }), /PUBLIC_URL must be https/);
});
