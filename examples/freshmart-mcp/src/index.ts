// Run: SO_URL=http://localhost:8787/mcp SO_TOKEN=... npx tsx examples/freshmart-mcp/src/index.ts   (stdio MCP server)
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGuard } from '@second-opinion/guard-sdk';
import { createFreshmart } from './server';

const guard = createGuard({
  url: process.env.SO_URL ?? 'http://localhost:8787/mcp',
  token: process.env.SO_TOKEN ?? '',
  householdId: process.env.SO_HOUSEHOLD ?? 'hh_demo',
});
await createFreshmart(guard).connect(new StdioServerTransport());
