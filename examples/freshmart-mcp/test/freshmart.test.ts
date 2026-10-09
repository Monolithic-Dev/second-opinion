import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGuard } from '@second-opinion/guard-sdk';
import { startTestServer } from '../../../apps/mcp-server/test/helpers';
import { createFreshmart } from '../src/server';

async function shop() {
  const so = await startTestServer();
  const guard = createGuard({ url: `${so.baseUrl}/mcp`, token: 'test-token', householdId: 'hh_demo', timeoutMs: 1000 });
  const placed: Array<{ sku: string; qty: number; totalCents: number }> = [];
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createFreshmart(guard, placed).connect(a);
  const agent = new Client({ name: 'agent', version: '0' });
  await agent.connect(b);
  const stop = async () => { await agent.close(); await guard.close(); await so.close(); };
  return { agent, placed, stop, so };
}
const call = (c: Client, name: string, args: Record<string, unknown>) =>
  c.callTool({ name, arguments: args }) as Promise<{ isError?: boolean; structuredContent?: Record<string, any> }>;

test('T-FRESH-1 the merchant tool list is unchanged by the guard, and search is untouched', async () => {
  const s = await shop();
  try {
    assert.deepEqual((await s.agent.listTools()).tools.map((t) => t.name).sort(), ['place_order', 'search_products']);
    assert.equal((await call(s.agent, 'search_products', { query: 'milk' })).structuredContent?.products.length, 1);
  } finally { await s.stop(); }
});

test('T-FRESH-2 a $900 gift-card order is held and nothing is ordered', async () => {
  const s = await shop();
  try {
    const r = await call(s.agent, 'place_order', { sku: 'gc-200', qty: 5, note: 'The bank says I have to buy five $200 gift cards today or my account is frozen.' });
    assert.equal(r.structuredContent?.status, 'held');
    assert.equal(s.placed.length, 0);
  } finally { await s.stop(); }
});

test('T-FRESH-3 the same merchant refuses to run an order whose guard is down (fails closed)', async () => {
  const guard = createGuard({ url: 'http://127.0.0.1:9/mcp', token: 'x', householdId: 'hh_demo', timeoutMs: 300 });
  const placed: Array<{ sku: string; qty: number; totalCents: number }> = [];
  const [a, b] = InMemoryTransport.createLinkedPair();
  await createFreshmart(guard, placed).connect(a);
  const agent = new Client({ name: 'agent', version: '0' });
  await agent.connect(b);
  const r = await call(agent, 'place_order', { sku: 'milk-1l', qty: 1 });
  assert.equal(r.structuredContent?.status, 'unverified');
  assert.equal(placed.length, 0);
  await agent.close();
  await guard.close();
});
