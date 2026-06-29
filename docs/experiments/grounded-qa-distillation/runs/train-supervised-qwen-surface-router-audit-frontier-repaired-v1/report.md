# Train-Supervised Candidate Router Audit

Generated: 2026-06-29T06:40:15.950Z

Status: `qwen_surface_router_does_not_beat_prior_router`

This router is trained only on repaired train-tune rows and evaluated on heldout train plus repaired validation.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | 97/160 (60.6%) | 61.9% | 96.9% |
| Train heldout | 32/63 (50.8%) | 52.4% | 96.8% |
| Repaired validation | 45/70 (64.3%) | 68.6% | 95.7% |

## Baseline Comparison

- Train-calibrated scaffold: 44/70
- Train-selected constrained policy: 41/70
- Learned repaired selector: 41/70
- Three-system validation oracle: 58/70
- Train-supervised router: 45/70
- Delta vs scaffold: 1
- Delta vs three-system oracle: -13

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as policy: no
- Next step: Do not promote the Qwen-surface router or buy judgments. The new surface increases oracle headroom but the current shallow router cannot exploit it; inspect Qwen candidate selection failures before more GPU.
