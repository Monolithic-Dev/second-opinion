import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ID_PATTERN, ToolError, fakeClock, newId, systemClock, SIGNAL_IDS, ERROR_CODES } from '../src';

test('newId has the right prefix, shape and is unique', () => {
  const ids = new Set(Array.from({ length: 500 }, () => newId('chk')));
  assert.equal(ids.size, 500);
  for (const id of ids) {
    assert.match(id, /^chk_[a-z0-9]{10}$/);
    assert.match(id, ID_PATTERN);
  }
});

test('ToolError carries a code and message', () => {
  const e = new ToolError('FORBIDDEN', 'nope');
  assert.equal(e.code, 'FORBIDDEN');
  assert.equal(e.message, 'nope');
  assert.ok(e instanceof Error);
});

test('fakeClock advances and can be set', () => {
  const c = fakeClock('2026-10-09T00:00:00.000Z');
  assert.equal(c().toISOString(), '2026-10-09T00:00:00.000Z');
  c.advance(60_000);
  assert.equal(c().toISOString(), '2026-10-09T00:01:00.000Z');
  c.set('2026-10-10T00:00:00.000Z');
  assert.equal(c().toISOString(), '2026-10-10T00:00:00.000Z');
});

test('systemClock returns a Date', () => {
  assert.ok(systemClock() instanceof Date);
});

test('enums have no duplicates', () => {
  assert.equal(new Set(SIGNAL_IDS).size, SIGNAL_IDS.length);
  assert.equal(new Set(ERROR_CODES).size, ERROR_CODES.length);
});
