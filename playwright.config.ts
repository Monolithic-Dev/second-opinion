import { defineConfig, devices } from '@playwright/test';

const SIM_PORT = 3100;
const MCP_PORT = 3101;

// Browser tests run against a real stack on spare ports: `npm run demo` (MCP server + simulator + the built web app).
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 7_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: `http://127.0.0.1:${SIM_PORT}`, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'node --import tsx scripts/demo.ts',
    url: `http://127.0.0.1:${SIM_PORT}/healthz`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: { SIM_PORT: String(SIM_PORT), MCP_PORT: String(MCP_PORT), DB_PATH: './data/e2e.db', OUTBOX_DIR: './data/e2e-outbox', HOST: '127.0.0.1', LOGIN_RATE_LIMIT_PER_MIN: '1000', // Midday (Chicago) of today's UTC date: stable time of day, and holds do not look expired next to the real clock.
    FIXED_NOW: `${new Date().toISOString().slice(0, 10)}T17:00:00.000Z` },
  },
});
