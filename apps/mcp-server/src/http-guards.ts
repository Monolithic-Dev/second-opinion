import { createHash, timingSafeEqual } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import type { Deps } from './deps';
import { ASSISTANT_FORBIDDEN_TOOLS, type OAuth } from './oauth';

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

/**
 * Auth for /mcp: the static operator token, or (when OAuth is on) an access token issued by our authorization server.
 * An OAuth token is bound to one household (`res.locals.household`). With OAuth on, the 401 carries no WWW-Authenticate header,
 * as the Alexa+ MCP Toolkit requires.
 */
export function mcpAuth(staticToken: string, oauth?: OAuth) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    if (m && safeEqual(m[1] as string, staticToken)) return next();
    const p = m && oauth ? oauth.verifyAccess(m[1] as string) : null;
    if (p) {
      res.locals.household = p.sub;
      return next();
    }
    if (!oauth) res.setHeader('WWW-Authenticate', 'Bearer');
    jsonRpcError(res, 401, -32001, 'Unauthorized');
  };
}

/**
 * An assistant (OAuth) token may only touch its own household, and may never approve a hold or change the rules.
 * Hold ids are checked against the hold's household, so a token cannot reach another household through an id.
 */
export function householdScope(deps: Deps) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const household = res.locals.household as string | undefined;
    if (!household) return next();
    const msgs = Array.isArray(req.body) ? req.body : [req.body];
    for (const msg of msgs) {
      if (!msg || msg.method !== 'tools/call') continue;
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      const deny = (why: string) => jsonRpcError(res, 403, -32003, `Forbidden: ${why}`);
      if (ASSISTANT_FORBIDDEN_TOOLS.has(name)) return deny(`${name} is only available to the family console`);
      if (typeof args.householdId === 'string' && args.householdId !== household) return deny('this token is linked to a different household');
      if (typeof args.holdId === 'string') {
        const hold = deps.repos.holds.get(args.holdId);
        if (hold && hold.household_id !== household) return deny('this token is linked to a different household');
      }
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
