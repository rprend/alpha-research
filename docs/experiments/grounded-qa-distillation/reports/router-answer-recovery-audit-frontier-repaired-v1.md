# Router Answer Recovery Audit

Generated: 2026-06-29T03:57:55.585Z

Status: `answer_recovery_overlay_rejected_no_switch_selected`

## Selected Policy

- Minimum answer probability: 0.1
- Maximum selected-minus-answer probability gap: -0.2

## Metrics

| Split | Contract Correct | Grounded Correct | Abstain Correct | Switched |
| --- | ---: | ---: | ---: | ---: |
| Train heldout | 32/63 (50.8%) | 11.8% | 96.6% | 0 |
| Repaired validation | 47/70 (67.1%) | 25.8% | 100.0% | 0 |

## Baseline Comparison

- Source router: 47/70
- Recovery overlay: 47/70
- Delta vs source router: 0
- Delta vs train-calibrated scaffold: 3

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote recovery overlay: no
- Next step: Do not add a recovery overlay. Improve grounded-answer candidate construction or train richer target-completeness supervision instead.
