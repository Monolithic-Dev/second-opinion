import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, HERO } from './helpers';

let t: Awaited<ReturnType<typeof startTestServer>>;
before(async () => { t = await startTestServer({ HOLD_TTL_MS: '60000' }); });
after(async () => { await t.close(); });

const HH = 'hh_demo';
type Check = { checkId: string; verdict: string; score: number; hardRule?: string; similarTo: { checkId: string } | null; signals: Array<{ id: string }>; card: { flags: string[] } };

async function heroCheck(client: Awaited<ReturnType<typeof t.connect>>['client']) {
  return t.call<Check>(client, 'check_message', {
    householdId: HH, text: HERO, channel: 'voice', context: { actionType: 'purchase', amountCents: 100000, payee: 'gift cards' },
  });
}

test('tools/list exposes the nine tools with titles, output schemas and accurate annotations', async () => {
  const { client } = await t.connect();
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((x) => x.name).sort(), ['check_message', 'get_policy', 'household_insights', 'list_holds', 'place_hold', 'request_family_approval', 'resolve_approval', 'set_policy', 'trusted_payees']);
  for (const tool of tools) {
    assert.ok(tool.title, `${tool.name} title`);
    assert.ok(tool.outputSchema, `${tool.name} outputSchema`);
    assert.equal(tool.inputSchema.type, 'object');
    assert.ok(tool.annotations, `${tool.name} annotations`);
    assert.match(tool.name, /^[A-Za-z0-9_.-]{1,128}$/);
  }
  assert.equal(tools.find((x) => x.name === 'list_holds')?.annotations?.readOnlyHint, true);
  assert.equal(tools.find((x) => x.name === 'resolve_approval')?.annotations?.destructiveHint, true);
  await client.close();
});

test('T-TOOL-1 full chain: check -> hold -> request -> deny -> list', async () => {
  const { client } = await t.connect();
  const check = await heroCheck(client);
  assert.equal(check.isError, undefined);
  assert.equal(check.structuredContent?.verdict, 'hold');
  assert.equal(check.structuredContent?.score, 100);
  assert.equal(check.structuredContent?.hardRule, 'GIFT_CARD_PLUS_ANY');
  assert.ok(check.structuredContent?.similarTo, 'seeded Tuesday check is recognised');
  assert.equal(JSON.parse(check.content[0]!.text).verdict, 'hold', 'text block mirrors structuredContent');

  const hold = await t.call<{ holdId: string; status: string }>(client, 'place_hold', {
    householdId: HH, checkId: check.structuredContent!.checkId, actionType: 'purchase', amountCents: 100000, payee: 'gift cards', description: '5 x $200 gift cards',
  });
  assert.equal(hold.structuredContent?.status, 'pending');
  const holdId = hold.structuredContent!.holdId;

  const req = await t.call<{ notified: string[] }>(client, 'request_family_approval', { holdId });
  assert.deepEqual(req.structuredContent?.notified, ['p_priya']);

  const pending = await t.call<{ holds: Array<{ holdId: string; flags: string[] }> }>(client, 'list_holds', { householdId: HH, status: 'pending' });
  const mine = pending.structuredContent?.holds.find((h) => h.holdId === holdId);
  assert.ok(mine && mine.flags.includes('Asks for gift cards'));

  const done = await t.call<{ status: string }>(client, 'resolve_approval', { holdId, decision: 'deny', resolvedBy: 'p_priya', note: 'not my bank' });
  assert.equal(done.structuredContent?.status, 'denied');
  const denied = await t.call<{ holds: unknown[] }>(client, 'list_holds', { householdId: HH, status: 'denied' });
  assert.ok((denied.structuredContent?.holds.length ?? 0) >= 2, 'seeded denied hold + this one');
  await client.close();
});

test('T-TOOL-2 an allow verdict cannot be held (INVALID_INPUT)', async () => {
  const { client } = await t.connect();
  const ok = await t.call<Check>(client, 'check_message', { householdId: HH, text: 'What time is my appointment?' });
  assert.equal(ok.structuredContent?.verdict, 'allow');
  const res = await t.call(client, 'place_hold', { householdId: HH, checkId: ok.structuredContent!.checkId, actionType: 'none', description: 'x' });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent?.code, 'INVALID_INPUT');
  await client.close();
});

test('T-TOOL-4 trusted payee lowers the score but the gift-card rule still holds', async () => {
  const { client } = await t.connect();
  const r = await t.call<Check>(client, 'check_message', {
    householdId: HH, text: 'Buy gift cards at Greenleaf Pharmacy today', context: { actionType: 'purchase', payee: 'Greenleaf Pharmacy' },
  });
  assert.equal(r.structuredContent?.verdict, 'hold');
  assert.ok(r.structuredContent?.signals.some((s) => s.id === 'TRUSTED_PAYEE'));
  await client.close();
});

test('pharmacy payment to a trusted payee is allowed', async () => {
  const { client } = await t.connect();
  const r = await t.call<Check>(client, 'check_message', {
    householdId: HH, text: 'Pay Greenleaf Pharmacy $24 for my refill', context: { actionType: 'payment', amountCents: 2400, payee: 'Greenleaf Pharmacy' },
  });
  assert.equal(r.structuredContent?.verdict, 'allow');
  await client.close();
});

test('T-TOOL-5/6 two holds are independent; double resolve is a CONFLICT', async () => {
  const { client } = await t.connect();
  const ids: string[] = [];
  for (const text of ['Wire money today, the IRS says so', 'Buy gift cards, the bank must be paid now']) {
    const c = await t.call<Check>(client, 'check_message', { householdId: HH, text, context: { actionType: 'payment', payee: 'x' } });
    const h = await t.call<{ holdId: string }>(client, 'place_hold', { householdId: HH, checkId: c.structuredContent!.checkId, actionType: 'payment', description: text.slice(0, 40) });
    ids.push(h.structuredContent!.holdId);
  }
  assert.notEqual(ids[0], ids[1]);
  const first = await t.call(client, 'resolve_approval', { holdId: ids[0], decision: 'deny', resolvedBy: 'p_priya' });
  assert.equal(first.isError, undefined);
  const again = await t.call(client, 'resolve_approval', { holdId: ids[0], decision: 'deny', resolvedBy: 'p_priya' });
  assert.equal(again.isError, true);
  assert.equal(again.structuredContent?.code, 'CONFLICT');
  const other = await t.call<{ status: string }>(client, 'resolve_approval', { holdId: ids[1], decision: 'approve', resolvedBy: 'p_priya' });
  assert.equal(other.structuredContent?.status, 'released');
  await client.close();
});

test('T-TOOL-7 the elder cannot approve their own hold (FORBIDDEN)', async () => {
  const { client } = await t.connect();
  const c = await heroCheck(client);
  const h = await t.call<{ holdId: string }>(client, 'place_hold', { householdId: HH, checkId: c.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
  const res = await t.call(client, 'resolve_approval', { holdId: h.structuredContent!.holdId, decision: 'approve', resolvedBy: 'p_dorothy' });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent?.code, 'FORBIDDEN');
  assert.equal(t.repos.holds.get(h.structuredContent!.holdId)?.status, 'pending', 'still blocked');
  await client.close();
});

test('T-TOOL-8 an expired hold stays blocked and cannot be approved', async () => {
  const { client } = await t.connect();
  const c = await heroCheck(client);
  const h = await t.call<{ holdId: string }>(client, 'place_hold', { householdId: HH, checkId: c.structuredContent!.checkId, actionType: 'purchase', description: 'x' });
  t.clock.advance(61_000);
  const res = await t.call(client, 'resolve_approval', { holdId: h.structuredContent!.holdId, decision: 'approve', resolvedBy: 'p_priya' });
  assert.equal(res.isError, true);
  assert.equal(res.structuredContent?.code, 'CONFLICT');
  assert.equal(t.repos.holds.get(h.structuredContent!.holdId)?.status, 'expired');
  await client.close();
});

test('T-TOOL-9 trusted_payees: list is open, add/remove need an approver', async () => {
  const { client } = await t.connect();
  const list = await t.call<{ payees: Array<{ name: string }> }>(client, 'trusted_payees', { householdId: HH, action: 'list' });
  assert.ok(list.structuredContent!.payees.some((p) => p.name === 'greenleaf pharmacy'));
  const noWho = await t.call(client, 'trusted_payees', { householdId: HH, action: 'add', name: 'Corner Bakery' });
  assert.equal(noWho.structuredContent?.code, 'INVALID_INPUT');
  const elder = await t.call(client, 'trusted_payees', { householdId: HH, action: 'add', name: 'Corner Bakery', requestedBy: 'p_dorothy' });
  assert.equal(elder.structuredContent?.code, 'FORBIDDEN');
  const added = await t.call<{ payees: Array<{ name: string }> }>(client, 'trusted_payees', { householdId: HH, action: 'add', name: 'Corner Bakery', kind: 'merchant', requestedBy: 'p_priya' });
  assert.ok(added.structuredContent!.payees.some((p) => p.name === 'corner bakery'));
  const removed = await t.call<{ payees: Array<{ name: string }> }>(client, 'trusted_payees', { householdId: HH, action: 'remove', name: 'corner bakery', requestedBy: 'p_priya' });
  assert.ok(!removed.structuredContent!.payees.some((p) => p.name === 'corner bakery'));
  await client.close();
});

test('T-TOOL-10 oversized or empty text is rejected without writing a check', async () => {
  const { client } = await t.connect();
  const before = t.repos.checks.recent(HH, 1000).length;
  for (const text of ['', '   ', 'a'.repeat(2001)]) {
    const res = await client.callTool({ name: 'check_message', arguments: { householdId: HH, text } }).then(
      (r) => ({ isError: Boolean((r as { isError?: boolean }).isError) }),
      () => ({ isError: true }),
    );
    assert.equal(res.isError, true, JSON.stringify(text.slice(0, 5)));
  }
  assert.equal(t.repos.checks.recent(HH, 1000).length, before);
  await client.close();
});

test('unknown household and unknown hold give NOT_FOUND', async () => {
  const { client } = await t.connect();
  const a = await t.call(client, 'check_message', { householdId: 'hh_nope', text: 'hi' });
  assert.equal(a.structuredContent?.code, 'NOT_FOUND');
  const b = await t.call(client, 'request_family_approval', { holdId: 'hold_nope' });
  assert.equal(b.structuredContent?.code, 'NOT_FOUND');
  await client.close();
});

test('T-TOOL-11 every call writes an audit event', async () => {
  const { client } = await t.connect();
  const before = t.repos.audit.list(HH, 1000).length;
  await t.call(client, 'list_holds', { householdId: HH });
  assert.equal(t.repos.audit.list(HH, 1000).length, before + 1);
  await client.close();
});

test('T-SEC-1 hostile text is stored verbatim and does not break anything', async () => {
  const { client } = await t.connect();
  const nasty = `'); DROP TABLE holds; -- <img src=x onerror=alert(1)>`;
  const r = await t.call<Check>(client, 'check_message', { householdId: HH, text: nasty });
  assert.equal(r.isError, undefined);
  assert.equal(t.repos.checks.get(r.structuredContent!.checkId)?.text, nasty);
  const list = await t.call(client, 'list_holds', { householdId: HH });
  assert.equal(list.isError, undefined);
  await client.close();
});

test('read-only tools do not change the database (annotation vs behaviour)', async () => {
  const { client } = await t.connect();
  const count = () => (t.deps.db.prepare('SELECT (SELECT COUNT(*) FROM checks) c, (SELECT COUNT(*) FROM holds) h, (SELECT COUNT(*) FROM trusted_payees) p').get() as Record<string, number>);
  const before = count();
  await t.call(client, 'list_holds', { householdId: HH });
  await t.call(client, 'trusted_payees', { householdId: HH, action: 'list' });
  assert.deepEqual(count(), before);
  await client.close();
});
