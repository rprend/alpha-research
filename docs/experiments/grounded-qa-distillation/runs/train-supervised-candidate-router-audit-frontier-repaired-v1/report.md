# Train-Supervised Candidate Router Audit

Generated: 2026-06-29T03:43:32.349Z

Status: `train_supervised_router_beats_scaffold`

This router is trained only on repaired train-tune rows and evaluated on heldout train plus repaired validation.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | 90/160 (56.3%) | 64.4% | 86.9% |
| Train heldout | 32/63 (50.8%) | 60.3% | 88.9% |
| Repaired validation | 47/70 (67.1%) | 72.9% | 94.3% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Train-selected constrained policy: 41/70
- Learned repaired selector: 41/70
- Three-system validation oracle: 54/70
- Train-supervised router: 47/70
- Delta vs scaffold: 3
- Delta vs three-system oracle: -7

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as policy: no
- Next step: Freeze this as a candidate for a fresh heldout router test before any paid judge or Prime launch.
