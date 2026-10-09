import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKOFF_MS, MAX_ATTEMPTS, backoffFor, dispatchDue, emailHtmlAdapter, escapeHtml, money, renderNotification,
  type Adapter, type HoldPayload, type Notification, type OutboxPort,
} from '../src';

const payload: HoldPayload = {
  holdId: 'hold_abc', recipientName: 'Priya', description: '5 x $200 gift cards', amountCents: 100_000,
  flags: ['Asks for gift cards', 'Pressure to act right now'], reasonText: ['The request looks like a scam'], expiresAt: '2026-10-09T12:10:00.000Z',
};

test('T-NTF-3 rendering escapes every dynamic value (no HTML injection)', () => {
  const evil: HoldPayload = {
    ...payload, recipientName: '<script>alert(1)</script>', description: '"><img src=x onerror=alert(1)>',
    flags: ['<b>bold</b>'], reasonText: ["O'Reilly & Sons"],
  };
  const { html, subject, text } = renderNotification('hold_requested', evil);
  assert.ok(!html.includes('<script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<b>bold</b>'));
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /O&#39;Reilly &amp; Sons/);
  assert.match(subject, /img src=x/, 'subject is plain text, escaped only inside the HTML title');
  assert.ok(text.includes('<b>bold</b>'), 'the plain-text part is not HTML-escaped');
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
});

test('each notification kind renders a distinct subject and the safety line', () => {
  const kinds = ['hold_requested', 'hold_escalated', 'hold_resolved'] as const;
  const subjects = kinds.map((k) => renderNotification(k, { ...payload, status: 'denied' }).subject);
  assert.equal(new Set(subjects).size, 3);
  assert.match(renderNotification('hold_requested', payload).text, /stays blocked/);
  assert.match(renderNotification('hold_resolved', { ...payload, status: 'expired' }).subject, /stayed blocked/);
  assert.ok(!/https?:\/\//.test(renderNotification('hold_requested', payload).html), 'no links or remote content');
  assert.equal(money(100_000), '$1,000');
  assert.equal(money(2_450), '$24.50');
  assert.equal(money(null), 'an amount');
});

function fakePort(rows: Notification[]) {
  const state = new Map(rows.map((r) => [r.id, { ...r, status: 'queued' as string, next: '', error: '' }]));
  const port: OutboxPort = {
    due: (now) => [...state.values()].filter((r) => r.status === 'queued' && (r.next === '' || r.next <= now)),
    markSent: (id) => { state.get(id)!.status = 'sent'; },
    retry: (id, attempts, next, error) => { const r = state.get(id)!; r.attempts = attempts; r.next = next; r.error = error; },
    fail: (id, attempts, error) => { const r = state.get(id)!; r.status = 'failed'; r.attempts = attempts; r.error = error; },
  };
  return { port, state };
}
const note = (id: string, channel: Notification['channel'] = 'console'): Notification => ({
  id, householdId: 'hh_demo', recipientId: 'p_priya', channel, kind: 'hold_requested', payload, attempts: 0,
});

test('T-NTF-1 backoff is 5s, 20s, 80s and the 4th failure is final', async () => {
  assert.deepEqual([...BACKOFF_MS], [5_000, 20_000, 80_000]);
  assert.equal(MAX_ATTEMPTS, 4);
  assert.equal(backoffFor(1), 5_000);
  assert.equal(backoffFor(3), 80_000);
  assert.equal(backoffFor(4), null);

  const { port, state } = fakePort([note('ntf_1')]);
  const failing: Adapter = { channel: 'console', send() { throw new Error('smtp down'); } };
  let t = new Date('2026-10-09T12:00:00.000Z');
  const expectedDelays = [5_000, 20_000, 80_000];
  for (let i = 0; i < 3; i++) {
    const r = await dispatchDue(port, [failing], t);
    assert.deepEqual(r, { sent: 0, retried: 1, failed: 0 });
    assert.equal(state.get('ntf_1')!.next, new Date(t.getTime() + expectedDelays[i]!).toISOString());
    const early = await dispatchDue(port, [failing], new Date(t.getTime() + expectedDelays[i]! - 1));
    assert.deepEqual(early, { sent: 0, retried: 0, failed: 0 }, 'not due before the backoff elapses');
    t = new Date(t.getTime() + expectedDelays[i]!);
  }
  const last = await dispatchDue(port, [failing], t);
  assert.deepEqual(last, { sent: 0, retried: 0, failed: 1 });
  assert.equal(state.get('ntf_1')!.status, 'failed');
  assert.equal(state.get('ntf_1')!.attempts, 4);
  assert.match(state.get('ntf_1')!.error, /smtp down/);
});

test('a notification succeeds on retry and is then never sent again', async () => {
  const { port, state } = fakePort([note('ntf_2')]);
  let calls = 0;
  const flaky: Adapter = { channel: 'console', send() { calls++; if (calls < 2) throw new Error('blip'); } };
  const t0 = new Date('2026-10-09T12:00:00.000Z');
  assert.equal((await dispatchDue(port, [flaky], t0)).retried, 1);
  assert.equal((await dispatchDue(port, [flaky], new Date(t0.getTime() + 5_000))).sent, 1);
  assert.equal(state.get('ntf_2')!.status, 'sent');
  assert.deepEqual(await dispatchDue(port, [flaky], new Date(t0.getTime() + 600_000)), { sent: 0, retried: 0, failed: 0 });
  assert.equal(calls, 2);
});

test('a missing adapter is a retriable failure, one bad notification does not block the rest', async () => {
  const { port, state } = fakePort([note('ntf_3', 'db'), note('ntf_4', 'console')]);
  const sent: string[] = [];
  const ok: Adapter = { channel: 'console', send(n) { sent.push(n.id); } };
  const r = await dispatchDue(port, [ok], new Date('2026-10-09T12:00:00.000Z'));
  assert.deepEqual(r, { sent: 1, retried: 1, failed: 0 });
  assert.deepEqual(sent, ['ntf_4']);
  assert.match(state.get('ntf_3')!.error, /no adapter for channel db/);
});

test('T-NTF-4 the email adapter writes escaped HTML to <dir>/<id>.html and rejects unsafe ids', async () => {
  const written: Record<string, string> = {};
  const adapter = emailHtmlAdapter('/out', (path, content) => { written[path.replace(/\\/g, '/')] = content; });
  adapter.send({ ...note('ntf_ok', 'email_html'), payload: { ...payload, description: '<i>x</i>' } });
  const file = written['/out/ntf_ok.html'];
  assert.ok(file && file.includes('&lt;i&gt;x&lt;/i&gt;'));
  assert.throws(() => adapter.send({ ...note('../../etc/passwd', 'email_html') }), /unsafe notification id/);
  assert.equal(Object.keys(written).length, 1);
});
