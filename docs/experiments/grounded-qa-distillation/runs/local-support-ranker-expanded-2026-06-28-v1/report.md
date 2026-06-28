# Local Support Ranker

Generated: 2026-06-28T07:36:49.568Z

Status: `ranker_not_reliable`

This run makes no OpenAI calls and launches no compute.

## Metrics

| Split | Pairs/examples | Correct/supported | Rate |
| --- | ---: | ---: | ---: |
| Train pairwise | 59 | 50 | 84.7% |
| Validation pairwise | 24 | 12 | 50.0% |
| Final diagnostic pairwise | 61 | 24 | 39.3% |
| Final diagnostic selection | 8 | 3 | 37.5% |

## Decision

- Integrate selector now: no
- Launch GPU now: no
- Reason: The local ranker does not reach 75% validation pairwise accuracy, so it is not reliable enough to control answer selection.
- Next step: Increase non-final pair diversity and add entailment-specific features before another model or GPU run.
