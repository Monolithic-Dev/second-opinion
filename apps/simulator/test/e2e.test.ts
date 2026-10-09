import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createSimApp } from '../src/app';
import { loadSimConfig } from '../src/config';
import { McpGateway } from '../src/gateway';
import { startStack, type Stack } from './stack';

const HH = 'hh_demo';
const HERO = 'The bank says I have to buy five $200 gift cards today or my account is frozen.';
let s: Stack;
before(async () => { s = await startStack(); });
after(async () => { await s.close(); });

const utter = (text: string, speaker: 'elder' | 'family' = 'elder', cookie?: string) =>
  s.api('/api/utter', { method: 'POST', body: { householdId: HH, speaker, text }, cookie });

test('T-SIM-0 healthz reports the MCP server', async () => {
  const r = await s.api('/healthz');
  assert.equal(r.json.ok, true);
  assert.equal(r.json.mcp, true);
});

test('T-SIM-2 the hero request is held, the family is asked, nothing is executed', async () => {
  await s.reset();
  const r = await utter(HERO);
  assert.equal(r.status, 200);
  const t = r.json;
  assert.equal(t.intent, 'PURCHASE_OR_PAY');
  assert.equal(t.verdict, 'hold');
  assert.equal(t.executed, false);
  assert.match(t.holdId, /^hold_/);
  assert.equal(t.card.level, 'hold');
  assert.ok(t.card.flags.includes('Asks for gift cards'));
  assert.match(t.spoken, /^I've paused this. /);
  assert.match(t.spoken, /I've asked Priya to check.$/, 'the most important sentence is never cut off');
  assert.ok(!/ {2}/.test(t.spoken), 'no double spaces');
  assert.ok(!/known scam pattern/.test(t.spoken), 'concrete red flags are spoken, not the generic pattern');
  assert.match(t.reply, /Priya/);
  assert.deepEqual(t.trace.map((x: { tool: string }) => x.tool), ['check_message', 'place_hold', 'request_family_approval', 'get_household']);
  assert.ok(t.trace.every((x: { ok: boolean }) => x.ok));
  assert.match(t.traceId, /^[0-9a-f-]{36}$/);
  assert.ok(t.spoken.split(/[.!?]/).filter(Boolean).length <= 4, "spoken stays short");
});

test('state shows the pending hold with its quorum and the household', async () => {
  const r = await s.api(`/api/state?householdId=${HH}`);
  assert.equal(r.status, 200);
  assert.equal(r.json.household.id, HH);
  assert.equal(r.json.people.length, 3);
  const pending = r.json.holds.filter((h: { status: string }) => h.status === 'pending');
  assert.equal(pending.length, 1);
  assert.equal(pending[0].quorumRequired, 1);
  assert.ok(r.json.payees.some((p: { name: string }) => p.name === 'greenleaf pharmacy'));
  assert.ok(r.json.notifications.length >= 3);
});

test('T-AUTH-1 the family routes need a session, a right PIN and the CSRF header', async () => {
  const holdId = (await s.api(`/api/state?householdId=${HH}`)).json.holds.find((h: { status: string }) => h.status === 'pending').holdId;
  assert.equal((await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'deny' } })).status, 401);
  assert.equal((await s.login('p_priya', '9999')).status, 401);
  assert.equal((await s.login('p_nobody', '1234')).status, 401);
  const ok = await s.login('p_priya', '1234', true);
  assert.equal(ok.status, 200);
  assert.match(ok.headers.get('set-cookie') ?? '', /HttpOnly; SameSite=Lax/);
  const noCsrf = await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'deny' }, cookie: ok.cookie, csrf: false });
  assert.equal(noCsrf.status, 403);
  assert.equal(noCsrf.json.error.code, 'CSRF');
  assert.equal((await s.api('/api/auth/me', { cookie: ok.cookie })).json.personId, 'p_priya');
  assert.equal((await s.api('/api/auth/me')).json.personId, null);
});

test('T-SIM-3 the family denies; the elder is told on the next ask; a repeat is recognised', async () => {
  const { cookie } = await s.login();
  const state = (await s.api(`/api/state?householdId=${HH}`)).json;
  const holdId = state.holds.find((h: { status: string }) => h.status === 'pending').holdId;
  const vote = await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'deny', note: 'not my bank' }, cookie });
  assert.equal(vote.status, 200);
  assert.equal(vote.json.status, 'denied');
  const again = await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'deny' }, cookie });
  assert.equal(again.status, 409, 'finished holds accept no more votes');

  const repeat = await utter(HERO);
  assert.equal(repeat.json.verdict, 'hold');
  assert.match(repeat.json.spoken, /It's the same kind of request as [A-Z][a-z]+day\./);
  assert.match(repeat.json.spoken, /I've asked Priya to check.$/);
  assert.ok(repeat.json.trace[0].summary.startsWith('hold'));
});

test('T-SIM-5 a routine payment to a trusted payee is carried out without a hold', async () => {
  await s.reset();
  const r = await utter('Pay Greenleaf Pharmacy $24');
  assert.equal(r.json.executed, true);
  assert.equal(r.json.verdict, 'allow');
  assert.equal(r.json.holdId, undefined);
  assert.match(r.json.spoken, /done/);
  assert.deepEqual(r.json.trace.map((x: { tool: string }) => x.tool), ['check_message']);
});

test('household rules can pause an otherwise fine payment, and the reason is spoken', async () => {
  const r = await utter('Pay Greenleaf Pharmacy $600');
  assert.notEqual(r.json.verdict, 'hold', 'risk alone would not hold a payment to a trusted payee');
  assert.equal(r.json.decision.outcome, 'require_approval');
  assert.ok(r.json.decision.reasons.includes('OVER_SINGLE_LIMIT'));
  assert.equal(r.json.executed, false);
  assert.match(r.json.spoken, /paused/);
  assert.match(r.json.holdId, /^hold_/);
});

test('a scam question gets a plain-language answer and no hold', async () => {
  const r = await utter('I got a text saying I must buy gift cards today or my account is frozen, is this a scam?');
  assert.equal(r.json.intent, 'SCAM_QUESTION');
  assert.notEqual(r.json.verdict, 'allow');
  assert.equal(r.json.holdId, undefined);
  assert.match(r.json.spoken, /gift cards/i);
  const fine = await utter('Is this reminder from the dentist real? Your appointment is Thursday at 10.');
  assert.equal(fine.json.verdict, 'allow');
  assert.match(fine.json.spoken, /doesn't look like a scam/);
});

test('T-SIM-6 the elder cannot approve their own request; family voice needs a session', async () => {
  await s.reset();
  await utter(HERO);
  const refusal = await utter('approve it');
  assert.equal(refusal.json.executed, false);
  assert.match(refusal.json.spoken, /Only a family member/);
  const pending = (await s.api(`/api/state?householdId=${HH}`)).json.holds.filter((h: { status: string }) => h.status === 'pending');
  assert.equal(pending.length, 1, 'still blocked');

  assert.equal((await utter('deny it', 'family')).status, 401);
  const { cookie } = await s.login('p_priya');
  const spoken = await utter('deny it', 'family', cookie);
  assert.equal(spoken.json.executed, false);
  assert.match(spoken.json.spoken, /cancelled/);
  assert.equal((await s.api(`/api/state?householdId=${HH}`)).json.holds.filter((h: { status: string }) => h.status === 'pending').length, 0);
});

test('T-QUORUM-SIM two approvers: one approval keeps it pending, the second releases it', async () => {
  await s.reset();
  const priya = await s.login('p_priya');
  const arjun = await s.login('p_arjun', '5678');
  const set = await s.api('/api/family/policy', { method: 'PUT', body: { householdId: HH, patch: { quorum: 2 } }, cookie: priya.cookie });
  assert.equal(set.status, 200);
  assert.deepEqual(set.json.changed, ['quorum']);
  const held = await utter(HERO);
  const holdId = held.json.holdId;
  const one = await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'approve' }, cookie: priya.cookie });
  assert.equal(one.json.status, 'pending');
  assert.deepEqual(one.json.votes, { approve: 1, deny: 0, required: 2 });
  const two = await s.api(`/api/family/holds/${holdId}/vote`, { method: 'POST', body: { decision: 'approve' }, cookie: arjun.cookie });
  assert.equal(two.json.status, 'released');
  const bad = await s.api('/api/family/policy', { method: 'PUT', body: { householdId: HH, patch: { maxSingleCents: 3 } }, cookie: priya.cookie });
  assert.equal(bad.status, 400);
  assert.match(bad.json.error.message, /maxSingleCents/);
});

test('a request over the daily cap is blocked and cannot be held', async () => {
  await s.reset();
  const { cookie } = await s.login();
  await s.api('/api/family/policy', { method: 'PUT', body: { householdId: HH, patch: { dailyCapCents: 60_000 } }, cookie });
  assert.equal((await utter('Pay Greenleaf Pharmacy $450')).json.executed, true);
  const blocked = await utter('Pay Greenleaf Pharmacy $450 again');
  assert.equal(blocked.json.blocked, true);
  assert.equal(blocked.json.executed, false);
  assert.equal(blocked.json.holdId, undefined);
  assert.match(blocked.json.spoken, /family member needs to handle it/);
});

test('trusted payees can be edited by a signed-in approver and spoken about', async () => {
  await s.reset();
  const { cookie } = await s.login();
  assert.equal((await s.api('/api/family/payees', { method: 'POST', body: { householdId: HH, name: 'Corner Bakery' } })).status, 401);
  const added = await s.api('/api/family/payees', { method: 'POST', body: { householdId: HH, name: 'Corner Bakery', kind: 'merchant' }, cookie });
  assert.ok(added.json.payees.some((p: { name: string }) => p.name === 'corner bakery'));
  const list = await utter('Who do I trust?');
  assert.match(list.json.spoken, /corner bakery/);
  const removed = await s.api('/api/family/payees', { method: 'DELETE', body: { householdId: HH, name: 'corner bakery' }, cookie });
  assert.ok(!removed.json.payees.some((p: { name: string }) => p.name === 'corner bakery'));
});

test('T-SIM-8 events stream: a held request is announced live to every open page', async () => {
  await s.reset();
  const ctl = new AbortController();
  const res = await fetch(`${s.base}/api/events`, { signal: ctl.signal });
  assert.match(res.headers.get('content-type') ?? '', /^text.event-stream/);
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let seen = '';
  const reading = (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      seen += decoder.decode(value);
      if (seen.includes('event: hold.created')) return;
    }
  })();
  await utter(HERO);
  await Promise.race([reading, new Promise((_, rej) => setTimeout(() => rej(new Error('no hold.created event')), 5000))]);
  ctl.abort();
  assert.match(seen, /event: check\.done/);
  assert.match(seen, /event: hold\.created\ndata: \{"householdId":"hh_demo","holdId":"hold_/);
});

test('validation: bad ids and empty text are 400, unknown households are 404', async () => {
  assert.equal((await s.api('/api/utter', { method: 'POST', body: { householdId: 'not valid!', speaker: 'elder', text: 'hi' } })).status, 400);
  assert.equal((await s.api('/api/utter', { method: 'POST', body: { householdId: HH, speaker: 'elder', text: '   ' } })).status, 400);
  assert.equal((await s.api('/api/utter', { method: 'POST', body: { householdId: HH, speaker: 'robot', text: 'hi' } })).status, 400);
  assert.equal((await s.api('/api/utter', { method: 'POST', body: { householdId: HH, speaker: 'elder', text: 'hi' }, csrf: false })).status, 403);
  const missing = await s.api('/api/utter', { method: 'POST', body: { householdId: 'hh_nope', speaker: 'elder', text: 'Pay Greenleaf Pharmacy $24' } });
  assert.equal(missing.json.executed, false, 'an unknown household fails closed');
});

test('security headers are set on every response', async () => {
  const res = await fetch(`${s.base}/healthz`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-frame-options'), 'DENY');
  assert.match(res.headers.get('content-security-policy') ?? '', /frame-ancestors 'none'/);
});

test('T-SIM-1 FAIL-SAFE: if the MCP server is unreachable nothing is executed and the reply says so', async () => {
  const dead = loadSimConfig({ NODE_ENV: 'test', MCP_URL: 'http://127.0.0.1:1/mcp', WEB_DIST: './nope', MCP_TIMEOUT_MS: '500' });
  const gw = new McpGateway({ url: dead.mcpUrl, token: dead.mcpToken, timeoutMs: dead.mcpTimeoutMs });
  const { app } = createSimApp({ config: dead, gateway: gw, ping: () => gw.ping() });
  const server = await new Promise<import('node:http').Server>((resolve) => { const sv = app.listen(0, '127.0.0.1', () => resolve(sv)); });
  const base = `http://127.0.0.1:${(server.address() as import('node:net').AddressInfo).port}`;
  try {
    const res = await fetch(`${base}/api/utter`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-requested-with': 'so' },
      body: JSON.stringify({ householdId: HH, speaker: 'elder', text: HERO }),
    });
    const t = (await res.json()) as { executed: boolean; reply: string; holdId?: string };
    assert.equal(t.executed, false);
    assert.match(t.reply, /couldn't verify this, so I haven't done it/);
    assert.equal(t.holdId, undefined);
    const health = (await (await fetch(`${base}/healthz`)).json()) as { mcp: boolean };
    assert.equal(health.mcp, false);
    const state = await fetch(`${base}/api/state?householdId=${HH}`);
    assert.equal(state.status, 503);
  } finally {
    await gw.close();
    await new Promise<void>((r) => server.close(() => r()));
  }
});

test('the gateway reconnects after the MCP server restarts its session (stateless server)', async () => {
  const a = await utter('Pay Greenleaf Pharmacy $24');
  await s.gateway.close();
  const b = await utter('Pay Greenleaf Pharmacy $24');
  assert.equal(a.json.executed, true);
  assert.equal(b.json.executed, true);
});

test('hold detail (votes and timeline) is a family-only route', async () => {
  await s.reset();
  const held = await utter(HERO);
  const holdId = held.json.holdId as string;
  assert.equal((await s.api(`/api/family/holds/${holdId}`)).status, 401);
  const { cookie } = await s.login();
  const detail = await s.api(`/api/family/holds/${holdId}`, { cookie });
  assert.equal(detail.status, 200);
  assert.equal(detail.json.hold.holdId, holdId);
  assert.ok(detail.json.risk.flags.includes('Asks for gift cards'));
  assert.deepEqual(detail.json.timeline.map((e: { label: string }) => e.label).slice(0, 2), ['Request paused', 'Family asked to review']);
  assert.equal((await s.api('/api/family/holds/hold_nope', { cookie })).status, 404);
});
