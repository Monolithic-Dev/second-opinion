import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadSimConfig } from '../src/config';
import { parseCookies, pinMatches, signSession, verifySession } from '../src/session';

const SECRET = 'a-test-secret-of-sufficient-length';
const NOW = 1_800_000_000_000;

test('T-SESS-1 a signed session verifies until it expires', () => {
  const token = signSession({ personId: 'p_priya', exp: NOW + 60_000 }, SECRET);
  assert.deepEqual(verifySession(token, SECRET, NOW), { personId: 'p_priya', exp: NOW + 60_000 });
  assert.equal(verifySession(token, SECRET, NOW + 61_000), null, 'expired');
});

test('T-SESS-2 tampering, a wrong secret and malformed tokens are rejected', () => {
  const token = signSession({ personId: 'p_priya', exp: NOW + 60_000 }, SECRET);
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ personId: 'p_dorothy', exp: NOW + 60_000 })).toString('base64url');
  assert.equal(verifySession(`${forged}.${sig}`, SECRET, NOW), null);
  assert.equal(verifySession(`${body}.AAAA`, SECRET, NOW), null);
  assert.equal(verifySession(token, 'another-secret-of-sufficient-len', NOW), null);
  for (const bad of [undefined, '', 'nodot', '.', 'a.b.c']) assert.equal(verifySession(bad, SECRET, NOW), null);
});

test('cookie parsing and PIN comparison', () => {
  assert.deepEqual(parseCookies('a=1; so_session=abc%2Fdef; b=2'), { a: '1', so_session: 'abc/def', b: '2' });
  assert.deepEqual(parseCookies(undefined), {});
  assert.equal(pinMatches('1234', '1234'), true);
  assert.equal(pinMatches('1235', '1234'), false);
  assert.equal(pinMatches('1234', undefined), false);
});

test('T-CFG-1 production refuses default credentials; bad PIN lists are rejected', () => {
  assert.throws(() => loadSimConfig({ NODE_ENV: 'production' }), /non-default/);
  assert.doesNotThrow(() =>
    loadSimConfig({ NODE_ENV: 'production', SESSION_SECRET: 'x'.repeat(32), FAMILY_PINS: 'p_priya:928311', MCP_AUTH_TOKEN: 'y'.repeat(32) }),
  );
  assert.throws(() => loadSimConfig({ FAMILY_PINS: 'oops' }), /FAMILY_PINS/);
  assert.deepEqual(loadSimConfig({}).pins, { p_priya: '1234', p_arjun: '5678' });
});

test('the login rate limit is configurable and defaults to 10 per minute', () => {
  assert.equal(loadSimConfig({}).loginRateLimitPerMin, 10);
  assert.equal(loadSimConfig({ LOGIN_RATE_LIMIT_PER_MIN: '1000' }).loginRateLimitPerMin, 1000);
});
