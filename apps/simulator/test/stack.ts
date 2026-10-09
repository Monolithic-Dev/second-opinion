import { spawn, type ChildProcess } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { createSimApp } from '../src/app';
import { loadSimConfig, type SimConfig } from '../src/config';
import { McpGateway } from '../src/gateway';

export const TOKEN = 'test-token';

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const s = createServer();
    s.listen(0, '127.0.0.1', () => {
      const p = (s.address() as AddressInfo).port;
      s.close(() => resolve(p));
    });
    s.on('error', reject);
  });
}

async function waitFor(url: string, ms = 20_000): Promise<void> {
  const end = Date.now() + ms;
  for (;;) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > end) throw new Error(`timeout waiting for ${url}`);
    await new Promise((r) => setTimeout(r, 150));
  }
}

/** A real MCP server child process (own in-memory database) plus a simulator app on an ephemeral port. */
export async function startStack(simEnv: Record<string, string> = {}) {
  const mcpPort = await freePort();
  const child: ChildProcess = spawn(process.execPath, ['--import', 'tsx', 'apps/mcp-server/src/index.ts'], {
    env: { ...process.env, NODE_ENV: 'test', HOST: '127.0.0.1', MCP_PORT: String(mcpPort), MCP_AUTH_TOKEN: TOKEN, DB_PATH: ':memory:', SEED_DEMO: '1', OUTBOX_DIR: './data/test-outbox' },
    stdio: ['ignore', 'ignore', 'ignore'],
  });
  await waitFor(`http://127.0.0.1:${mcpPort}/healthz`);

  const config: SimConfig = loadSimConfig({
    NODE_ENV: 'test', SIM_PORT: '0', MCP_URL: `http://127.0.0.1:${mcpPort}/mcp`, MCP_AUTH_TOKEN: TOKEN,
    WEB_DIST: './does-not-exist', MCP_TIMEOUT_MS: '3000', ...simEnv,
  });
  const gateway = new McpGateway({ url: config.mcpUrl, token: config.mcpToken, timeoutMs: config.mcpTimeoutMs });
  const { app, hub } = createSimApp({ config, gateway, ping: () => gateway.ping(), resetServer: () => gateway.resetServer() });
  const server: Server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const api = async (path: string, init: { method?: string; body?: unknown; cookie?: string; csrf?: boolean } = {}) => {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (init.csrf !== false && init.method && init.method !== 'GET') headers['x-requested-with'] = 'so';
    if (init.cookie) headers.cookie = init.cookie;
    const res = await fetch(`${base}${path}`, { method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    const text = await res.text();
    let json: any = null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, headers: res.headers };
  };

  // Sessions are cached so the suite does not trip the (correct) login rate limiter; pass fresh=true to really log in.
  const sessions = new Map<string, Awaited<ReturnType<typeof api>> & { cookie: string | undefined }>();
  const login = async (personId = 'p_priya', pin = '1234', fresh = false) => {
    const key = `${personId}:${pin}`;
    const cached = sessions.get(key);
    if (cached && !fresh && cached.status === 200) return cached;
    const r = await api('/api/auth/login', { method: 'POST', body: { personId, pin } });
    const out = { ...r, cookie: r.headers.get('set-cookie')?.split(';')[0] };
    if (r.status === 200) sessions.set(key, out);
    return out;
  };

  /**
   * Wipe and re-seed, then switch quiet hours off so results do not depend on the time of day the tests run
   * (the MCP child process uses the real clock). Quiet hours have their own deterministic tests in the MCP server suite.
   */
  const reset = async () => {
    await api('/api/reset', { method: 'POST' });
    const { cookie } = await login();
    await api('/api/family/policy', { method: 'PUT', body: { householdId: 'hh_demo', patch: { quietHoursStart: '00:00', quietHoursEnd: '00:00' } }, cookie });
  };

  return {
    base, api, login, reset, hub, gateway, config, mcpPort,
    async close() {
      hub.closeAll();
      await gateway.close();
      await new Promise<void>((r) => server.close(() => r()));
      child.kill();
    },
  };
}

export type Stack = Awaited<ReturnType<typeof startStack>>;
