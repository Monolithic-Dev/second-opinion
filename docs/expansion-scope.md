# Expansion scope (v2): from demo to platform

**Decision D11 (2026-10-09):** the team wants a large, genuinely working product. We expand in tiers. The tier rules below exist because the most common way strong teams lose is a big scope with a broken demo.

## Vision
**Second Opinion Platform** = (1) a protective MCP guard for Alexa+ payments, (2) a layered, explainable detection engine, (3) a household policy engine with multi-approver workflows, (4) a real family web app, (5) a drop-in **Guard SDK** so *any* merchant MCP server can protect its money-moving tools, (6) production-grade observability and tests, (7) an open benchmark.

## Tiers
| Tier | Contents | Protects | Rule |
|---|---|---|---|
| **0 — Core (must ship)** | Phases 1–6: engine L1, SQLite, six MCP tools, simulator, bench, submission | The submission | Must pass at **Gate G1 (Oct 11 end)** |
| **1 — Depth (judges can see it)** | X1 layered detection + ablation · X2 policy engine, multi-approver, escalation, notification outbox · X3 web app (family console + demo) · X4 Guard SDK + merchant example · X5 observability, property tests, E2E, Docker | Tech Implementation, Design, Impact, Idea scores | Feature freeze **Gate G3 (Oct 19)**; detection frozen **Gate G2 (Oct 16 end)** |
| **2 — Stretch** | i18n (es/hi) · MCP App card · weekly digest HTML mailer · AWS EC2 deploy · admin CLI extras · load-test report | Wow factor | Only if Tier 1 is done and stable |

## Gates (hard rules)
- **G1 (Oct 11 end):** hero flow works offline via `npm run demo`. If not, stop all Tier 1 work and fix.
- **G2 (Oct 16 end):** detection layers and weights frozen. Phase 5 test split runs once *after* this.
- **G3 (Oct 19):** feature freeze. Only bug fixes, docs, video from here.
- **Demo-safety rule:** every Tier 1 feature must be behind a flag or additive so the Tier 0 path can still be recorded if Tier 1 breaks. The video is recorded from a tagged commit.

## What judges will actually see (design the scope around this)
Judges may read only the repo and a 3-minute video. Extra surface area earns points **only if visible**:
| Feature | Where it shows |
|---|---|
| Layered detection + ablation | Accuracy slide: bars for L1, +L2, +L3, +L4 on the held-out test set |
| Policy + multi-approver + escalation | 10-second family-console clip: quorum 2 of 2, escalation timer |
| Family web app | Main visual in the video; "protected dollars" tile |
| Guard SDK + merchant example | README snippet (10 lines) + 10-second clip: a *different* MCP server blocked by the guard |
| Observability/tests | README badges, CI, `/metrics`, Playwright report (graders reading the repo) |
| MCP resources + prompts | Mentioned in architecture slide: uses tools + resources + prompts |

## Honest staffing note
Tier 0 ≈ 45 h. Tier 1 ≈ 45–50 h more. That is feasible for **3 people at ~4 h/day over 14 days (~168 h)** with an AI coding agent; it is **not** feasible for one person. Team size is currently unknown → ASSUMED 3. If smaller, cut X4 then X5 first.

## Non-goals (still)
Real call/SMS interception, mobile apps, custom model training, real money movement, real personal data.
