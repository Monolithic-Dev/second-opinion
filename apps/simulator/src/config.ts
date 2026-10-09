import { z } from 'zod';

const DEV_SECRET = 'dev-session-secret-change-me';
const DEV_PINS = 'p_priya:1234,p_arjun:5678';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  SIM_PORT: z.coerce.number().int().min(0).max(65535).default(3000),
  MCP_URL: z.string().url().default('http://127.0.0.1:3001/mcp'),
  MCP_AUTH_TOKEN: z.string().min(1).default('dev-token'),
  SESSION_SECRET: z.string().min(16).default(DEV_SECRET),
  FAMILY_PINS: z.string().default(DEV_PINS),
  WEB_DIST: z.string().default('./apps/web/dist'),
  DEFAULT_HOUSEHOLD: z.string().default('hh_demo'),
  MCP_TIMEOUT_MS: z.coerce.number().int().min(100).default(5000),
  LOGIN_RATE_LIMIT_PER_MIN: z.coerce.number().int().min(1).default(10),
});

export interface SimConfig {
  env: 'development' | 'test' | 'production';
  host: string;
  port: number;
  mcpUrl: string;
  mcpToken: string;
  sessionSecret: string;
  /** personId -> PIN. Demo credentials, documented as such. */
  pins: Record<string, string>;
  webDist: string;
  defaultHousehold: string;
  mcpTimeoutMs: number;
  /** Sign-in attempts per minute per address. Raise only for automated browser tests. */
  loginRateLimitPerMin: number;
}

function parsePins(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of raw.split(',')) {
    const [id, pin] = pair.split(':').map((s) => s.trim());
    if (!id || !pin) throw new Error('Invalid configuration: FAMILY_PINS must look like p_priya:1234,p_arjun:5678');
    out[id] = pin;
  }
  return out;
}

export function loadSimConfig(env: NodeJS.ProcessEnv = process.env): SimConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid configuration: ${parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  }
  const e = parsed.data;
  if (e.NODE_ENV === 'production' && (e.SESSION_SECRET === DEV_SECRET || e.FAMILY_PINS === DEV_PINS || e.MCP_AUTH_TOKEN === 'dev-token')) {
    throw new Error('Invalid configuration: set SESSION_SECRET, FAMILY_PINS and MCP_AUTH_TOKEN to non-default values in production');
  }
  return {
    env: e.NODE_ENV, host: e.HOST, port: e.SIM_PORT, mcpUrl: e.MCP_URL, mcpToken: e.MCP_AUTH_TOKEN, sessionSecret: e.SESSION_SECRET,
    pins: parsePins(e.FAMILY_PINS), webDist: e.WEB_DIST, defaultHousehold: e.DEFAULT_HOUSEHOLD, mcpTimeoutMs: e.MCP_TIMEOUT_MS,
    loginRateLimitPerMin: e.LOGIN_RATE_LIMIT_PER_MIN,
  };
}
