import { z } from 'zod';
import type { OAuthConfig } from './oauth';

const DEFAULT_TOKEN = 'dev-token';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  MCP_PORT: z.coerce.number().int().min(0).max(65535).default(3001),
  MCP_AUTH_TOKEN: z.string().min(1).default(DEFAULT_TOKEN),
  MCP_ALLOWED_ORIGINS: z.string().default('http://localhost:3000'),
  MCP_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(600),
  DB_PATH: z.string().min(1).default('./data/second-opinion.db'),
  HOLD_TTL_MS: z.coerce.number().int().min(1000).optional(),
  SEED_DEMO: z.enum(['0', '1']).default('1'),
  NOTIFY_CHANNELS: z.string().default('console,db,email_html'),
  OUTBOX_DIR: z.string().default('./data/outbox'),
  ADMIN_ENABLED: z.enum(['0', '1']).optional(),
  JOBS_INTERVAL_MS: z.coerce.number().int().min(0).default(15000),
  // OAuth 2.1 for assistant linking (Alexa+). Enabled when OAUTH_CLIENT_ID is set.
  PUBLIC_URL: z.string().url().optional(),
  OAUTH_CLIENT_ID: z.string().min(1).optional(),
  OAUTH_CLIENT_SECRET: z.string().min(16).optional(),
  OAUTH_REDIRECT_URIS: z.string().default(''),
  OAUTH_SIGNING_KEY: z.string().min(32).optional(),
  OAUTH_LINK_CODE: z.string().min(6).optional(),
  OAUTH_HOUSEHOLD: z.string().min(1).default('hh_demo'),
  /** Tests and demos only: freeze the server clock at this ISO time so results do not depend on the time of day. */
  FIXED_NOW: z.string().datetime().optional(),
  OAUTH_ACCESS_TTL_SEC: z.coerce.number().int().min(60).default(3600),
  OAUTH_REFRESH_TTL_SEC: z.coerce.number().int().min(300).default(2592000),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  authToken: string;
  allowedOrigins: string[];
  rateLimitPerMin: number;
  dbPath: string;
  /** Optional override of the household policy hold lifetime (tests, ops). */
  holdTtlOverrideMs: number | undefined;
  seedDemo: boolean;
  notifyChannels: Array<'console' | 'db' | 'email_html'>;
  outboxDir: string;
  /** Dev-only endpoints such as POST /admin/reset. Off by default in production. */
  adminEnabled: boolean;
  /** 0 disables the background jobs (tests run them explicitly). */
  jobsIntervalMs: number;
  /** Present when OAuth account linking is enabled. */
  oauth: OAuthConfig | undefined;
  fixedNow: string | undefined;
}

function parseChannels(raw: string): Config['notifyChannels'] {
  const allowed = ['console', 'db', 'email_html'] as const;
  const out = raw.split(',').map((c) => c.trim()).filter(Boolean);
  for (const c of out) if (!(allowed as readonly string[]).includes(c)) throw new Error(`Invalid configuration: NOTIFY_CHANNELS has unknown channel ${c}`);
  return out as Config['notifyChannels'];
}

/** Validate environment once at startup. Throws a readable error on bad values. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid configuration: ${msg}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && (e.MCP_AUTH_TOKEN === DEFAULT_TOKEN || e.MCP_AUTH_TOKEN.length < 24)) {
    throw new Error('Invalid configuration: MCP_AUTH_TOKEN must be set to a random value of at least 24 characters in production');
  }
  if (e.NODE_ENV === 'production' && e.FIXED_NOW) throw new Error('Invalid configuration: FIXED_NOW is not allowed in production');
  let oauth: OAuthConfig | undefined;
  if (e.OAUTH_CLIENT_ID) {
    const redirectUris = e.OAUTH_REDIRECT_URIS.split(',').map((x) => x.trim()).filter(Boolean);
    const publicUrl = (e.PUBLIC_URL ?? `http://127.0.0.1:${e.MCP_PORT}`).replace(/\/+$/, '');
    if (!e.OAUTH_SIGNING_KEY || !e.OAUTH_LINK_CODE || redirectUris.length === 0) {
      throw new Error('Invalid configuration: OAuth needs OAUTH_SIGNING_KEY (32+ chars), OAUTH_LINK_CODE (6+ chars) and OAUTH_REDIRECT_URIS');
    }
    if (e.NODE_ENV === 'production' && !publicUrl.startsWith('https://')) throw new Error('Invalid configuration: PUBLIC_URL must be https in production');
    for (const u of redirectUris) if (!/^https:\/\//.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u)) throw new Error(`Invalid configuration: redirect URI ${u} must be https (or localhost)`);
    oauth = {
      publicUrl, clientId: e.OAUTH_CLIENT_ID, clientSecret: e.OAUTH_CLIENT_SECRET, redirectUris, signingKey: e.OAUTH_SIGNING_KEY, linkCode: e.OAUTH_LINK_CODE,
      householdId: e.OAUTH_HOUSEHOLD, accessTtlSec: e.OAUTH_ACCESS_TTL_SEC, refreshTtlSec: e.OAUTH_REFRESH_TTL_SEC,
    };
  }
  return {
    env: e.NODE_ENV,
    host: e.HOST,
    port: e.MCP_PORT,
    authToken: e.MCP_AUTH_TOKEN,
    allowedOrigins: e.MCP_ALLOWED_ORIGINS.split(',').map((s) => s.trim()).filter(Boolean),
    rateLimitPerMin: e.MCP_RATE_LIMIT_PER_MIN,
    dbPath: e.DB_PATH,
    holdTtlOverrideMs: e.HOLD_TTL_MS,
    seedDemo: e.SEED_DEMO === '1',
    notifyChannels: parseChannels(e.NOTIFY_CHANNELS),
    outboxDir: e.OUTBOX_DIR,
    adminEnabled: e.ADMIN_ENABLED ? e.ADMIN_ENABLED === '1' : e.NODE_ENV !== 'production',
    jobsIntervalMs: e.NODE_ENV === 'test' ? 0 : e.JOBS_INTERVAL_MS,
    oauth,
    fixedNow: e.FIXED_NOW,
  };
}
