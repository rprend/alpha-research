# Augmented Constructor Router Audit

Generated: 2026-06-29T09:07:01.205Z

Status: `augmented_constructor_router_loses_prior_router`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Split | Contract Correct | Answer Type | Citation Exact |
| --- | ---: | ---: | ---: |
| Train tune | 89/160 (55.6%) | 63.7% | 86.9% |
| Train heldout | 30/63 (47.6%) | 58.7% | 87.3% |
| Repaired validation | 46/70 (65.7%) | 72.9% | 92.9% |

## Baseline Comparison

- Prior router: 47/70
- Constructor standalone: 41/70
- Prior three-system oracle: 54/70
- Augmented pool oracle: 58/70
- Augmented router: 46/70
- Delta vs prior router: -1
- Delta vs augmented oracle: -12

## Decision

- Buy OpenAI judgments now: no
- Launch Prime now: no
- Promote as policy: no
- Keep constructor in pool: yes
- Reason: The augmented pool has oracle headroom (58/70), but the leakage-safe router selects only 46/70 versus the prior router's 47/70.
- Next step: Do not spend on judging. Improve router supervision or candidate scoring so the constructor's added oracle headroom is selectable without validation leakage.
