import { z } from 'zod';

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
  };
}
