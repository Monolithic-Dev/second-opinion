import { test } from 'node:test';
import assert from 'node:assert/strict';
// @ts-expect-error plain .mjs build script
import { buildCardHtml } from '../../../scripts/build-card.mjs';
import { CARD_HTML } from '../src/ui/card.generated';
import { CARD_URI } from '../src/ui/register';
import { startTestServer } from './helpers';

test('T-CARD-1 the visual tools point at the card and the others do not (MCP Apps metadata)', async () => {
  const t = await startTestServer();
  try {
    const { client } = await t.connect();
    const tools = (await client.listTools()).tools;
    const meta = (name: string) => (tools.find((x) => x.name === name)?._meta ?? {}) as { ui?: { resourceUri?: string } };
    assert.equal(meta('check_message').ui?.resourceUri, CARD_URI);
    assert.equal(meta('get_hold').ui?.resourceUri, CARD_URI);
    assert.equal(meta('resolve_approval').ui, undefined);
    assert.equal(tools.length, 12, 'no tool was added or lost');
    await client.close();
  } finally {
    await t.close();
  }
});

test('T-CARD-2 the card is served as an MCP App resource: right MIME type, self-contained, shows the key states', async () => {
  const t = await startTestServer();
  try {
    const { client } = await t.connect();
    const listed = (await client.listResources()).resources.find((r) => r.uri === CARD_URI);
    assert.ok(listed);
    assert.match(listed!.mimeType ?? '', /^text\/html;profile=mcp-app/);
    const read = await client.readResource({ uri: CARD_URI });
    const html = String((read.contents[0] as { text?: string }).text);
    assert.equal(read.contents[0]?.mimeType, listed!.mimeType);
    assert.match(html, /^<!doctype html>/i);
    assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+href=|@import/i, 'no external files, so no network permission is needed');
    for (const text of ['Paused for your family', 'Be careful', 'Looks fine', 'Alexa cannot approve this']) assert.ok(html.includes(text), text);
    await client.close();
  } finally {
    await t.close();
  }
});

test('T-CARD-3 the generated card is up to date with its source (run `npm run build:card` if this fails)', async () => {
  assert.equal(CARD_HTML, await buildCardHtml());
});
