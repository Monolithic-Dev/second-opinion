import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAppResource, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { CARD_HTML } from './card.generated';

/** MCP App view shown by hosts that render UI (Alexa+ on a screen). Tools without UI support still return full text and structuredContent. */
export const CARD_URI = 'ui://second-opinion/card.html';

export function registerCard(server: McpServer): void {
  registerAppResource(
    server,
    'Second Opinion card',
    CARD_URI,
    // No network access is needed or declared: the view is a single self-contained document.
    { mimeType: RESOURCE_MIME_TYPE, description: 'Shows the verdict, the red flags and who must approve a request.' },
    async () => ({ contents: [{ uri: CARD_URI, mimeType: RESOURCE_MIME_TYPE, text: CARD_HTML }] }),
  );
}
