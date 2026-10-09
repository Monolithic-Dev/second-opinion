# X3 — Web app and Family Console (Tier 1)

**Goal / done:** `apps/web` (React + Vite + TS) served by the simulator BFF with `/demo` split view and the full Family Console (dashboard, holds queue and detail, circle, policy, insights, digest, audit, login).
**Preconditions:** Phase 4A (BFF) complete; X2 tools available (stub pages if not yet).
**Implements:** `family-console.md` (all), `ux-flows.md`, `api-spec.md` §E (BFF routes), AC-13, AC-33.

## Task breakdown
1. **Scaffold** `apps/web`: `npm create vite` (react-ts), add `react-router-dom`, `@tanstack/react-query`, `recharts`, `zod`, `vitest`, `@testing-library/react`. `vite.config.ts` proxy `/api` → `http://localhost:3000`; build output `apps/web/dist` served by the simulator (`express.static`) with SPA fallback; lite static UI remains at `/lite`.
2. **Design system**: `styles/tokens.css` (colors, risk levels, type scale, spacing, radius, focus ring, contrast mode), `components/` primitives (`Button`, `Badge`, `Card`, `Table`, `Dialog`, `Toast`, `Skeleton`, `EmptyState`).
3. **Data layer**: `hooks/useApi.ts` (typed fetch + zod parse of `@second-opinion/shared` response schemas; error boundary), `hooks/useEvents.ts` (EventSource, backoff reconnect, invalidates queries on `hold.created|hold.resolved|check.done|policy.updated|reset`, resync on reopen).
4. **BFF routes** (`apps/simulator/src/routes`): `auth.ts` (`POST /api/auth/login`, `POST /api/auth/logout`, signed httpOnly cookie, rate-limited to 5 tries/min), `family.ts` (`GET /api/family/holds`, `GET /api/family/holds/:id`, `POST /api/family/holds/:id/vote`, `GET|PUT /api/family/policy`, `GET /api/family/people`, `POST|DELETE /api/family/payees`, `GET /api/family/audit?cursor=`), `insights.ts` (`GET /api/family/insights?days=30`), `digest.ts` (`GET /api/family/digest/preview`). Each maps 1:1 to MCP tools via `McpGateway`; auth middleware requires a session for `/api/family/*`; zod-validate bodies; CSRF protection via same-site cookie + `X-Requested-With` check.
5. **Pages** (`src/routes`): `Demo.tsx` (elder pane, family pane, scenario buttons, `TraceDrawer`), `Dashboard.tsx` (status banner, `ProtectedDollarsTile`, pending count, `TrendChart`, recent activity), `Holds.tsx`, `HoldDetail.tsx` (`RiskCard`, `SignalList` with layer badges, `PolicyReasons`, `HoldTimeline`, `QuorumMeter`, `VotePanel` with note), `Circle.tsx`, `Policy.tsx` (`PolicyForm` with inline validation mirroring server rules + impact preview), `Insights.tsx`, `Digest.tsx`, `Audit.tsx` (search, filter, CSV export), `Login.tsx`.
6. **Accessibility pass**: landmarks, focus management on route change, `aria-live` regions for new holds, keyboard-only flows, reduced motion, contrast check; run `@axe-core/cli` and fix criticals.
7. **Responsive**: 1280×720 recording layout; 390 px "Priya's phone" frame; test both in Playwright viewports.
8. **Tests**: Vitest `RiskCard renders level and flags`, `VotePanel disables after click and shows CONFLICT message`, `QuorumMeter 1 of 2`, `PolicyForm rejects invalid ranges`, `ProtectedDollarsTile sums denied+expired`; BFF tests `auth required for /api/family/*`, `vote maps to resolve_approval`, `cookie is httpOnly`, `login rate limit`; Playwright (in X5) covers journeys.
9. **XSS check**: no `dangerouslySetInnerHTML`; test with `<img src=x onerror=alert(1)>` as message text and payee name.

## Real-world engineering concerns
Server-authoritative state (no optimistic votes); SSE reconnect/resync; schema-validated responses; session expiry handling (redirect to login with toast); loading/empty/error states for every page; bundle size budget < 400 kB gz (check `vite build` output).

## Definition of done
- [ ] `npm run build -w apps/web` succeeds; `npm run demo` serves `/demo` and `/family` from one origin.
- [ ] Hero flow in `/demo`; the same hold appears at `/family/holds` and can be voted; quorum 2 shows 1 of 2 → 2 of 2.
- [ ] Axe reports no critical issues on `/demo` and `/family`; Lighthouse a11y ≥ 95.
- [ ] Protected dollars tile equals the sum of denied+expired amounts for seeded data (AC-33).
- [ ] Lite UI at `/lite` still works (fallback for recording).

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Largest time sink in the project | Build `/demo` and `/family` + `/family/holds/:id` first (80% of video value); Insights/Digest/Audit last |
| Chart/library fiddling | Recharts defaults; one chart style |
| Auth complexity | Demo-grade PIN session only, documented honestly |

## Time budget
14 h. Cut first (in order): Digest page, Audit CSV, Circle editing (read-only), Insights second chart.

## Handoff
X5 can run E2E against the built app; Phase 6 uses `/demo` for the video. Tag `x3-done`.
