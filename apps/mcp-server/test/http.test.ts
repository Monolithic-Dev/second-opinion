import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, TOKEN } from './helpers';
import { loadConfig } from '../src/config';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

const initBody = {
  jsonrpc: '2.0', id: 1, method: 'initialize',
  params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'x', version: '1' } },
};
const headers = (extra: Record<string, string> = {}) => ({
  'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${TOKEN}`, ...extra,
});

test('healthz and readyz are open', async () => {
  const h = await fetch(`${t.baseUrl}/healthz`);
  assert.equal(h.status, 200);
  assert.equal(((await h.json()) as { ok: boolean }).ok, true);
  assert.equal((await fetch(`${t.baseUrl}/readyz`)).status, 200);
});

test('AC-11 mcp without or with a wrong token returns 401', async () => {
  const none = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(initBody) });
  assert.equal(none.status, 401);
  assert.equal(none.headers.get('www-authenticate'), 'Bearer');
  const wrong = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: headers({ authorization: 'Bearer nope' }), body: JSON.stringify(initBody) });
  assert.equal(wrong.status, 401);
});

test('T-PROTO-3 invalid Origin returns 403, absent Origin is allowed', async () => {
  const bad = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: headers({ origin: 'https://evil.example' }), body: JSON.stringify(initBody) });
  assert.equal(bad.status, 403);
  const good = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: headers({ origin: 'http://localhost:3000' }), body: JSON.stringify(initBody) });
  assert.equal(good.status, 200);
});

test('T-PROTO-2 unsupported MCP-Protocol-Version returns 400', async () => {
  const res = await fetch(`${t.baseUrl}/mcp`, {
    method: 'POST', headers: headers({ 'mcp-protocol-version': '1999-01-01' }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' }),
  });
  assert.equal(res.status, 400);
});

test('GET and DELETE /mcp return 405 (stateless server)', async () => {
  for (const method of ['GET', 'DELETE']) {
    const res = await fetch(`${t.baseUrl}/mcp`, { method, headers: headers() });
    assert.equal(res.status, 405, method);
    assert.equal(res.headers.get('allow'), 'POST');
  }
});

test('T-PROTO-1 server negotiates protocol 2025-11-25', async () => {
  const res = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: headers(), body: JSON.stringify(initBody) });
  assert.equal(res.status, 200);
  const body = (await res.json()) as { result: { protocolVersion: string; serverInfo: { name: string }; capabilities: { tools: unknown } } };
  assert.equal(body.result.protocolVersion, '2025-11-25');
  assert.equal(body.result.serverInfo.name, 'second-opinion');
  assert.ok(body.result.capabilities.tools);
  assert.equal(res.headers.get('mcp-session-id'), null, 'stateless: no session id');
});

test('oversized body is rejected', async () => {
  const res = await fetch(`${t.baseUrl}/mcp`, { method: 'POST', headers: headers(), body: JSON.stringify({ pad: 'x'.repeat(200_000) }) });
  assert.equal(res.status, 413);
});

test('rate limit returns 429 with Retry-After', async () => {
  const limited = await startTestServer({ MCP_RATE_LIMIT_PER_MIN: '3' });
  try {
    const codes: number[] = [];
    for (let i = 0; i < 5; i++) {
      const r = await fetch(`${limited.baseUrl}/mcp`, { method: 'POST', headers: headers(), body: JSON.stringify(initBody) });
      codes.push(r.status);
      if (r.status === 429) assert.ok(r.headers.get('retry-after'));
    }
    assert.deepEqual(codes.slice(0, 3), [200, 200, 200]);
    assert.ok(codes.includes(429));
  } finally {
    await limited.close();
  }
});

test('production config rejects the default or a short token', () => {
  assert.throws(() => loadConfig({ NODE_ENV: 'production' }), /MCP_AUTH_TOKEN/);
  assert.throws(() => loadConfig({ NODE_ENV: 'production', MCP_AUTH_TOKEN: 'short' }), /MCP_AUTH_TOKEN/);
  assert.doesNotThrow(() => loadConfig({ NODE_ENV: 'production', MCP_AUTH_TOKEN: 'x'.repeat(32) }));
  assert.throws(() => loadConfig({ MCP_PORT: 'abc' }), /Invalid configuration/);
});
