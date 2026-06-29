# Train-Supervised NLI Router Audit

Generated: 2026-06-29T03:51:07.711Z

Status: `train_supervised_nli_router_beats_scaffold_not_router`

This router is trained only on repaired train-tune rows, with local open-weight NLI features, and evaluated on heldout train plus repaired validation.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | 90/160 (56.3%) | 64.4% | 86.9% |
| Train heldout | 32/63 (50.8%) | 60.3% | 88.9% |
| Repaired validation | 47/70 (67.1%) | 72.9% | 94.3% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Non-NLI train-supervised router: 47/70
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
- Next step: Keep the NLI features as an ablation, but the non-NLI router remains the stronger candidate unless a fresh split reverses this.
