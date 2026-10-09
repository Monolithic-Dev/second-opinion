import { randomUUID } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { Deps } from './deps';
import { buildServer, SERVER_VERSION } from './server';
import { bearerAuth, originGuard, protocolGuard, rateLimit } from './http-guards';

const METHOD_NOT_ALLOWED = { jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this server is stateless, use POST' }, id: null };

/** Express app: /healthz, /readyz, and the stateless Streamable HTTP endpoint /mcp (docs/mcp-best-practices.md §1). */
export function createApp(deps: Deps) {
  const app = express();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    const given = req.headers['x-request-id'];
    const id = typeof given === 'string' && /^[\w.-]{8,64}$/.test(given) ? given : randomUUID();
    req.headers['x-request-id'] = id;
    res.setHeader('x-request-id', id);
    next();
  });
  app.use(express.json({ limit: '100kb' }));

  app.get('/healthz', (_req, res) => {
    res.json({ ok: true, version: SERVER_VERSION });
  });
  app.get('/readyz', (_req, res) => {
    try {
      deps.db.prepare('SELECT 1').get();
      res.json({ ok: true });
    } catch {
      res.status(503).json({ ok: false });
    }
  });

  const guards = [originGuard(deps.config.allowedOrigins), bearerAuth(deps.config.authToken), protocolGuard(), rateLimit(deps.config.rateLimitPerMin)];

  app.post('/mcp', ...guards, async (req: Request, res: Response) => {
    const server = buildServer(deps);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (e) {
      deps.log.error('mcp_request_failed', { error: e instanceof Error ? e.message : String(e) });
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal server error' }, id: null });
    }
  });

  const notAllowed = (_req: Request, res: Response) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json(METHOD_NOT_ALLOWED);
  };
  app.get('/mcp', ...guards, notAllowed);
  app.delete('/mcp', ...guards, notAllowed);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    if (status >= 500) deps.log.error('http_error', { error: err instanceof Error ? err.message : String(err) });
    res.status(status).json({ jsonrpc: '2.0', error: { code: status === 400 ? -32700 : -32603, message: status === 400 ? 'Bad request' : 'Internal server error' }, id: null });
  });

  return app;
}
