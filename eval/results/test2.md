# Detector results on test2 (40 scripts)

Engine `6388ce5` · bench `79552af` · live rule set `rules-2026.10.3`

## Ablation: what each layer adds

| Rule set | Layers | Recall @ hold | FPR @ hold | Recall @ flag | FPR @ flag |
|---|---|---|---|---|---|
| `rules-2026.10.1` | rules | 15.0% | 0.0% | 70.0% | 10.0% |
| `rules-2026.10.2` | rules + playbooks + behavior | 30.0% | 0.0% | 70.0% | 10.0% |
| `rules-2026.10.3` (live) | rules + playbooks + behavior | 30.0% | 0.0% | 70.0% | 10.0% |

_The behavior layer needs household history, which a stand-alone script does not have, so it is not part of this measurement._

### `rules-2026.10.1` on test2 (40 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 15.0% | 100.0% | 26.1% | 0.0% | 3 / 0 / 20 / 17 |
| flag (hold or caution) | 70.0% | 87.5% | 77.8% | 10.0% | 14 / 2 / 18 / 6 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- family_emergency: 0 / 3 / 4
- bank_impersonation: 1 / 1 / 1
- verification_code: 0 / 0 / 2
- government_impersonation: 1 / 3 / 3
- tech_support_remote: 0 / 1 / 2
- prize_lottery: 0 / 0 / 2
- delivery_fee: 0 / 1 / 1
- wire_crypto: 0 / 3 / 3
- romance_investment: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| u-002 | scam | family_emergency | tricky | allow | missed scam |
| u-004 | scam | verification_code | tricky | allow | missed scam |
| u-005 | scam | government_impersonation | easy | caution | only flagged, not held |
| u-006 | scam | government_impersonation | tricky | caution | only flagged, not held |
| u-007 | scam | tech_support_remote | tricky | allow | missed scam |
| u-008 | scam | tech_support_remote | easy | caution | only flagged, not held |
| u-009 | scam | family_emergency | easy | caution | only flagged, not held |
| u-010 | scam | family_emergency | tricky | caution | only flagged, not held |
| u-011 | scam | prize_lottery | easy | allow | missed scam |
| u-012 | scam | prize_lottery | tricky | allow | missed scam |
| u-013 | scam | verification_code | tricky | allow | missed scam |
| u-014 | scam | delivery_fee | easy | caution | only flagged, not held |
| u-015 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-016 | scam | romance_investment | tricky | caution | only flagged, not held |
| u-017 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-019 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-020 | scam | family_emergency | easy | caution | only flagged, not held |
| u-032 | benign | family_chat | tricky | caution | false flag |
| u-040 | benign | delivery_genuine | tricky | caution | false flag |

### `rules-2026.10.2` on test2 (40 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 30.0% | 100.0% | 46.2% | 0.0% | 6 / 0 / 20 / 14 |
| flag (hold or caution) | 70.0% | 87.5% | 77.8% | 10.0% | 14 / 2 / 18 / 6 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- family_emergency: 2 / 3 / 4
- bank_impersonation: 1 / 1 / 1
- verification_code: 0 / 0 / 2
- government_impersonation: 2 / 3 / 3
- tech_support_remote: 0 / 1 / 2
- prize_lottery: 0 / 0 / 2
- delivery_fee: 0 / 1 / 1
- wire_crypto: 0 / 3 / 3
- romance_investment: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| u-002 | scam | family_emergency | tricky | allow | missed scam |
| u-004 | scam | verification_code | tricky | allow | missed scam |
| u-006 | scam | government_impersonation | tricky | caution | only flagged, not held |
| u-007 | scam | tech_support_remote | tricky | allow | missed scam |
| u-008 | scam | tech_support_remote | easy | caution | only flagged, not held |
| u-009 | scam | family_emergency | easy | caution | only flagged, not held |
| u-011 | scam | prize_lottery | easy | allow | missed scam |
| u-012 | scam | prize_lottery | tricky | allow | missed scam |
| u-013 | scam | verification_code | tricky | allow | missed scam |
| u-014 | scam | delivery_fee | easy | caution | only flagged, not held |
| u-015 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-016 | scam | romance_investment | tricky | caution | only flagged, not held |
| u-017 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-019 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-032 | benign | family_chat | tricky | caution | false flag |
| u-040 | benign | delivery_genuine | tricky | caution | false flag |

### `rules-2026.10.3` on test2 (40 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 30.0% | 100.0% | 46.2% | 0.0% | 6 / 0 / 20 / 14 |
| flag (hold or caution) | 70.0% | 87.5% | 77.8% | 10.0% | 14 / 2 / 18 / 6 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- family_emergency: 2 / 3 / 4
- bank_impersonation: 1 / 1 / 1
- verification_code: 0 / 0 / 2
- government_impersonation: 2 / 3 / 3
- tech_support_remote: 0 / 1 / 2
- prize_lottery: 0 / 0 / 2
- delivery_fee: 0 / 1 / 1
- wire_crypto: 0 / 3 / 3
- romance_investment: 0 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| u-002 | scam | family_emergency | tricky | allow | missed scam |
| u-004 | scam | verification_code | tricky | allow | missed scam |
| u-006 | scam | government_impersonation | tricky | caution | only flagged, not held |
| u-007 | scam | tech_support_remote | tricky | allow | missed scam |
| u-008 | scam | tech_support_remote | easy | caution | only flagged, not held |
| u-009 | scam | family_emergency | easy | caution | only flagged, not held |
| u-011 | scam | prize_lottery | easy | allow | missed scam |
| u-012 | scam | prize_lottery | tricky | allow | missed scam |
| u-013 | scam | verification_code | tricky | allow | missed scam |
| u-014 | scam | delivery_fee | easy | caution | only flagged, not held |
| u-015 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-016 | scam | romance_investment | tricky | caution | only flagged, not held |
| u-017 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-019 | scam | wire_crypto | tricky | caution | only flagged, not held |
| u-032 | benign | family_chat | tricky | caution | false flag |
| u-040 | benign | delivery_genuine | tricky | caution | false flag |

