import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ID_PATTERN } from '@second-opinion/shared';
import { z } from 'zod';
import { runTurn } from './agent/router';
import type { SimConfig } from './config';
import { EventHub } from './events';
import { GatewayDown, ToolCallError, type Gateway } from './gateway';
import { clearCookieHeader, cookieHeader, parseCookies, pinMatches, SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession, type Session } from './session';

export interface SimDeps {
  config: SimConfig;
  gateway: Gateway;
  /** Liveness probe of the MCP server and a dev reset hook; optional so tests can use a fake gateway. */
  ping?: () => Promise<boolean>;
  resetServer?: () => Promise<void>;
  hub?: EventHub;
}

const id = z.string().max(80).regex(ID_PATTERN);
const utterBody = z.object({ householdId: id, speaker: z.enum(['elder', 'family']), text: z.string().trim().min(1).max(2000), personId: id.optional() });
const voteBody = z.object({ decision: z.enum(['approve', 'deny']), note: z.string().trim().max(300).optional() });
const loginBody = z.object({ personId: id, pin: z.string().min(1).max(32) });
const policyBody = z.object({ householdId: id, patch: z.record(z.string(), z.unknown()) });
const payeeBody = z.object({ householdId: id, name: z.string().trim().min(1).max(100), kind: z.enum(['pharmacy', 'utility', 'family', 'merchant', 'other']).optional() });

const STATUS: Record<string, number> = { INVALID_INPUT: 400, NOT_FOUND: 404, FORBIDDEN: 403, CONFLICT: 409 };

type Req = Request & { session?: Session };

function fail(res: Response, status: number, code: string, message: string): void {
  res.status(status).json({ error: { code, message } });
}

/** Fixed-window limiter, keyed by client address. */
function limiter(perMin: number) {
  const windows = new Map<string, { start: number; n: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    const key = req.ip ?? 'anon';
    const now = Date.now();
    const w = windows.get(key);
    if (!w || now - w.start > 60_000) {
      windows.set(key, { start: now, n: 1 });
      return next();
    }
    if (++w.n > perMin) return fail(res, 429, 'RATE_LIMITED', 'Too many attempts. Try again in a minute.');
    next();
  };
}

export function createSimApp(deps: SimDeps) {
  const { config, gateway } = deps;
  const hub = deps.hub ?? new EventHub();
  const secure = config.env === 'production';
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '50kb' }));

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'");
    next();
  });

  // CSRF: state-changing API calls must carry a custom header a cross-site form cannot send; the cookie is SameSite=Lax.
  app.use('/api', (req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.headers['x-requested-with'] !== 'so') {
      return fail(res, 403, 'CSRF', 'Missing X-Requested-With header');
    }
    next();
  });

  app.use((req: Req, _res, next) => {
    req.session = verifySession(parseCookies(req.headers.cookie)[SESSION_COOKIE], config.sessionSecret) ?? undefined;
    next();
  });
  const requireFamily = (req: Req, res: Response, next: NextFunction): void => {
    if (!req.session) return fail(res, 401, 'UNAUTHENTICATED', 'Sign in as a family member first.');
    next();
  };

  const wrap = (fn: (req: Req, res: Response) => Promise<void>) => async (req: Req, res: Response) => {
    try {
      await fn(req, res);
    } catch (e) {
      if (e instanceof z.ZodError) return fail(res, 400, 'INVALID_INPUT', e.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
      if (e instanceof ToolCallError) return fail(res, STATUS[e.code] ?? 500, e.code, e.message);
      if (e instanceof GatewayDown) return fail(res, 503, 'UNAVAILABLE', "I couldn't reach the safety checker, so nothing was done.");
      return fail(res, 500, 'INTERNAL', 'Something went wrong.');
    }
  };

  app.get('/healthz', async (_req, res) => {
    res.json({ ok: true, mcp: deps.ping ? await deps.ping() : true, sse: hub.size });
  });

  app.get('/api/events', (_req, res) => {
    if (!hub.subscribe(res)) fail(res, 503, 'BUSY', 'Too many open event streams.');
  });

  // ---- elder / device side (no login: it models the voice device in the home)
  app.post('/api/utter', requireFamilyForFamilySpeaker, wrap(async (req, res) => {
    const body = utterBody.parse(req.body);
    const personId = body.speaker === 'family' ? (req.session?.personId ?? body.personId) : undefined;
    res.json(await runTurn({ ...body, personId }, gateway, hub.publish));
  }));

  function requireFamilyForFamilySpeaker(req: Req, res: Response, next: NextFunction): void {
    if ((req.body as { speaker?: string } | undefined)?.speaker === 'family' && !req.session) return fail(res, 401, 'UNAUTHENTICATED', 'Sign in as a family member first.');
    next();
  }

  app.get('/api/state', wrap(async (req, res) => {
    const householdId = id.default(config.defaultHousehold).parse(req.query.householdId);
    const [household, holds, payees, policy, notifications] = await Promise.all([
      gateway.call('get_household', { householdId }),
      gateway.call('list_holds', { householdId }),
      gateway.call('trusted_payees', { householdId, action: 'list' }),
      gateway.call('get_policy', { householdId }),
      gateway.call('list_notifications', { householdId, limit: 30 }),
    ]);
    res.json({ ...(household as object), ...(holds as object), ...(payees as object), ...(policy as object), ...(notifications as object) });
  }));

  // ---- family sign-in (demo credentials; production uses real identity)
  app.post('/api/auth/login', limiter(10), wrap(async (req, res) => {
    const { personId, pin } = loginBody.parse(req.body);
    if (!pinMatches(pin, config.pins[personId])) return fail(res, 401, 'BAD_CREDENTIALS', 'Wrong PIN.');
    const token = signSession({ personId, exp: Date.now() + SESSION_TTL_MS }, config.sessionSecret);
    res.setHeader('Set-Cookie', cookieHeader(token, secure));
    res.json({ personId });
  }));
  app.post('/api/auth/logout', (_req, res) => {
    res.setHeader('Set-Cookie', clearCookieHeader(secure));
    res.json({ ok: true });
  });
  app.get('/api/auth/me', (req: Req, res) => {
    res.json({ personId: req.session?.personId ?? null });
  });

  // ---- family console
  app.post('/api/family/holds/:holdId/vote', requireFamily, wrap(async (req, res) => {
    const holdId = id.parse(req.params.holdId);
    const body = voteBody.parse(req.body);
    const out = (await gateway.call('resolve_approval', {
      holdId, decision: body.decision, resolvedBy: req.session!.personId, ...(body.note ? { note: body.note } : {}),
    })) as { status: string };
    hub.publish('hold.resolved', { holdId, status: out.status });
    res.json(out);
  }));

  app.put('/api/family/policy', requireFamily, wrap(async (req, res) => {
    const body = policyBody.parse(req.body);
    const out = await gateway.call('set_policy', { householdId: body.householdId, requestedBy: req.session!.personId, patch: body.patch });
    hub.publish('policy.updated', { householdId: body.householdId });
    res.json(out);
  }));

  app.post('/api/family/payees', requireFamily, wrap(async (req, res) => {
    const body = payeeBody.parse(req.body);
    const out = await gateway.call('trusted_payees', { householdId: body.householdId, action: 'add', name: body.name, kind: body.kind ?? 'other', requestedBy: req.session!.personId });
    hub.publish('payee.updated', { householdId: body.householdId });
    res.json(out);
  }));
  app.delete('/api/family/payees', requireFamily, wrap(async (req, res) => {
    const body = payeeBody.pick({ householdId: true, name: true }).parse(req.body);
    const out = await gateway.call('trusted_payees', { householdId: body.householdId, action: 'remove', name: body.name, requestedBy: req.session!.personId });
    hub.publish('payee.updated', { householdId: body.householdId });
    res.json(out);
  }));

  app.get('/api/family/insights', requireFamily, wrap(async (req, res) => {
    const householdId = id.default(config.defaultHousehold).parse(req.query.householdId);
    const days = z.coerce.number().int().min(1).max(90).default(30).parse(req.query.days);
    res.json(await gateway.call('household_insights', { householdId, days }));
  }));

  // ---- demo helper: wipe and re-seed everything
  app.post('/api/reset', wrap(async (req, res) => {
    if (config.env === 'production' && !req.session) return fail(res, 401, 'UNAUTHENTICATED', 'Sign in first.');
    if (!deps.resetServer) return fail(res, 501, 'NOT_IMPLEMENTED', 'Reset is not available.');
    await deps.resetServer();
    hub.publish('reset', {});
    res.json({ ok: true });
  }));

  // ---- static web app (built by apps/web) with SPA fallback
  const dist = resolve(config.webDist);
  if (existsSync(dist)) {
    app.use(express.static(dist, { index: 'index.html', maxAge: config.env === 'production' ? '1h' : 0 }));
    app.get(/^\/(?!api\/|healthz).*/, (_req, res) => res.sendFile(resolve(dist, 'index.html')));
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const status = (err as { status?: number })?.status ?? 500;
    fail(res, status, status === 400 ? 'INVALID_INPUT' : 'INTERNAL', status === 400 ? 'Malformed request.' : 'Something went wrong.');
  });

  return { app, hub };
}
