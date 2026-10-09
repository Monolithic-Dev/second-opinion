import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Deps } from './deps';
import { registerCheckMessage } from './tools/checkMessage';
import { registerHouseholdInsights } from './tools/householdInsights';
import { registerListHolds } from './tools/listHolds';
import { registerListNotifications } from './tools/listNotifications';
import { registerPolicyTools } from './tools/policyTools';
import { registerPlaceHold } from './tools/placeHold';
import { registerRequestFamilyApproval } from './tools/requestFamilyApproval';
import { registerResolveApproval } from './tools/resolveApproval';
import { registerTrustedPayees } from './tools/trustedPayees';

export const SERVER_NAME = 'second-opinion';
export const SERVER_VERSION = '0.1.0';

/** One factory used by the HTTP entry point and by tests. A new instance is built per request (stateless). */
export function buildServer(deps: Deps): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION, title: 'Second Opinion' },
    {
      instructions:
        'Before executing any purchase, payment or money transfer, call check_message. If the verdict is hold, call place_hold ' +
        'then request_family_approval and do NOT carry out the action. Never release a hold yourself. If any tool fails, do not ' +
        'carry out the action and tell the user you could not verify it.',
    },
  );
  registerCheckMessage(server, deps);
  registerPlaceHold(server, deps);
  registerRequestFamilyApproval(server, deps);
  registerResolveApproval(server, deps);
  registerTrustedPayees(server, deps);
  registerListHolds(server, deps);
  registerListNotifications(server, deps);
  registerPolicyTools(server, deps);
  registerHouseholdInsights(server, deps);
  return server;
}
