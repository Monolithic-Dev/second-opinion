import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';

function jsonRpcError(res: Response, status: number, code: number, message: string): void {
  res.status(status).json({ jsonrpc: '2.0', error: { code, message }, id: null });
}

/** Spec 2025-11-25: invalid Origin MUST get 403. Requests without Origin (non-browser clients) are allowed. */
export function originGuard(allowed: string[]) {
  const set = new Set(allowed);
  return (req: Request, res: Response, next: NextFunction): void => {
    const origin = req.headers.origin;
    if (origin && !set.has(origin)) return jsonRpcError(res, 403, -32000, 'Forbidden: invalid Origin');
    next();
  };
}

function safeEqual(a: string, b: string): boolean {
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Static bearer token (hackathon build). Production: OAuth 2.1 resource server, see docs/mcp-best-practices.md. */
export function bearerAuth(token: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const header = req.headers.authorization ?? '';
    const m = /^Bearer (.+)$/.exec(header);
    if (!m || !safeEqual(m[1] as string, token)) {
      res.setHeader('WWW-Authenticate', 'Bearer');
      return jsonRpcError(res, 401, -32001, 'Unauthorized');
    }
    next();
  };
}

/** Unsupported `MCP-Protocol-Version` MUST get 400. A missing header is tolerated (spec backwards-compat rule). */
export function protocolGuard() {
  const supported = new Set<string>(SUPPORTED_PROTOCOL_VERSIONS);
  return (req: Request, res: Response, next: NextFunction): void => {
    const v = req.headers['mcp-protocol-version'];
    if (typeof v === 'string' && !supported.has(v)) {
      return jsonRpcError(res, 400, -32000, `Bad Request: unsupported MCP-Protocol-Version ${v}`);
    }
    next();
  };
}

/** Fixed-window limiter per bearer token / IP. */
export function rateLimit(perMin: number, now: () => number = Date.now) {
  const windows = new Map<string, { start: number; count: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = createHash('sha256').update(req.headers.authorization ?? req.ip ?? 'anon').digest('hex').slice(0, 16);
    const t = now();
    const w = windows.get(key);
    if (!w || t - w.start >= 60_000) {
      windows.set(key, { start: t, count: 1 });
      return next();
    }
    w.count += 1;
    if (w.count > perMin) {
      res.setHeader('Retry-After', String(Math.max(1, Math.ceil((60_000 - (t - w.start)) / 1000))));
      return jsonRpcError(res, 429, -32002, 'Too Many Requests');
    }
    next();
  };
}
