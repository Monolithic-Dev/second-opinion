import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync } from 'node:fs';
import { seed } from './seed';

/**
 * One command for judges: `npm run demo`. Seeds the demo household, starts the MCP server (3001) and the simulator (3000),
 * waits until both answer, and prints the URLs. Ctrl+C stops everything. No AWS account or network access is needed.
 */
const MCP_PORT = process.env.MCP_PORT ?? '3001';
const SIM_PORT = process.env.SIM_PORT ?? '3000';
const env = { ...process.env, MCP_PORT, SIM_PORT, MCP_URL: `http://127.0.0.1:${MCP_PORT}/mcp` };

const children: ChildProcess[] = [];
let stopping = false;

function stop(code = 0): void {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  setTimeout(() => process.exit(code), 300).unref();
}

function start(name: string, entry: string): void {
  const child = spawn(process.execPath, ['--import', 'tsx', entry], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  children.push(child);
  child.on('exit', (code) => {
    if (!stopping) {
      process.stderr.write(`${name} stopped unexpectedly (exit ${code}).\n`);
      stop(1);
    }
  });
}

async function waitFor(url: string, label: string, ms = 30_000): Promise<void> {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* still starting */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`${label} did not start within ${ms / 1000}s`);
}

process.on('SIGINT', () => stop(0));
process.on('SIGTERM', () => stop(0));

seed(process.env.DB_PATH ?? './data/second-opinion.db');
start('mcp-server', 'apps/mcp-server/src/index.ts');
await waitFor(`http://127.0.0.1:${MCP_PORT}/healthz`, 'MCP server');
start('simulator', 'apps/simulator/src/index.ts');
await waitFor(`http://127.0.0.1:${SIM_PORT}/healthz`, 'simulator');

const web = existsSync('apps/web/dist') ? `http://localhost:${SIM_PORT}/demo` : '(build the web app: npm run build -w @second-opinion/web)';
process.stdout.write(
  `\nSecond Opinion is running.\n  Demo:        ${web}\n  MCP server:  http://127.0.0.1:${MCP_PORT}/mcp  (Streamable HTTP, bearer token from .env)\n  Simulator:   http://127.0.0.1:${SIM_PORT}/healthz\n  Family PINs: Priya 1234, Arjun 5678 (demo credentials)\n  Press Ctrl+C to stop.\n\n`,
);
