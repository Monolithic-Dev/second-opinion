import type { AddressInfo } from 'node:net';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { fakeClock } from '@second-opinion/shared';
import { createRepos, migrate, openDb, seedDemo } from '@second-opinion/store';
import { createApp } from '../src/app';
import { loadConfig } from '../src/config';
import { silentLogger } from '../src/logging';
import type { Deps } from '../src/deps';

export const TOKEN = 'test-token';

export async function startTestServer(env: Record<string, string> = {}) {
  const config = loadConfig({ NODE_ENV: 'test', MCP_AUTH_TOKEN: TOKEN, MCP_PORT: '0', DB_PATH: ':memory:', ...env });
  const clock = fakeClock('2026-10-09T12:00:00.000Z');
  const db = openDb(':memory:');
  migrate(db);
  const repos = config.seedDemo ? seedDemo(db, clock) : createRepos(db, clock);
  const deps: Deps = { db, repos, clock, config, log: silentLogger };
  const app = createApp(deps);
  const server = await new Promise<import('node:http').Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  async function connect(token: string = TOKEN) {
    const client = new Client({ name: 'test-client', version: '0.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    });
    await client.connect(transport);
    return { client, transport };
  }

  async function call<T = Record<string, unknown>>(client: Client, name: string, args: Record<string, unknown>) {
    const res = await client.callTool({ name, arguments: args });
    return res as { isError?: boolean; structuredContent?: T & { code?: string; message?: string }; content: Array<{ type: string; text: string }> };
  }

  return {
    baseUrl, deps, clock, repos, connect, call,
    close: () => new Promise<void>((resolve) => server.close(() => { db.close(); resolve(); })),
  };
}

export const HERO = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';
