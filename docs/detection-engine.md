# Detection engine (replaces a generic "ai-pipeline")

**Principle:** fixed rules decide; AI only phrases or *suggests known signals*. Deterministic, explainable, measurable, zero-network by default.

## 1. Input / output
`detectSignals(text, ctx) → Signal[]`, `score(signals) → {score, verdict, hardRule?}`, `fingerprint(signals) → string`, `explain(result) → {spokenSummary, card}`.
Types (`engine/types.ts`):
```ts
type SignalId = 'GIFT_CARD'|'WIRE_OR_CRYPTO'|'REMOTE_ACCESS'|'VERIFICATION_CODE'|'FAMILY_EMERGENCY'|'PRIZE_OR_LOTTERY'
 |'AUTHORITY_IMPERSONATION'|'SECRECY'|'URGENCY'|'UNSOLICITED_CONTACT'|'NEW_PAYEE'|'HIGH_AMOUNT'
 |'TRUSTED_PAYEE'|'OFFICIAL_CHANNEL_ADVICE';
interface Signal { id: SignalId; weight: number; evidence: string }
type Verdict = 'allow'|'caution'|'hold';
interface Context { channel?: string; actionType?: 'purchase'|'payment'|'transfer'|'none'; amountCents?: number; payee?: string; trustedPayees?: string[] }
```

## 2. Signals and weights
| Signal | Weight | Detects (case-insensitive; regex lists live in `signals.ts`) |
|---|---|---|
| GIFT_CARD | 45 | gift card(s), itunes/google play/steam card, prepaid card, scratch/read me the numbers |
| WIRE_OR_CRYPTO | 40 | wire transfer, western union, moneygram, bitcoin/crypto/ATM deposit, zelle to a stranger |
| REMOTE_ACCESS | 40 | anydesk, teamviewer, "let me connect to your computer", "install this app" |
| VERIFICATION_CODE | 35 | "read me the code", one-time passcode/OTP, "6-digit code" sent to you |
| FAMILY_EMERGENCY | 30 | grandchild/relative in jail/accident, "don't tell mom", bail |
| PRIZE_OR_LOTTERY | 30 | you won, sweepstakes, "pay a fee to claim" |
| AUTHORITY_IMPERSONATION | 25 | bank/IRS/SSA/Medicare/police/Amazon support/"fraud department" + a demand to act |
| SECRECY | 25 | don't tell anyone, keep this between us, don't hang up |
| URGENCY | 20 | today, right now, immediately, within the hour, last chance, arrest/suspended |
| NEW_PAYEE | 15 | `ctx.payee` not in trusted list and actionType ≠ none |
| HIGH_AMOUNT | 15 | `amountCents ≥ 50000` ($500) or amount parsed from text ≥ $500 |
| UNSOLICITED_CONTACT | 10 | "I'm calling from", "we noticed", "your account has been" with no prior request |
| TRUSTED_PAYEE | −40 | `ctx.payee` matches household trusted list (normalised) |
| OFFICIAL_CHANNEL_ADVICE | −25 | text itself says call the number on your card / never share your code / log in via the official app (typical of *genuine* bank alerts) |

## 3. Scoring and verdict
`score = clamp(Σ weights, 0, 100)`.
- `score ≥ 60` → **hold**; `30 ≤ score < 60` → **caution**; `< 30` → **allow**.
- **Hard rules** (applied after score; can only raise severity):
  - `GIFT_CARD_PLUS_ANY`: GIFT_CARD with ≥1 other positive signal ⇒ hold.
  - `REMOTE_ACCESS_PLUS_AUTHORITY`: REMOTE_ACCESS + AUTHORITY_IMPERSONATION ⇒ hold.
  - `CODE_PLUS_UNSOLICITED`: VERIFICATION_CODE + UNSOLICITED_CONTACT ⇒ hold.
- Negative signals never override a hard rule.
- Worked example: "bank says I must buy 5 $200 gift cards today" → 45+25+20+15 = 105 → clamp 100 → hold.
- Tricky benign: "Your card was used at a store. If this wasn't you call the number on the back of your card. We will never ask for your PIN." → AUTHORITY 25 + UNSOLICITED 10 − OFFICIAL_CHANNEL_ADVICE 25 = 10 → allow.

## 4. Fingerprint & memory
`fingerprint = sorted positive signal ids joined by '|'`. On each check, load the household's fingerprints; `similarTo` = best match with Jaccard ≥ 0.75 on signal-id sets, returning the prior `checkId`, date and `holdId?`. Update `fingerprints` after scoring.

## 5. Explanation
`explain()` is template-based (`flags[]` from signal ids → plain phrases, e.g. GIFT_CARD → "Asks for gift cards"). Spoken summary ≤ 25 words, grade-6 reading level, never blames the elder.

## 6. Optional AI layer (`AGENT_MODE=bedrock` / `eval` variant `rules+ai`)
- Amazon Bedrock **Converse** API, model from `BEDROCK_MODEL_ID` (small, cheap model).
- Two uses: (a) rephrase `spokenSummary` warmly; (b) *suggest signals*: model returns JSON `{"signals":["URGENCY","SECRECY"]}` restricted to the `SignalId` enum; engine **unions** them (weight from table, evidence "model"), invalid ids dropped. The model can never set the verdict.
- Cache: response keyed by `sha256(model+prompt+text)` in `eval/cache/` and `.cache/llm/`; eval re-runs read the cache so results are reproducible without AWS.
- Fallback: any error/timeout (>3 s) ⇒ use rules-only silently, log `llm.fallback`.
- Cost budget: ≤ 60 eval calls × 2 variants + demo; target < $1 total.

## 7. Evaluation
- Data: `scam-script-bench` (`dev` 30 for building rules, `test` 30 frozen; different authors).
- Operating points: **hold** (verdict=hold) and **flag** (hold or caution).
- Metrics: precision, recall, F1, false-positive rate, confusion matrix, per-category recall, list of misclassified ids.
- Variants: `rules`, `rules+ai`. One headline number: **test-split scam recall at hold** with **benign FPR at hold** beside it.
- Rule: no rule changes after the first `test` run; if we must change, log it in `decisions.md` and report both numbers.

## 8. When it is wrong
False negative (scam allowed): the money never moves without the elder asking; the payee/new-payee and amount signals still add friction; surface "I'm not sure" at `caution`. False positive (benign held): family approves in one tap; trusted payees reduce repeats. Both are shown honestly in the failure table.

## 9. Layered pipeline (Tier 1, `packages/engine`)
| Layer | File | Adds | Cap |
|---|---|---|---|
| L1 Rules | `layers/rules.ts` | Signals in §2, hard rules | to 100 |
| L2 Playbooks | `layers/playbooks.ts` | `PLAYBOOK_MATCH` = `round(30 × sim)` when BM25 similarity ≥ 0.5 against ~20 invented scam playbooks (`src/playbooks/*.json`) | 30 |
| L3 Behavior | `layers/behavior.ts` | `AMOUNT_ANOMALY` (+20), `PAYEE_VELOCITY` (+15), `QUIET_HOURS` (+10), `RETRY_AFTER_DENY` (+30) from household history | 40 |
| L4 LLM (optional) | `layers/llm.ts` | Suggested ids from the `SignalId` enum, cached | 20 |
| Fusion | `layers/fusion.ts` | Sum with caps, clamp 0–100, thresholds 60/30, hard rules kept, `layerBreakdown` + `reasons[]` | — |
**As built (B2, rule set `rules-2026.10.2`):**
- L2 is idf-weighted **keyword coverage** (not full BM25): `similarity = Σ idf(matched keywords) / Σ idf(all keywords)` over the playbook's own phrases, stop-word filtered, simple plural stemming. Fires when `similarity ≥ 0.30` **and** ≥ 3 distinct keywords match; `weight = min(30, round(60 × similarity))`. Measured on the fixtures: scams 0.31–0.64, benign ≤ 0.16. Known limit: a polite scam with no scam vocabulary ("send $900 to my cousin") is not caught by L2.
- L3 needs `options.now`; without it the behavior layer is skipped so `evaluate` stays pure. Payments and denied holds come from the store (`payments.recent`, `holds.deniedSince`); the household timezone is `America/Chicago` until the policy engine (B4) makes it per-household.
- Fusion floors each layer's contribution at 0 (a trusted payee cannot cancel risk found by another layer) and caps playbooks at 30 and behavior at 40.
- `registry.ts` keeps every rule-set version (`rules-2026.10.1` rules only, `rules-2026.10.2` all layers). `evaluate(..., {ruleSet})` runs any version; `evaluateWithShadow` runs a candidate beside the live set and reports disagreement (backtest CLI is B3).
- `check_message` returns `layerBreakdown` and `playbook`; decisions store the breakdown for replay.

New `SignalId`s: `PLAYBOOK_MATCH`, `AMOUNT_ANOMALY`, `PAYEE_VELOCITY`, `QUIET_HOURS`, `RETRY_AFTER_DENY`. Defaults enable L1–L3; every layer can be switched off (`options.layers`) for ablation and demo safety. All layers are deterministic and pure; L2 is lexical (BM25), **no embeddings or training**.
Ablation protocol: report L1, L1+L2, L1+L2+L3, +L4 on the same split; headline remains test recall/FPR at *hold* for the default pipeline. Weights frozen at G2.
