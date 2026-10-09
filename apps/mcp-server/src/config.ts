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
  HOLD_TTL_MS: z.coerce.number().int().min(1000).default(10 * 60 * 1000),
  SEED_DEMO: z.enum(['0', '1']).default('1'),
});

export interface Config {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  authToken: string;
  allowedOrigins: string[];
  rateLimitPerMin: number;
  dbPath: string;
  holdTtlMs: number;
  seedDemo: boolean;
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
    holdTtlMs: e.HOLD_TTL_MS,
    seedDemo: e.SEED_DEMO === '1',
  };
}
