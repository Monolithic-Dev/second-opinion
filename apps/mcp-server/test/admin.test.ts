import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../src/config';
import { startTestServer, TOKEN, HERO } from './helpers';

test('get_household returns the household with ranked approvers and the elder', async () => {
  const t = await startTestServer();
  const { client } = await t.connect();
  try {
    const r = await t.call<{
      household: { id: string; name: string };
      people: Array<{ id: string; role: string; canApprove: boolean; approverRank: number }>;
    }>(client, 'get_household', { householdId: 'hh_demo' });
    assert.equal(r.structuredContent?.household.id, 'hh_demo');
    const byId = Object.fromEntries(r.structuredContent!.people.map((p) => [p.id, p]));
    assert.equal(byId.p_dorothy!.role, 'elder');
    assert.equal(byId.p_dorothy!.canApprove, false);
    assert.equal(byId.p_priya!.approverRank, 1);
    assert.equal(byId.p_arjun!.approverRank, 2);
    const missing = await t.call(client, 'get_household', { householdId: 'hh_nope' });
    assert.equal(missing.structuredContent?.code, 'NOT_FOUND');
  } finally {
    await client.close();
    await t.close();
  }
});

test('POST /admin/reset needs the token and restores the seeded demo state', async () => {
  const t = await startTestServer();
  const { client } = await t.connect();
  try {
    // dirty the database
    const c = await t.call<{ checkId: string }>(client, 'check_message', { householdId: 'hh_demo', text: HERO, context: { actionType: 'purchase' } });
    await t.call(client, 'place_hold', { householdId: 'hh_demo', checkId: c.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
    await t.call(client, 'set_policy', { householdId: 'hh_demo', requestedBy: 'p_priya', patch: { quorum: 2 } });
    assert.ok(t.repos.holds.listByStatus('hh_demo', 'pending').length >= 1);

    const denied = await fetch(`${t.baseUrl}/admin/reset`, { method: 'POST' });
    assert.equal(denied.status, 401);

    const ok = await fetch(`${t.baseUrl}/admin/reset`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(ok.status, 200);
    assert.equal(t.repos.holds.listByStatus('hh_demo', 'pending').length, 0);
    assert.equal(t.repos.policies.get('hh_demo').quorum, 1);
    assert.equal(t.repos.people.list('hh_demo').length, 3);
    assert.ok(t.repos.checks.get('chk_seed1'), 'seeded history is back');
    // the server keeps working after a reset
    const again = await t.call<{ verdict: string }>(client, 'check_message', { householdId: 'hh_demo', text: HERO, context: { actionType: 'purchase' } });
    assert.equal(again.structuredContent?.verdict, 'hold');
  } finally {
    await client.close();
    await t.close();
  }
});

test('the admin endpoint is off in production and can be switched explicitly', async () => {
  assert.equal(loadConfig({ NODE_ENV: 'production', MCP_AUTH_TOKEN: 'x'.repeat(32) }).adminEnabled, false);
  assert.equal(loadConfig({ NODE_ENV: 'development' }).adminEnabled, true);
  assert.equal(loadConfig({ NODE_ENV: 'production', MCP_AUTH_TOKEN: 'x'.repeat(32), ADMIN_ENABLED: '1' }).adminEnabled, true);
  const off = await startTestServer({ ADMIN_ENABLED: '0' });
  try {
    const res = await fetch(`${off.baseUrl}/admin/reset`, { method: 'POST', headers: { authorization: `Bearer ${TOKEN}` } });
    assert.equal(res.status, 404);
  } finally {
    await off.close();
  }
});
