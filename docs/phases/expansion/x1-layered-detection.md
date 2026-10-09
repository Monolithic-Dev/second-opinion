# X1 — Layered detection and ablation (Tier 1)

**Goal / done:** `packages/engine` runs four layers (rules, playbook similarity, household behavior, optional LLM) fused into one explainable score, with an ablation table (L1, L1+L2, L1+L2+L3, +L4) produced by `eval`.
**Preconditions:** Phase 2 (engine L1) and Phase 3 (store/history) complete. G1 passed.
**Implements:** `detection-engine.md` §9 (layers), `acceptance-criteria.md` AC-20…AC-23, `testing.md` property tests.
**Freeze:** weights frozen at **G2 (Oct 16 end)**; Phase 5 test run happens after.

## Task breakdown
1. **Refactor to packages**: move `apps/mcp-server/src/engine/*` into `packages/engine/src` (`index.ts`, `types.ts`, `normalize.ts`, `explain.ts`, `fingerprint.ts`) and Phase 2 code into `layers/rules.ts`; move shared types to `packages/shared`. Update imports; `npm test` must stay green before adding anything.
2. **Layer interface** (`layers/types.ts`): `interface Layer { id: 'rules'|'playbooks'|'behavior'|'llm'; run(input: LayerInput): Signal[] }`, `LayerInput {text, normalized, ctx, history: HistoryItem[], payments: PaymentItem[], now: Date}`.
3. **Playbook KB** (`src/playbooks/*.json`, ~20 files; schema in `shared`): `{id, name, summary, phrases: string[], redFlags: SignalId[], advice, example}` — gift-card bank impersonation, grandparent scam, tech-support remote access, IRS/SSA, romance, lottery, refund overpayment, utility shutoff, package fee, crypto ATM, verification code theft, etc. Invented phrasing only.
4. **`layers/playbooks.ts`**: build an in-memory BM25 index (tokenise, stopwords, bigrams) at startup; `run()` returns `PLAYBOOK_MATCH` with `weight = min(30, round(30 × sim))` when `sim ≥ 0.5`, `evidence = playbook.name`; `sim` = normalised BM25 score ∈ [0,1] (document the normalisation). Deterministic ties by playbook id. Expose `topMatches(text, k)` for the `so://playbooks` resource and explanations.
5. **`layers/behavior.ts`**: features from `payments` (last 30 days, approved only): `AMOUNT_ANOMALY` (≥5 prior payments, amount > mean+3σ **and** ≥ 20000 cents, or > 5× median and ≥ 20000), `PAYEE_VELOCITY` (≥ 2 new payees in 7 days → 15), `QUIET_HOURS` (uses policy timezone from ctx; +10), `RETRY_AFTER_DENY` (same fingerprint as a denied hold within 24 h → +30). Handle empty/short history by emitting nothing. *Validation:* ignore NaN/negative amounts.
6. **`layers/llm.ts`** (optional): interface only; implementation in `eval/ai.ts` and simulator `bedrock.ts` (cached). Returns signal ids ∈ enum; dropped otherwise.
7. **`layers/fusion.ts`**: sum with per-layer caps (rules unbounded to 100; playbooks ≤ 30; behavior ≤ 40; llm ≤ 20), clamp 0–100, thresholds 60/30, hard rules from L1 retained; `reasons[]` (layer, signal, weight) for explanations; `enabledLayers` option (for ablation) defaults to `['rules','playbooks','behavior']`.
8. **`evaluate()`** signature extends: `evaluate(text, ctx, history, options?: {layers?: LayerId[], payments?: PaymentItem[], now?: Date})`; `CheckResult` adds `layerBreakdown: Record<LayerId, number>`.
9. **Store support**: `store.repos.payments.recent(hh, days)` (approved/released holds + trusted payments), migration not required (derive from `holds`/`checks`); `tools/checkMessage.ts` passes `payments` and `now`.
10. **Explain**: add flag text for new signals (`PLAYBOOK_MATCH` → "Matches a known scam: {name}", `AMOUNT_ANOMALY` → "Much larger than usual", `PAYEE_VELOCITY` → "Several new payees recently", `QUIET_HOURS` → "Unusual hour", `RETRY_AFTER_DENY` → "Tried again after family said no").
11. **Ablation in eval** (`eval/ablation.ts`): run variants `L1`, `L1+L2`, `L1+L2+L3`, `L1+L2+L3+L4(cached)` on dev; on test only after G2; write `eval/results/ablation.md` and a small SVG bar chart for the slide.
12. **Tests**: `playbooks.test.ts` (`exact playbook phrase scores sim ≥ 0.8`, `unrelated text scores < 0.5`, `deterministic ties`), `behavior.test.ts` (`anomaly needs ≥5 payments`, `velocity threshold`, `quiet hours across midnight`, `retry after deny within 24h only`), `fusion.test.ts` (`layer caps respected`, `hard rule survives negatives`), `properties.test.ts` with `fast-check` (P1 determinism, P2 monotonicity, P3 threshold consistency, P5 normalise idempotent).

## Real-world engineering concerns
Index built once, not per request; BM25 params fixed constants (k1 1.2, b 0.75); timezone handling via `Intl.DateTimeFormat` (no extra deps); layers independent so any can be disabled by flag (demo-safety).

## Definition of done
- [ ] All AC-20…AC-23 tests pass; property tests run ≥ 200 cases each.
- [ ] Hero input still `hold`/100; benign bank alert still `allow` with all layers on.
- [ ] `npm run eval -- --split dev --ablation` writes `ablation.md` with 4 rows.
- [ ] `check_message` p95 < 50 ms locally (quick `autocannon` run).

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Playbook similarity inflates false positives on benign alerts | Cap layer at 30; benign tricky scripts in dev; OFFICIAL_CHANNEL_ADVICE still applies |
| Behavior layer needs history the demo doesn't have | Seed 12 plausible payments for `hh_demo`; label as synthetic |
| Scope creep into ML | WON'T: embeddings/neural models (keep lexical, deterministic) |

## Time budget
8 h (≈ 9% of total). Cut first: L4 wiring, SVG chart (use table), `PAYEE_VELOCITY`.

## Handoff
X2/X3 can assume `CheckResult.layerBreakdown`, new signal ids, and `payments` history exist. Tag `x1-done`.
