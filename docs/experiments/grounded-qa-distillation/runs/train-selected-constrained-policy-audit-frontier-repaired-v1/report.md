# Train-Selected Constrained Policy Audit

Generated: 2026-06-29T03:16:15.852Z

Status: `train_selected_constrained_policy_does_not_beat_existing_validation_baselines`

## Metrics

| Split | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
| Train tune | 41/160 | 85/160 (53.1%) | 60.0% | 81.9% |
| Train heldout | 20/63 | 29/63 (46.0%) | 58.7% | 77.8% |
| Repaired validation | 21/70 | 41/70 (58.6%) | 71.4% | 80.0% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Constrained Qwen/scaffold hybrid: 45/70
- Selected policy: 41/70
- Delta vs scaffold: -3
- Delta vs hybrid: -4

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as final scaffold: no
- Next step: Do not spend on judging or GPU. The constrained train-selected policy is not yet stronger than existing validation baselines.
