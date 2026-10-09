# Detector results on test (30 scripts)

Engine `b4698a0` · bench `c2f7b1c` · live rule set `rules-2026.10.3`

## Ablation: what each layer adds

| Rule set | Layers | Recall @ hold | FPR @ hold | Recall @ flag | FPR @ flag |
|---|---|---|---|---|---|
| `rules-2026.10.1` | rules | 33.3% | 0.0% | 66.7% | 6.7% |
| `rules-2026.10.2` | rules + playbooks + behavior | 46.7% | 0.0% | 73.3% | 6.7% |
| `rules-2026.10.3` (live) | rules + playbooks + behavior | 46.7% | 0.0% | 80.0% | 6.7% |

_The behavior layer needs household history, which a stand-alone script does not have, so it is not part of this measurement._

### `rules-2026.10.1` on test (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 33.3% | 100.0% | 50.0% | 0.0% | 5 / 0 / 15 / 10 |
| flag (hold or caution) | 66.7% | 90.9% | 76.9% | 6.7% | 10 / 1 / 14 / 5 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 2 / 2
- bank_impersonation: 0 / 0 / 1
- verification_code: 0 / 0 / 1
- tech_support_remote: 1 / 1 / 1
- government_impersonation: 0 / 1 / 2
- prize_lottery: 1 / 1 / 2
- romance_investment: 1 / 2 / 2
- wire_crypto: 0 / 1 / 1
- delivery_fee: 1 / 1 / 2
- family_emergency: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| t-002 | scam | bank_impersonation | easy | allow | missed scam |
| t-003 | scam | verification_code | easy | allow | missed scam |
| t-005 | scam | government_impersonation | tricky | allow | missed scam |
| t-008 | scam | wire_crypto | easy | caution | only flagged, not held |
| t-009 | scam | delivery_fee | tricky | allow | missed scam |
| t-010 | scam | family_emergency | tricky | caution | only flagged, not held |
| t-011 | scam | romance_investment | tricky | caution | only flagged, not held |
| t-013 | scam | gift_card | tricky | caution | only flagged, not held |
| t-014 | scam | government_impersonation | tricky | caution | only flagged, not held |
| t-015 | scam | prize_lottery | tricky | allow | missed scam |
| t-024 | benign | family_chat | tricky | caution | false flag |

### `rules-2026.10.2` on test (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 46.7% | 100.0% | 63.6% | 0.0% | 7 / 0 / 15 / 8 |
| flag (hold or caution) | 73.3% | 91.7% | 81.5% | 6.7% | 11 / 1 / 14 / 4 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 2 / 2
- bank_impersonation: 0 / 0 / 1
- verification_code: 0 / 0 / 1
- tech_support_remote: 1 / 1 / 1
- government_impersonation: 1 / 2 / 2
- prize_lottery: 1 / 1 / 2
- romance_investment: 1 / 2 / 2
- wire_crypto: 1 / 1 / 1
- delivery_fee: 1 / 1 / 2
- family_emergency: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| t-002 | scam | bank_impersonation | easy | allow | missed scam |
| t-003 | scam | verification_code | easy | allow | missed scam |
| t-005 | scam | government_impersonation | tricky | caution | only flagged, not held |
| t-009 | scam | delivery_fee | tricky | allow | missed scam |
| t-010 | scam | family_emergency | tricky | caution | only flagged, not held |
| t-011 | scam | romance_investment | tricky | caution | only flagged, not held |
| t-013 | scam | gift_card | tricky | caution | only flagged, not held |
| t-015 | scam | prize_lottery | tricky | allow | missed scam |
| t-024 | benign | family_chat | tricky | caution | false flag |

### `rules-2026.10.3` on test (30 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 46.7% | 100.0% | 63.6% | 0.0% | 7 / 0 / 15 / 8 |
| flag (hold or caution) | 80.0% | 92.3% | 85.7% | 6.7% | 12 / 1 / 14 / 3 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 2 / 2
- bank_impersonation: 0 / 0 / 1
- verification_code: 0 / 0 / 1
- tech_support_remote: 1 / 1 / 1
- government_impersonation: 1 / 2 / 2
- prize_lottery: 1 / 2 / 2
- romance_investment: 1 / 2 / 2
- wire_crypto: 1 / 1 / 1
- delivery_fee: 1 / 1 / 2
- family_emergency: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| t-002 | scam | bank_impersonation | easy | allow | missed scam |
| t-003 | scam | verification_code | easy | allow | missed scam |
| t-005 | scam | government_impersonation | tricky | caution | only flagged, not held |
| t-009 | scam | delivery_fee | tricky | allow | missed scam |
| t-010 | scam | family_emergency | tricky | caution | only flagged, not held |
| t-011 | scam | romance_investment | tricky | caution | only flagged, not held |
| t-013 | scam | gift_card | tricky | caution | only flagged, not held |
| t-015 | scam | prize_lottery | tricky | caution | only flagged, not held |
| t-024 | benign | family_chat | tricky | caution | false flag |

