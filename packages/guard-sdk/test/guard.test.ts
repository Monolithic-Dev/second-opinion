import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGuard, GuardError, type Caller, type ToolResultLike } from '../src';
import { startTestServer } from '../../../apps/mcp-server/test/helpers';

/** Contract tests run the SDK against a real in-process Second Opinion MCP server. */
async function setup(guardOpts: Parameters<typeof createGuard>[0] extends infer O ? Partial<O> : never = {}) {
  const t = await startTestServer();
  const guard = createGuard({ url: `${t.baseUrl}/mcp`, token: 'test-token', householdId: 'hh_demo', ...guardOpts });
  const { client } = await t.connect();
  let runs = 0;
  const order = guard.protect(
    async (a: { total: number; payee: string; note: string }) => {
      runs++;
      return { content: [{ type: 'text' as const, text: `ordered ${a.total}` }], structuredContent: { status: 'ordered', total: a.total } };
    },
    { describe: (a) => ({ actionType: 'purchase', amountCents: a.total, payee: a.payee, text: a.note, description: `order for ${a.payee}` }) },
  );
  const approve = async (holdId: string) => {
    for (const who of ['p_priya', 'p_arjun']) await t.call(client, 'resolve_approval', { holdId, decision: 'approve', resolvedBy: who });
  };
  const deny = (holdId: string) => t.call(client, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_priya' });
  const stop = async () => { await guard.close(); await client.close(); await t.close(); };
  return { t, guard, order, runs: () => runs, approve, deny, stop };
}

const scam = { total: 100000, payee: 'gift cards', note: 'The bank says I have to buy five $200 gift cards today or my account is frozen.' };
const groceries = { total: 2400, payee: 'Greenleaf Pharmacy', note: 'refill my usual prescription' };

test('T-GUARD-1 an ordinary order from a trusted payee runs the handler exactly once', async () => {
  const s = await setup();
  try {
    const r = (await s.order(groceries)) as ToolResultLike;
    assert.equal(r.structuredContent.status, 'ordered');
    assert.equal(s.runs(), 1);
  } finally { await s.stop(); }
});

test('T-GUARD-2 a scam-shaped order is held: the handler never runs and a hold exists for the family', async () => {
  const s = await setup();
  try {
    const r = (await s.order(scam)) as ToolResultLike;
    assert.equal(r.structuredContent.status, 'held');
    assert.equal(r.isError, undefined);
    assert.equal(s.runs(), 0);
    const holdId = String(r.structuredContent.holdId);
    const hold = await s.guard.caller.call('get_hold', { holdId });
    assert.equal(hold.hold.status, 'pending');
  } finally { await s.stop(); }
});

test('T-GUARD-3 release runs a held action only after approval, and only once', async () => {
  const s = await setup();
  try {
    const holdId = String(((await s.order(scam)) as ToolResultLike).structuredContent.holdId);
    assert.deepEqual(await s.guard.release(holdId), { status: 'pending' });
    assert.equal(s.runs(), 0);
    await s.approve(holdId);
    const first = await s.guard.release(holdId);
    assert.equal(first.status, 'executed');
    const [again, concurrent] = await Promise.all([s.guard.release(holdId), s.guard.release(holdId)]);
    assert.equal(again.status, 'already_executed');
    assert.equal(concurrent.status, 'already_executed');
    assert.equal(s.runs(), 1);
  } finally { await s.stop(); }
});

test('T-GUARD-4 a denied hold is never executed', async () => {
  const s = await setup();
  try {
    const holdId = String(((await s.order(scam)) as ToolResultLike).structuredContent.holdId);
    await s.deny(holdId);
    assert.deepEqual(await s.guard.release(holdId), { status: 'denied' });
    assert.equal(s.runs(), 0);
    assert.deepEqual(await s.guard.release('hold_nope'), { status: 'unknown' });
  } finally { await s.stop(); }
});

test('T-GUARD-5 an unreachable guard fails closed by default (handler does not run)', async () => {
  const guard = createGuard({ url: 'http://127.0.0.1:9/mcp', token: 'x', householdId: 'hh_demo', timeoutMs: 500 });
  let runs = 0;
  const run = guard.protect(async () => { runs++; return { ok: true }; }, { describe: () => ({ actionType: 'payment', amountCents: 100, text: 'pay' }) });
  const r = (await run({})) as ToolResultLike;
  assert.equal(r.structuredContent.status, 'unverified');
  assert.equal(r.isError, true);
  assert.equal(runs, 0);
  await guard.close();
});

test('T-GUARD-6 failMode open runs the handler when the guard is unreachable (documented as unsafe)', async () => {
  const guard = createGuard({ url: 'http://127.0.0.1:9/mcp', token: 'x', householdId: 'hh_demo', timeoutMs: 500, failMode: 'open' });
  let runs = 0;
  const run = guard.protect(async () => { runs++; return { ok: true }; }, { describe: () => ({ actionType: 'payment', amountCents: 100, text: 'pay' }) });
  assert.deepEqual(await run({}), { ok: true });
  assert.equal(runs, 1);
  await guard.close();
});

test('T-GUARD-7 a describe() that throws fails closed', async () => {
  const caller: Caller = { call: async () => { throw new Error('should not be called'); } };
  const guard = createGuard({ caller, householdId: 'hh_demo' });
  let runs = 0;
  const run = guard.protect(async () => { runs++; }, { describe: () => { throw new Error('bad args'); } });
  const r = (await run({})) as ToolResultLike;
  assert.equal(r.structuredContent.status, 'unverified');
  assert.equal(runs, 0);
});

test('T-GUARD-8 a policy block never runs the handler and creates no hold', async () => {
  const calls: string[] = [];
  const caller: Caller = {
    async call(name) {
      calls.push(name);
      return { checkId: 'chk_x', verdict: 'allow', decision: { outcome: 'block', reasonText: ['Over the daily limit'] } };
    },
  };
  const guard = createGuard({ caller, householdId: 'hh_demo' });
  let runs = 0;
  const run = guard.protect(async () => { runs++; }, { describe: () => ({ actionType: 'payment', amountCents: 100, text: 'pay' }) });
  const r = (await run({})) as ToolResultLike;
  assert.equal(r.structuredContent.status, 'blocked');
  assert.match(String(r.structuredContent.message), /daily limit/);
  assert.deepEqual(calls, ['check_message']);
  assert.equal(runs, 0);
});

test('T-GUARD-9 an expired pending action is not released', async () => {
  let t = 0;
  const caller: Caller = {
    async call(name) {
      if (name === 'check_message') return { checkId: 'chk_x', verdict: 'hold', decision: { outcome: 'require_approval', reasonText: [] }, card: { flags: ['Gift cards'] } };
      if (name === 'place_hold') return { holdId: 'hold_x' };
      if (name === 'request_family_approval') return {};
      return { hold: { status: 'released' } };
    },
  };
  const guard = createGuard({ caller, householdId: 'hh_demo', pendingTtlMs: 1000, now: () => t });
  let runs = 0;
  const run = guard.protect(async () => { runs++; }, { describe: () => ({ actionType: 'purchase', text: 'cards' }) });
  await run({});
  t = 5000;
  assert.deepEqual(await guard.release('hold_x'), { status: 'expired' });
  assert.equal(runs, 0);
  assert.equal(guard.pendingCount, 0);
});

test('GuardError carries a code', () => {
  assert.equal(new GuardError('UNAVAILABLE', 'down').code, 'UNAVAILABLE');
});
