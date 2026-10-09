# Phase 5 — Evaluation and benchmark

**Goal / done:** 60 validated scripts in `scam-script-bench`, an eval runner in `second-opinion` that scores the engine on `dev` and (once) `test`, committed results table, failure analysis, and an optional cached Bedrock `rules+ai` variant.
**Preconditions:** Phase 2 complete (engine). Phases 3–4 not required, but the demo should already work.
**Implements:** `detection-engine.md` §6–7, `testing.md` (eval protocol), `prd.md` FR-9/FR-10 and success metrics; `scam-script-bench/docs/dataset-spec.md`, `scoring-spec.md`.

## Task breakdown
### 5A — Bench repo (`scam-script-bench`)
1. `package.json` (`type: module`, scripts `validate`, `score`), `schema/script.schema.json` (JSON Schema per `dataset-spec.md`).
2. **Author scripts** — person A writes `data/dev.jsonl` (30: 15 scam/15 benign, ≥ 6 scam categories, ≥ 40% benign `tricky`); **person B, who has not read the engine's regexes**, writes `data/test.jsonl` (same quotas). Invented text only; no real numbers/URLs/brands.
3. `scripts/validate.mjs` — validate each line (Ajv or hand checks), unique ids, quotas per split, authors differ across splits, near-duplicate check across splits (normalised Jaccard on word 3-grams < 0.8). Exit non-zero on any violation.
4. `scripts/score.mjs` — args `--labels <jsonl> --pred <jsonl>`; computes TP/FP/TN/FN, precision, recall, F1, FPR at *hold* and *flag*, per-category recall, misclassified ids; prints markdown + writes `results.json`; `null` on division by zero; missing predictions = `allow` (reported).
5. CI (`.github/workflows/ci.yml`): `npm ci && npm run validate`.

### 5B — Eval runner (`second-opinion/eval`)
1. `eval/run.ts` — `loadBench(path, split)`; run `evaluate(text, ctx, [])` for each script (fresh history per script); emit predictions JSONL; call the bench scorer logic (import via `BENCH_PATH/scripts/score.mjs` or reimplement 30 lines and unit-test against the bench's output); write `eval/results/latest.json` and `latest.md` with: both operating points, confusion matrix, per-category recall, misclassified ids with signals fired.
2. Flags: `--split dev|test|both`, `--variant rules|rules+ai`, `--cache-only` (CI), `--freeze-check` (refuses to run `test` if `eval/results/test-frozen.json` already exists unless `--force`, printing a loud warning).
3. **Protocol enforcement:** tune on `dev` only. Run `test` once; write `eval/results/test-frozen.json`. Subsequent rule edits require a dated entry in `docs/decisions.md` and a before/after table.
4. **Optional `rules+ai`** — `eval/ai.ts`: Bedrock Converse call (`@aws-sdk/client-bedrock-runtime`), model from `BEDROCK_MODEL_ID`; prompt returns JSON `{"signals":[...]}` restricted to the `SignalId` enum; parse strictly, drop unknown ids, union with rules via the same weights; cache by `sha256(model+promptVersion+text)` in `eval/cache/*.json` (committed); 3 s timeout, one retry, fallback to rules; refuse to run if no billing alarm env flag `BILLING_ALARM_SET=1` is set (guard against surprise cost).
5. Tests `eval/test/run.test.ts`: `scorer matches bench scorer on a 6-row fixture`, `freeze-check blocks second test run`, `cache-only never calls Bedrock (mock throws)`, `unknown AI signal ids dropped`.
6. **Failure analysis** — `docs/eval-report.md`: headline table, three worst misses (what, why, what we'd change), three false positives, limitations (English-only, 60 examples, authors from one team).
7. Add the results table to `README.md` and the demo slide (`demo-script.md`).

## Real-world engineering concerns
- **Leakage:** the test file is never opened during rule tuning; freeze file + commit hash of the engine recorded in results.
- **Reproducibility:** results include engine git SHA, bench SHA, variant, date; CI re-runs `dev` from cache.
- **Cost control:** ≤ 120 Bedrock calls (60 scripts × 2 splits... one pass each); cached forever; alarm flag required.
- **Honesty:** report the failures, not only the headline.

## Definition of done
- [ ] `npm run validate` in the bench repo passes: 30+30 records, quotas met, authors differ, no near-duplicates.
- [ ] `npm run eval -- --split dev` produces `eval/results/latest.md` offline.
- [ ] `test` run executed exactly once; `test-frozen.json` committed; headline recorded: *test recall at hold* and *benign FPR at hold* (targets ≥ 0.90 and ≤ 0.10, actuals reported either way).
- [ ] `docs/eval-report.md` lists ≥ 3 misclassifications with reasons.
- [ ] Bench repo public, MIT, README results badge; commit history inside the hackathon window.
- [ ] (Optional) `rules+ai` row present, reproducible from cache.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Authors write scripts that mirror the regexes | Person B writes `test` blind; include scam scripts with no obvious keyword (`tricky`) |
| Targets missed | Report honestly; show per-category analysis; add rules **only** with disclosure |
| Bedrock model access/approval delay | Optional; the demo and headline do not depend on it |
| Unexpected AWS cost | Alarm at $5, cache, call cap, guard flag |

## Time budget
9 h (20%): authoring 4 h, runner 3 h, report/optional AI 2 h. Cut first: `rules+ai`, per-category breakdown, near-duplicate check (do a manual scan instead).

## Handoff
Phase 6 can assume: final numbers and failure list exist for the video, README and Product Feedback; bench repo ready for the Open Source entry (contribution URL, repo URL). Tag `phase-5-done` in both repos.
