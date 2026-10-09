import { pathToFileURL } from 'node:url';
import { systemClock } from '@second-opinion/shared';
import { migrate, openDb, createRepos, seedDemo } from '@second-opinion/store';
import { createApp } from './app';
import { loadConfig, type Config } from './config';
import { createLogger, type Logger } from './logging';
import { consoleAdapter, dbAdapter, emailHtmlAdapter, type Adapter } from '@second-opinion/notify';
import { startJobs } from './jobs';
import type { Deps } from './deps';

export { createApp } from './app';
export { buildServer } from './server';
export { loadConfig } from './config';
export type { Deps } from './deps';
export { runJobsOnce, runEscalation, runExpiry, runOutbox, startJobs } from './jobs';

export function createAdapters(config: Config, log: Logger): Adapter[] {
  return [consoleAdapter((line) => log.debug('notify', { line })), dbAdapter(), emailHtmlAdapter(config.outboxDir)];
}

export function createDeps(config: Config, log: Logger, clock = systemClock): Deps {
  const db = openDb(config.dbPath);
  migrate(db);
  const repos = config.seedDemo ? seedDemo(db, clock) : createRepos(db, clock);
  return { db, repos, clock, config, log };
}

async function main(): Promise<void> {
  const config = loadConfig();
  const log = createLogger(config.env === 'development' ? 'debug' : 'info');
  const deps = createDeps(config, log);
  const app = createApp(deps);
  const stopJobs = startJobs(deps, createAdapters(config, log));
  const server = app.listen(config.port, config.host, () => {
    log.info('listening', { url: `http://${config.host}:${config.port}/mcp`, env: config.env });
  });
  const shutdown = (signal: string) => {
    log.info('shutting_down', { signal });
    stopJobs();
    server.close(() => {
      deps.db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
