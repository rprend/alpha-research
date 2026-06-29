# Train-Supervised Candidate Router Audit

Generated: 2026-06-29T06:55:47.129Z

Status: `qwen_surface_router_does_not_beat_prior_router`

This router is trained only on repaired train-tune rows and evaluated on heldout train plus repaired validation.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | 96/160 (60.0%) | 66.3% | 83.1% |
| Train heldout | 28/63 (44.4%) | 50.8% | 84.1% |
| Repaired validation | 38/70 (54.3%) | 68.6% | 72.9% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Train-selected constrained policy: 41/70
- Learned repaired selector: 41/70
- Three-system validation oracle: 58/70
- Train-supervised router: 38/70
- Delta vs scaffold: -6
- Delta vs three-system oracle: -20

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as policy: no
- Next step: Do not promote the Qwen-surface router or buy judgments. The new surface increases oracle headroom but the current shallow router cannot exploit it; inspect Qwen candidate selection failures before more GPU.
