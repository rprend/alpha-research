# Train-Supervised Evidence Constructor Audit

Generated: 2026-06-29T04:18:25.207Z

Status: `evidence_constructor_does_not_beat_scaffold`

This audit makes no OpenAI calls and launches no Prime job. It trains a local evidence citation selector on repaired train-tune rows, selects constructor thresholds on repaired train-heldout rows, and reports transfer on repaired validation.

## Selected Policy

- Policy: answer_0p54_cite_0p34_k_3_margin_0p08
- Train heldout: 31/63 (49.2%)
- Repaired validation: 43/70 (61.4%)

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact | Grounded Targets | Abstain Targets |
| --- | ---: | ---: | ---: | ---: | ---: |
| Train tune | 91/160 | 64.4% | 85.6% | 11/69 | 80/91 |
| Train heldout | 31/63 | 55.6% | 88.9% | 5/34 | 26/29 |
| Repaired validation | 43/70 | 65.7% | 90.0% | 8/31 | 35/39 |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Train-supervised router: 47/70
- Evidence constructor: 43/70
- Delta vs scaffold: -1
- Delta vs router: -4

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as candidate system: no
- Reason: The train-supervised evidence constructor does not clear the scaffold baseline.
- Next step: Do not add this constructor as a new candidate system; move to richer supervision or targeted generation for grounded-answer candidates.
