# Connecting to Alexa+ (what is real, what is not, and how to do it)

## Honest status
**This project is not connected to a real Alexa+ today.** In the demo, a simulator plays Alexa+: it is a real MCP client that calls our real MCP server over Streamable HTTP, but the voice assistant itself is simulated. What is ready for a real connection is the server side. The connection steps below were read from Amazon's developer documentation (Alexa+ MCP Toolkit quickstart); the commands have **not** been run by us, and access to the Alexa+ add-on tooling may be limited. Verify against the current docs before relying on them.

## How Alexa+ talks to an MCP server (per the docs)
1. You wrap your server in an **Alexa+ MCP add-on** (`addon.json` plus media), created with the `alexa-ai` CLI.
2. Alexa+ is the MCP **client**. At runtime it reaches our server over **Streamable HTTP** at a public HTTPS URL, through the add-on.
3. Alexa+ refreshes the tool list only when you run `alexa-ai deploy`.

## What the docs require, and where we stand
| Requirement | Status |
|---|---|
| Streamable HTTP (not legacy SSE), MCP spec 2025-11-25 | Done (stateless Streamable HTTP, SDK 1.32.1) |
| Remote HTTPS URL (a tunnel such as cloudflared is fine for development) | Not done: local only. Run `cloudflared tunnel --url http://localhost:3001` and set `PUBLIC_URL` |
| OAuth 2.1 authorization code + PKCE (S256), `resource` parameter, protected-resource metadata, authorization-server metadata, static client (no dynamic registration), 401 without `WWW-Authenticate` | **Done** (`apps/mcp-server/src/oauth.ts`, tests T-OAUTH-1 to 9) |
| Round trip under 500 ms | Likely (the engine takes about a millisecond and tools are synchronous SQLite), **not measured against Alexa+**. Measure through the tunnel |
| Add-on package (`addon.json`, icons, carousel image, privacy and terms URLs) | Template only: `alexa-addon/addon.json`. Needs real URLs and artwork |
| Visuals via the MCP Apps standard (optional) | **Done**: `check_message` and `get_hold` link to a `ui://second-opinion/card.html` view (verdict, red flags, who must approve), authored for Alexa's 768x480 reference size, self-contained (no network), with text fallback for voice-only devices. Tested at protocol level (T-CARD-1 to 3) and rendered in a browser with a stand-in host; **not yet seen on a real Alexa+ screen** |
| Elicitation (Alexa+ asking the user to confirm) | Not covered by the quickstart page we read; not implemented |

## Account linking: how OAuth works here
The family member opens the link page Alexa+ sends them to, types the **family link code**, and Alexa+ receives a short-lived access token (1 h) and a refresh token (30 days) bound to **one household**.
- A linked assistant can check messages, place holds and ask family to approve.
- It **cannot** call `resolve_approval` or `set_policy`, and it cannot read or touch another household (checked on `householdId` and on the household of any `holdId`). Approvals happen only in the family console. Tested in T-OAUTH-7.
- Wrong link codes are rate limited and audited. Codes are single use. Tokens are signed (HMAC-SHA256) with a server secret; rotate `OAUTH_SIGNING_KEY` to revoke everything.

## Steps to connect (to be verified against the live docs)
1. Pick a public URL and set the server environment:
   ```
   PUBLIC_URL=https://<your-tunnel>.trycloudflare.com
   OAUTH_CLIENT_ID=<client id Alexa+ gives you>
   OAUTH_CLIENT_SECRET=<client secret, 16+ chars>
   OAUTH_REDIRECT_URIS=<redirect URI(s) Alexa+ shows for your add-on>
   OAUTH_SIGNING_KEY=<32+ random characters>
   OAUTH_LINK_CODE=<code the family types, 6+ characters>
   OAUTH_HOUSEHOLD=hh_demo
   ```
2. `npm run demo` (or `docker compose up`) and start the tunnel to the MCP port.
3. `alexa-ai configure`, then create the add-on (`alexa-ai new mcp --name "Second Opinion" --locale en-US --mcp-server-url "$PUBLIC_URL"`, or use the Add-on Agent Skill in a coding agent), fill in `addon.json` from `alexa-addon/addon.json`, and `alexa-ai deploy`.
4. Test in the Alexa+ web simulator or on a device. Repeat `alexa-ai deploy` after any tool change.
5. `alexa-ai submit` only after testing.

## What to say in the submission
"The MCP server, the OAuth account-linking flow and the safety rules are built to the Alexa+ MCP Toolkit requirements and tested against a real MCP client. The Alexa+ voice experience in the video is a simulator." Do not claim a live Alexa+ connection unless step 4 was actually done.

## Open questions to resolve on the Resources page
Whether add-on testing needs special access during the hackathon; whether Alexa+ sends the end user's words to a tool verbatim (our `check_message` needs the user's words, see the Agent Skill); how Alexa+ displays `structuredContent`; elicitation support.
