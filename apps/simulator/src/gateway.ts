import { AsyncLocalStorage } from 'node:async_hooks';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

/** The MCP server cannot be reached or answered unexpectedly. The caller must fail closed. */
export class GatewayDown extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GatewayDown';
  }
}

/** The MCP server answered with a tool execution error (isError). */
export class ToolCallError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'ToolCallError';
  }
}

/** What the agent needs from the MCP server. Tests substitute a fake. */
export interface Gateway {
  call<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T>;
}

const trace = new AsyncLocalStorage<string>();
/** Run `fn` so every MCP request it makes carries `x-request-id: traceId` (end-to-end tracing). */
export function withTrace<T>(traceId: string, fn: () => Promise<T>): Promise<T> {
  return trace.run(traceId, fn);
}

export interface McpGatewayOptions {
  url: string;
  token: string;
  timeoutMs?: number;
}

/** A real MCP client over Streamable HTTP. Connects lazily, reconnects once if the server restarted. */
export class McpGateway implements Gateway {
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;
  private lastOk = false;

  constructor(private readonly opts: McpGatewayOptions) {}

  get isUp(): boolean {
    return this.lastOk;
  }

  private connect(): Promise<Client> {
    if (this.client) return Promise.resolve(this.client);
    if (this.connecting) return this.connecting;
    const { url, token } = this.opts;
    this.connecting = (async () => {
      const client = new Client({ name: 'second-opinion-simulator', version: '0.1.0' });
      const transport = new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
        fetch: (input, init) => {
          const id = trace.getStore();
          const headers = new Headers(init?.headers);
          if (id) headers.set('x-request-id', id);
          return fetch(input, { ...init, headers });
        },
      });
      await client.connect(transport);
      this.client = client;
      return client;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  private async drop(): Promise<void> {
    const c = this.client;
    this.client = null;
    this.lastOk = false;
    try {
      await c?.close();
    } catch {
      /* already closed */
    }
  }

  async call<T = Record<string, unknown>>(name: string, args: Record<string, unknown>): Promise<T> {
    const timeout = this.opts.timeoutMs ?? 5000;
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const client = await this.connect();
        const res = (await client.callTool({ name, arguments: args }, undefined, { timeout })) as {
          isError?: boolean;
          structuredContent?: Record<string, unknown>;
          content?: Array<{ type: string; text?: string }>;
        };
        this.lastOk = true;
        if (res.isError) {
          const sc = res.structuredContent as { code?: string; message?: string } | undefined;
          const text = res.content?.find((c) => c.type === 'text')?.text ?? 'tool error';
          throw new ToolCallError(sc?.code ?? 'INTERNAL', sc?.message ?? text);
        }
        if (res.structuredContent) return res.structuredContent as T;
        const text = res.content?.find((c) => c.type === 'text')?.text;
        if (text) return JSON.parse(text) as T;
        throw new GatewayDown('empty tool result');
      } catch (e) {
        if (e instanceof ToolCallError) throw e;
        lastError = e;
        await this.drop();
      }
    }
    throw new GatewayDown(lastError instanceof Error ? lastError.message : String(lastError));
  }

  async close(): Promise<void> {
    await this.drop();
  }

  /** Plain HTTP liveness probe of the MCP server (no MCP handshake). */
  async ping(): Promise<boolean> {
    try {
      const origin = new URL(this.opts.url).origin;
      const res = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(1500) });
      this.lastOk = res.ok;
      return res.ok;
    } catch {
      this.lastOk = false;
      return false;
    }
  }

  /** Dev-only: ask the MCP server to wipe and re-seed itself. */
  async resetServer(): Promise<void> {
    const origin = new URL(this.opts.url).origin;
    const res = await fetch(`${origin}/admin/reset`, { method: 'POST', headers: { Authorization: `Bearer ${this.opts.token}` }, signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new GatewayDown(`reset failed with status ${res.status}`);
    await this.drop();
  }
}
