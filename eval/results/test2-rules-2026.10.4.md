# Detector results on test2 (40 scripts)

Engine `6388ce5` · bench `79552af` · live rule set `rules-2026.10.4`

## Ablation: what each layer adds

| Rule set | Layers | Recall @ hold | FPR @ hold | Recall @ flag | FPR @ flag |
|---|---|---|---|---|---|
| `rules-2026.10.4` (live) | rules + playbooks + behavior | 95.0% | 0.0% | 100.0% | 10.0% |

_The behavior layer needs household history, which a stand-alone script does not have, so it is not part of this measurement._

### `rules-2026.10.4` on test2 (40 scripts)

| Operating point | Scam recall | Precision | F1 | Benign false-positive rate | TP / FP / TN / FN |
|---|---|---|---|---|---|
| hold (blocks the action) | 95.0% | 100.0% | 97.4% | 0.0% | 19 / 0 / 20 / 1 |
| flag (hold or caution) | 100.0% | 90.9% | 95.2% | 10.0% | 20 / 2 / 18 / 0 |

**Recall by scam category** (held / flagged / total)

- gift_card: 1 / 1 / 1
- family_emergency: 4 / 4 / 4
- bank_impersonation: 1 / 1 / 1
- verification_code: 2 / 2 / 2
- government_impersonation: 3 / 3 / 3
- tech_support_remote: 1 / 2 / 2
- prize_lottery: 2 / 2 / 2
- delivery_fee: 1 / 1 / 1
- wire_crypto: 3 / 3 / 3
- romance_investment: 1 / 1 / 1

**Misclassified**

| id | label | category | difficulty | verdict | error |
|---|---|---|---|---|---|
| u-007 | scam | tech_support_remote | tricky | caution | only flagged, not held |
| u-032 | benign | family_chat | tricky | caution | false flag |
| u-040 | benign | delivery_genuine | tricky | caution | false flag |

