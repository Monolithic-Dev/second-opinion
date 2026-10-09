# Web app and Family Console (Tier 1) — `apps/web`

One React + Vite + TypeScript SPA served by the simulator BFF. It contains the **demo view** (elder + family side by side) and the **Family Console** (what a real caregiver would use). Design is 25% of the score, so this is the main visual in the video.

## Stack (suggested)
React 18, Vite, TypeScript, React Router, TanStack Query (data), Recharts (charts), plain CSS with design tokens (`styles/tokens.css`), no UI kit. SSE via `EventSource` hook (`useEvents`). Tests: Vitest + Testing Library for components; Playwright for E2E.

## Routes
| Route | Purpose |
|---|---|
| `/demo` | Split screen: **Elder (Dorothy)** left, **Family (Priya's phone)** right, scenario buttons, developer trace drawer. This is the recording view. |
| `/family` | Dashboard: protection status ("Dorothy is protected"), **Protected dollars** tile, pending holds count, risk trend sparkline, recent activity |
| `/family/holds` | Queue: filter by status; badges for risk level and reasons |
| `/family/holds/:id` | Detail: red-flag card, signals with evidence, policy reasons, timeline (created → notified → escalated → decided), vote buttons with note, quorum progress (1 of 2) |
| `/family/circle` | People (roles, ranks) and trusted payees (add/remove) |
| `/family/policy` | Policy editor with validation and live "what would this change" preview |
| `/family/insights` | Charts: checks per day by verdict, top signals, blocked vs approved amounts, hold response time |
| `/family/digest` | Weekly digest preview (HTML rendered from `notify` templates) |
| `/family/audit` | Searchable audit log (tool calls, state changes), export CSV |
| `/login` | Demo family login (seeded PIN, documented as demo-only) |

## Components (`src/components`)
`RiskCard`, `SignalList`, `PolicyReasons`, `HoldTimeline`, `VotePanel`, `QuorumMeter`, `ProtectedDollarsTile`, `TrendChart`, `PayeeTable`, `PolicyForm`, `TraceDrawer`, `ToastHost`, `EmptyState`, `Skeleton`.

## Data layer
- `useApi` wraps `fetch` to BFF `/api/*` with typed responses from `@second-opinion/shared` schemas (runtime-validated with zod; invalid ⇒ error boundary).
- `useEvents` subscribes to `/api/events`; on `hold.*`/`check.done`/`policy.updated`/`reset` it invalidates relevant queries; reconnect with backoff; resync on reconnect.
- Mutations are server-authoritative (no optimistic updates for votes).

## Design rules
Tokens: risk colors (green/amber/red) with AA contrast; type scale (body 18 px, elder captions 32 px); spacing 4-pt grid; 44 px targets; focus rings; `prefers-reduced-motion`; high-contrast mode via `data-contrast`. Layout works at 1280×720 (video) and 390 px (phone width for the "Priya's phone" frame).

## Auth (demo-grade, honest)
`POST /api/auth/login {personId, pin}` → httpOnly, SameSite=Lax cookie with signed session (HMAC, `SESSION_SECRET`), 8 h expiry. Seeded PIN for `p_priya` documented in README as a **demo credential**. Elder routes need no login (simulates the device). Production would use proper identity (Login with Amazon etc.).

## Acceptance (see `phases/expansion/x3-web-app-and-family-console.md`)
Hero flow works in `/demo` and `/family/holds/:id`; quorum-2 shows 1 of 2 then 2 of 2; Lighthouse accessibility ≥ 95 on `/family` and `/demo`; no `innerHTML`; works offline from local servers.
