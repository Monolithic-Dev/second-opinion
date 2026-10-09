# Detector results on dev (30 scripts)

Engine `b4698a0` · bench `c2f7b1c` · live rule set `rules-2026.10.3`

## Ablation: what each layer adds

| Rule set | Layers | Recall @ hold | FPR @ hold | Recall @ flag | FPR @ flag |
|---|---|---|---|---|---|
| `rules-2026.10.1` | rules | 46.7% | 0.0% | 80.0% | 6.7% |
| `rules-2026.10.2` | rules + playbooks + behavior | 66.7% | 0.0% | 86.7% | 6.7% |
| `rules-2026.10.3` (live) | rules + playbooks + behavior | 86.7% | 0.0% | 93.3% | 6.7% |

_The behavior layer needs household history, which a stand-alone script does not have, so it is not part of this measurement._

### `rules-2026.10.1` on dev (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 46.7% | 100.0% | 63.6% | 0.0% | 7 / 0 / 15 / 8 |
| flag (hold or caution) | 80.0% | 92.3% | 85.7% | 6.7% | 12 / 1 / 14 / 3 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- government_impersonation: 2 / 2 / 2
- wire_crypto: 1 / 2 / 2
- verification_code: 0 / 0 / 1
- tech_support_remote: 1 / 2 / 2
- family_emergency: 1 / 2 / 3
- prize_lottery: 0 / 1 / 1
- delivery_fee: 0 / 0 / 1
- romance_investment: 1 / 1 / 1
- bank_impersonation: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| d-004 | scam | verification_code | easy | allow | missed scam |
| d-007 | scam | prize_lottery | easy | caution | only flagged, not held |
| d-008 | scam | delivery_fee | tricky | allow | missed scam |
| d-011 | scam | family_emergency | tricky | allow | missed scam |
| d-012 | scam | family_emergency | tricky | caution | only flagged, not held |
| d-013 | scam | tech_support_remote | easy | caution | only flagged, not held |
| d-014 | scam | bank_impersonation | tricky | caution | only flagged, not held |
| d-015 | scam | wire_crypto | easy | caution | only flagged, not held |
| d-028 | benign | family_chat | tricky | caution | false flag |

### `rules-2026.10.2` on dev (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 66.7% | 100.0% | 80.0% | 0.0% | 10 / 0 / 15 / 5 |
| flag (hold or caution) | 86.7% | 92.9% | 89.7% | 6.7% | 13 / 1 / 14 / 2 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- government_impersonation: 2 / 2 / 2
- wire_crypto: 1 / 2 / 2
- verification_code: 0 / 1 / 1
- tech_support_remote: 2 / 2 / 2
- family_emergency: 2 / 2 / 3
- prize_lottery: 1 / 1 / 1
- delivery_fee: 0 / 0 / 1
- romance_investment: 1 / 1 / 1
- bank_impersonation: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| d-004 | scam | verification_code | easy | caution | only flagged, not held |
| d-008 | scam | delivery_fee | tricky | allow | missed scam |
| d-011 | scam | family_emergency | tricky | allow | missed scam |
| d-014 | scam | bank_impersonation | tricky | caution | only flagged, not held |
| d-015 | scam | wire_crypto | easy | caution | only flagged, not held |
| d-028 | benign | family_chat | tricky | caution | false flag |

### `rules-2026.10.3` on dev (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 86.7% | 100.0% | 92.9% | 0.0% | 13 / 0 / 15 / 2 |
| flag (hold or caution) | 93.3% | 93.3% | 93.3% | 6.7% | 14 / 1 / 14 / 1 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- government_impersonation: 2 / 2 / 2
- wire_crypto: 2 / 2 / 2
- verification_code: 1 / 1 / 1
- tech_support_remote: 2 / 2 / 2
- family_emergency: 2 / 3 / 3
- prize_lottery: 1 / 1 / 1
- delivery_fee: 0 / 0 / 1
- romance_investment: 1 / 1 / 1
- bank_impersonation: 1 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| d-008 | scam | delivery_fee | tricky | allow | missed scam |
| d-011 | scam | family_emergency | tricky | caution | only flagged, not held |
| d-028 | benign | family_chat | tricky | caution | false flag |

