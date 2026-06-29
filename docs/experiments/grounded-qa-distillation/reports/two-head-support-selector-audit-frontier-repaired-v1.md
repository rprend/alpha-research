# Two-Head Support Selector Audit

Generated: 2026-06-29T09:24:42.587Z

Status: `two_head_selector_ties_prior_router`

This audit makes no OpenAI calls and launches no Prime compute.

## Metrics

| Selector | Validation contract correct |
| --- | ---: |
| contract_single_head | 46 / 70 |
| two_head_product | 46 / 70 |
| two_head_min_support | 47 / 70 |
| two_head_average | 46 / 70 |

## Baseline Comparison

- Prior three-system router: 47/70
- Augmented router: 46/70
- Selected two-head selector: 47/70
- Augmented oracle: 58/70
- Remaining gap to augmented oracle: 11

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Promote two-head selector: no
- Reason: The two-head min-support selector reaches 47/70: +1 versus the augmented router and +0 versus the prior router.
- Next step: Use the diagnostic to guide richer support supervision; do not spend on judging because it does not beat the prior router.
