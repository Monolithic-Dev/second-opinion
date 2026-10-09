import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HERO, startTestServer, TOKEN } from './helpers';

test('T-OBS-1 /metrics needs the bearer token and reports tool calls and business gauges', async () => {
  const t = await startTestServer();
  try {
    assert.equal((await fetch(`${t.baseUrl}/metrics`)).status, 401);
    const { client } = await t.connect();
    await t.call(client, 'check_message', { householdId: 'hh_demo', text: HERO, context: { actionType: 'purchase', amountCents: 100000, payee: 'gift cards' } });
    await t.call(client, 'get_hold', { holdId: 'hold_missing' });
    const res = await fetch(`${t.baseUrl}/metrics`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type') ?? '', /text\/plain/);
    const body = await res.text();
    assert.match(body, /so_tool_calls_total\{tool="check_message",outcome="ok"\} 1/);
    assert.match(body, /so_tool_calls_total\{tool="get_hold",outcome="error"\} 1/);
    assert.match(body, /so_tool_duration_ms_count\{tool="check_message"\} 1/);
    assert.match(body, /so_tool_duration_ms_bucket\{tool="check_message",le="\+Inf"\} 1/);
    assert.match(body, /so_holds\{status="denied"\} 1/); // the seeded denied hold
    assert.doesNotMatch(body, /gift cards|bank says/i, 'metrics never contain message text');
    await client.close();
  } finally {
    await t.close();
  }
});
