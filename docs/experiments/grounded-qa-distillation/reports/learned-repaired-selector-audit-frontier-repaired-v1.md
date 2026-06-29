# Learned Repaired Selector Audit

Generated: 2026-06-29T03:24:44.817Z

Status: `learned_repaired_selector_does_not_beat_existing_validation_baselines`

## Metrics

| Split | Answered | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: | ---: |
| Train tune | 51/160 | 96/160 (60.0%) | 73.8% | 78.8% |
| Train heldout | 22/63 | 30/63 (47.6%) | 65.1% | 74.6% |
| Repaired validation | 22/70 | 41/70 (58.6%) | 70.0% | 80.0% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Constrained Qwen/scaffold hybrid: 45/70
- Train-selected constrained policy: 41/70
- Learned repaired selector: 41/70
- Delta vs scaffold: -3
- Delta vs hybrid: -4
- Delta vs train-selected constrained policy: 0

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as final scaffold: no
- Next step: Do not spend on paid judging or Prime. The local learned selector is not stronger than the current zero-spend validation baselines.
