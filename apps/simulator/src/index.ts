import { pathToFileURL } from 'node:url';
import { createSimApp, type SimDeps } from './app';
import { loadSimConfig, type SimConfig } from './config';
import { McpGateway } from './gateway';

export { createSimApp } from './app';
export { loadSimConfig } from './config';
export { runTurn } from './agent/router';
export { classifyIntent } from './agent/intent';
export { McpGateway, GatewayDown, ToolCallError, type Gateway } from './gateway';

export function createRuntime(config: SimConfig): { deps: SimDeps; gateway: McpGateway } {
  const gateway = new McpGateway({ url: config.mcpUrl, token: config.mcpToken, timeoutMs: config.mcpTimeoutMs });
  return { gateway, deps: { config, gateway, ping: () => gateway.ping(), resetServer: () => gateway.resetServer() } };
}

async function main(): Promise<void> {
  const config = loadSimConfig();
  const { deps, gateway } = createRuntime(config);
  const { app, hub } = createSimApp(deps);
  const server = app.listen(config.port, config.host, () => {
    process.stderr.write(`${JSON.stringify({ t: new Date().toISOString(), level: 'info', msg: 'simulator_listening', url: `http://${config.host}:${config.port}`, mcp: config.mcpUrl })}\n`);
  });
  const shutdown = () => {
    hub.closeAll();
    void gateway.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((e) => {
    process.stderr.write(`fatal: ${e instanceof Error ? e.message : String(e)}\n`);
    process.exit(1);
  });
}
