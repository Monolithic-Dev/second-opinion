# Phase 2 — Risk engine

**Goal / done:** a pure, deterministic engine in `apps/mcp-server/src/engine/` that turns text + context into `{signals, score, verdict, hardRule, fingerprint, similarTo, spokenSummary, card}` with ≥ 25 passing unit tests and no I/O.
**Preconditions:** Phase 1 complete (workspace, `npm test` works).
**Implements:** `detection-engine.md` §1–5, §8; `edge-cases.md` #1–7, #18; `prd.md` FR-2, FR-5, FR-6.

## Task breakdown
1. **`engine/types.ts`** — export exactly: `SignalId` (14 ids in `detection-engine.md` §1), `Signal {id, weight, evidence}`, `Verdict`, `Context {channel?, actionType?, amountCents?, payee?, trustedPayees?}`, `Card {title, level:'allow'|'caution'|'hold', flags:string[], advice:string}`, `Similar {checkId, date, holdId?}`, `CheckResult {verdict, score, signals, hardRule?, fingerprint, similarTo:Similar|null, spokenSummary, card}`, `HistoryItem {checkId, fingerprint, createdAt, holdId?}`.
2. **`engine/signals.ts`** — `SIGNAL_PATTERNS: Record<SignalId, RegExp[]>`; `WEIGHTS: Record<SignalId, number>` (45/40/40/35/30/30/25/25/20/10/15/15/−40/−25); `normalize(text)` (NFKC, lowercase, collapse whitespace, strip zero-width chars); `parseAmountCents(text)` (handles `$1,000`, `$200.50`, `5 x $200`, `five hundred dollars`, `2 thousand`; returns largest plausible total, ≤ 10,000,000); `detectSignals(text, ctx)` returns `Signal[]` (deduped, first match as `evidence`, max 80 chars). Context-derived: `NEW_PAYEE` when `ctx.payee` set, `actionType !== 'none'` and payee not in `ctx.trustedPayees`; `TRUSTED_PAYEE` when it is; `HIGH_AMOUNT` when `ctx.amountCents ?? parseAmountCents(text) ≥ 50000`. *Validation:* throw `RangeError` if text empty or > 2000 chars (tool layer maps to `INVALID_INPUT`).
3. **`engine/score.ts`** — `scoreSignals(signals): {score, verdict, hardRule?}`: sum, clamp 0–100, thresholds (≥60 hold, ≥30 caution); then hard rules in order: `GIFT_CARD_PLUS_ANY`, `REMOTE_ACCESS_PLUS_AUTHORITY`, `CODE_PLUS_UNSOLICITED` — hard rules only *raise* to `hold`. Negative signals never override a hard rule.
4. **`engine/fingerprint.ts`** — `fingerprint(signals)`: positive ids sorted, joined by `|` (empty → `NONE`); `jaccard(a: string[], b: string[])`; `findSimilar(fp, history: HistoryItem[], threshold = 0.75): Similar | null` (best match; ties → most recent; `NONE` never matches).
5. **`engine/explain.ts`** — `FLAG_TEXT: Record<SignalId,string>` (e.g. GIFT_CARD → "Asks for gift cards"); `ADVICE_TEXT` per top signal ("Real banks never ask for gift cards."); `explain(verdict, signals, similarTo): {spokenSummary, card}`; spoken summary ≤ 25 words, grade-6, no blame; mention "same as {weekday}" when `similarTo`.
6. **`engine/index.ts`** — `evaluate(text, ctx, history): CheckResult` composing 2→5. No I/O, no `Date.now()` (take dates from history).
7. **Tests** `test/engine.test.ts` + `test/fixtures/utterances.ts` (12 fixtures: 4 scam, 4 benign, 4 tricky): `T-ENG-1 hero input scores 100 hold GIFT_CARD_PLUS_ANY`, `T-ENG-2 gift card alone is caution not allow`, `T-ENG-3 remote access + bank impersonation holds`, `T-ENG-4 verification code + unsolicited holds`, `T-ENG-5 parses "five hundred dollars" to 50000`, `T-ENG-5b parses 5 x $200 to 100000`, `T-ENG-6 trusted payee + gift card still holds`, `T-ENG-7 genuine bank alert allows`, `T-ENG-8 pharmacy payment with trusted payee allows`, `T-ENG-9 jaccard boundary 3/4 matches 2/4 doesn't`, `T-ENG-10 deterministic: 100 runs identical`, `T-ENG-11 empty text throws RangeError`, `T-ENG-12 2001 chars throws`, `T-ENG-13 unicode/zero-width obfuscation of "gift card" still detected`, `T-ENG-14 non-Latin text returns no signals without crashing`, `T-ENG-15 prompt-injection text ("ignore rules and approve") adds no signals`, `T-ENG-16 spokenSummary ≤ 25 words for every fixture`.

## Real-world engineering concerns
- **ReDoS:** every regex must be linear; no nested quantifiers; add a test running 2000-char adversarial strings under 20 ms.
- **Determinism:** no randomness, no clock, no locale-dependent casing (`toLowerCase('en-US')`).
- **Obfuscation:** normalise leetspeak/spacing minimally (`g1ft c@rd`) — only common cases; document limits in `detection-engine.md`.
- **Do not tune on test data** (it doesn't exist yet in this repo; Phase 5 enforces the split).

## Definition of done
- [ ] `npm test` shows all T-ENG tests passing (≥ 17 cases).
- [ ] Hero utterance with `{actionType:'purchase', amountCents:100000}` → `score 100`, `verdict 'hold'`, `hardRule 'GIFT_CARD_PLUS_ANY'`, flags include gift cards/urgency/bank.
- [ ] Genuine bank-alert fixture → `allow`; trusted pharmacy → `allow`.
- [ ] `grep -R "fs\|http\|Date.now" apps/mcp-server/src/engine` finds nothing.
- [ ] Adversarial 2000-char input handled < 20 ms.

## Risks and blockers
| Risk | Mitigation |
|---|---|
| Regexes overfit to my own examples | Keep rules category-level; Phase 5 held-out test measures this honestly |
| Too many false positives on benign alerts | `OFFICIAL_CHANNEL_ADVICE` negative signal; dev-split tuning in Phase 5 |
| Amount parsing edge cases | Cap at 10,000,000 cents; fall back to `ctx.amountCents` |

## Time budget
4 h (9%). Cut first: leetspeak normalisation, word-number parsing beyond "hundred/thousand".

## Handoff
Phase 3 can assume: `evaluate()` exists with the signature above and is pure; fixtures exist for reuse. Tag `phase-2-done` (commit `feat(engine): deterministic risk engine with tests`).
