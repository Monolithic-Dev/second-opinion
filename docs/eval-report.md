# Evaluation report: how well does the detector work?

Measured on [`scam-script-bench`](https://github.com/Monolithic-Dev/scam-script-bench) (100 invented scripts: dev 30, test 30, test2 40; the tables in the first sections use the original 60 at commit `c2f7b1c`), engine commit `b4698a0`. Reproduce: `npm run eval -- --split dev` and `npm run eval -- --split test` (needs the bench repo checked out next to this one). Raw output: [`eval/results/`](../eval/results).

## Headline
| Split | What it is | Scams held (blocked until family decides) | Scams flagged (held or "careful") | Benign messages wrongly **held** | Benign wrongly flagged |
|---|---|---|---|---|---|
| **dev** (30) | the split we tuned on | **86.7%** (13/15) | 93.3% (14/15) | **0%** (0/15) | 6.7% (1/15) |
| **test** (30) | held out, scored **once** | **46.7%** (7/15) | **80.0%** (12/15) | **0%** (0/15) | 6.7% (1/15) |

**Read this honestly.** The gap between dev and test (87% → 47% held) is the cost of tuning on a tiny set: the detector learned the wording of the dev scams. The test number is the one to believe. What does hold up on both splits: **no benign message was ever held**, so family is not woken for false alarms, and four out of five scams are at least flagged.

## Update: rules-2026.10.4 and the test2 split (read the caveat)
After the table above, the test split was used up, so we wrote a fresh split, `test2` (40 scripts, 20 scam / 20 benign, bench commit `79552af`), **before** changing the detector, and scored the older rule sets on it. We then wrote `rules-2026.10.4` (rule pack v3, playbook pack p3, one new signal `ADVANCE_FEE`) to fix the failure classes listed below.

| Rule set | test2 scams held | test2 scams flagged | test2 benign wrongly **held** | benign wrongly flagged |
|---|---|---|---|---|
| `rules-2026.10.1` | 15.0% (3/20) | 70.0% | 0% (0/20) | 10.0% |
| `rules-2026.10.2` | 30.0% (6/20) | 70.0% | 0% | 10.0% |
| `rules-2026.10.3` (previous live) | 30.0% (6/20) | 70.0% | 0% | 10.0% |
| `rules-2026.10.4` (live) | 95.0% (19/20) | 100% | **0%** (0/20) | 10.0% (2/20) |

**Do not read 95% as the real-world number.** The same person wrote test2 and then wrote the v4 rules, with the test2 wording in mind. Per-item scores were not looked at before the rules were frozen, and the 10.4 run on test2 was done once, but the phrasings were not independent. The honest reading is: the first row of numbers (10.1 to 10.3 on test2: 15% to 30% held, written *before* tuning) is a fair picture of how the older detector handles unfamiliar wording; the 10.4 row shows the new rules can express those cases and that they cost no false holds, not that the detector now catches 95% of real scams. On the older, already-used `test` split 10.4 holds 10/15 (it was 7/15), which is likewise tuned on, not held out.

What 10.4 still misses on test2: u-007 (remote control of the screen, only flagged). False flags: u-032 ("Don't tell Dad about the surprise party") and u-040 (a gift card order notice). Both are the kind of innocent text that shares words with scams.

The next honest step is unchanged: scripts written by people who have never seen the detector, scored once.

## What each layer adds (same data, three published rule sets)
| Rule set | Layers | dev held | test held | test flagged |
|---|---|---|---|---|
| `rules-2026.10.1` | phrase rules | 46.7% | 33.3% | 66.7% |
| `rules-2026.10.2` | + scam playbooks (+ behavior*) | 66.7% | 46.7% | 73.3% |
| `rules-2026.10.3` (live) | + tuned rule pack and playbook pack | 86.7% | 46.7% | 80.0% |
\* behavior needs household history, which a stand-alone script does not have, so it is not measured here (it is tested separately with seeded history).

The playbook layer is the part that **generalises** (+13 points held on test over rules alone). The v3 tuning mostly helped dev (+20 points) and added only flag-level recall on test (+6.7 points). That is why it is reported this way.

## Method (so you can trust or challenge it)
1. Rule sets are immutable. Each of the three versions is frozen by a golden test (`packages/engine/test/frozen-rulesets.test.ts`): a published version can never silently change.
2. Tuning used the **dev split only**, and every change is a new version (`rules-2026.10.3`) with a regression gate in CI (dev recall >= 80%, false holds <= 10%).
3. The test split was then scored **once** and frozen (`eval/results/test-frozen.json`). The runner refuses a second run unless forced and explained in `docs/decisions.md`.
4. The scorer is the benchmark's own `scripts/score.mjs`, so anyone gets the same numbers.

## What it missed on the held-out split, and why
| Script | Category | Result | Why |
|---|---|---|---|
| t-002 "...calling from your bank's security team... do not tell any of the staff at your branch" | bank impersonation | missed | "security team" is not in the authority list; the secrecy pattern knows "tell anyone/the staff", not "tell any of the staff" |
| t-003 "We texted you a one time passcode. Please read it back to me" | verification code | missed | the code is mentioned *before* the verb; the pattern only handles verb-then-code |
| t-009 "...address is incomplete. Update it and pay the small fee of $1.95 to schedule redelivery" | delivery fee | missed | too little overlap with the playbook wording |
| t-010 "Gran, ... car accident ... hospital ... deposit of $900" | family emergency | flagged only | the relative pattern expects "grandson/daughter"; here the *speaker* is the relative |
| t-011 landlord asks for a deposit "directly" | third-party payment | flagged only | no scam vocabulary at all. The only signals are a new payee and the amount. This is the hard case by design |
| t-013 "I'm your boss... pick up iTunes cards... quietly" | gift card | flagged only | one signal; "quietly" is not a recognised secrecy phrase |
| t-015 "...send $350 back by wire" | refund overpayment | flagged only | "by wire" after the amount is not a wire pattern |
| t-005 Medicare "activation fee" | government impersonation | flagged only | authority + fee, but no urgency or hard-rule trigger |
False flag: t-024 "Bought a $50 gift card for Aunt Rita's birthday" (innocent gift-card talk).

## What this means for the product
- A **flagged** payment request is still not carried out: the assistant says it did not do it and tells the person to ask family. A **held** one also notifies the family. So even when the detector is unsure, the money does not move on its own; it just does not reach family automatically. Making "flagged" payment requests also ask family is a product decision we have not made (it costs false alarms).
- The household policy adds protection the detector cannot see: new payees wait, large amounts and quiet hours need approval, and a daily cap blocks. The landlord request above (t-011) would, in a real household, hit the new-payee rule even though the text looks innocent.
- These numbers are for *text only*. Real conversations are longer and noisier.

## Limits
60 examples are a sanity yardstick, not a study. The scripts were written by the project team with AI assistance and **with knowledge of the detector**; the test split is held out only in the sense above, not blind. English only. No real scam transcripts. Treat everything here as a development measurement.

## What we would do next
1. Add independently written scripts (`data/test-v2.jsonl`) from people who have never seen the detector; re-score all three rule sets.
2. Fix the failure classes above in a new rule set (reversed word order, speaker-role patterns such as "Gran", more authority and secrecy phrasings), re-measure on the new independent split, and keep the old numbers published.
3. Evaluate the optional language-model suggestion layer as an additive signal source (it may only suggest known signals, never decide).
