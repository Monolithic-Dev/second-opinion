import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Guard } from '@second-opinion/guard-sdk';
import { z } from 'zod';

export const CATALOG = [
  { sku: 'milk-1l', name: 'Whole milk 1L', priceCents: 189 },
  { sku: 'bread', name: 'Sourdough loaf', priceCents: 450 },
  { sku: 'gc-200', name: 'Prepaid gift card $200', priceCents: 20000 },
];

/**
 * FreshMart: an ordinary merchant MCP server. `place_order` is the only tool that moves money, and it is wrapped in `guard.protect`,
 * which is the whole integration: the handler below is the merchant's own code and does not know about Second Opinion.
 */
export function createFreshmart(guard: Guard, placed: Array<{ sku: string; qty: number; totalCents: number }> = []): McpServer {
  const server = new McpServer({ name: 'freshmart', version: '1.0.0' });

  server.registerTool(
    'search_products',
    {
      title: 'Search FreshMart products',
      description: 'Find products by name. Read-only.',
      inputSchema: { query: z.string().max(100) },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query }) => {
      const hits = CATALOG.filter((p) => p.name.toLowerCase().includes(query.toLowerCase()));
      return { content: [{ type: 'text', text: JSON.stringify(hits) }], structuredContent: { products: hits } };
    },
  );

  server.registerTool(
    'place_order',
    {
      title: 'Place a FreshMart order',
      description: 'Buys items. Risky orders are paused and a family member is asked to approve.',
      inputSchema: { sku: z.string(), qty: z.number().int().min(1).max(50), note: z.string().max(500).optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
    },
    guard.protect(
      async ({ sku, qty }: { sku: string; qty: number; note?: string }) => {
        const item = CATALOG.find((p) => p.sku === sku);
        if (!item) return { isError: true, content: [{ type: 'text' as const, text: `unknown sku ${sku}` }] };
        const totalCents = item.priceCents * qty;
        placed.push({ sku, qty, totalCents });
        return { content: [{ type: 'text' as const, text: `Ordered ${qty} x ${item.name}` }], structuredContent: { status: 'ordered', totalCents } };
      },
      {
        describe: ({ sku, qty, note }) => {
          const item = CATALOG.find((p) => p.sku === sku);
          return {
            actionType: 'purchase',
            amountCents: item ? item.priceCents * qty : undefined,
            payee: 'FreshMart',
            text: note ?? `Order ${qty} x ${item?.name ?? sku}`,
            description: `${qty} x ${item?.name ?? sku} from FreshMart`,
          };
        },
      },
    ),
  );

  return server;
}
