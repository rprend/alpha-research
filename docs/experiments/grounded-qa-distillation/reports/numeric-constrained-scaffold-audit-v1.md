# Numeric Constrained Scaffold Audit

Generated: 2026-06-29T08:37:10.768Z

Status: `constrained_scaffold_improves_qwen_but_loses_baseline`

This audit makes no OpenAI calls and launches no compute.

## Metrics

| Surface | Contract correct | Rate |
| --- | ---: | ---: |
| Abstention prior | 9 / 10 | 90.0% |
| Constrained scaffold | 5 / 10 | 50.0% |
| Normalized Qwen 3B numeric teacher | 4 / 10 | 40.0% |
| DPO-prompt-repaired baseline | 7 / 10 | 70.0% |

## Deltas

| Comparison | Rows |
| --- | ---: |
| Scaffold - normalized Qwen | +1 |
| Scaffold - DPO baseline | -2 |
| Scaffold - abstention prior | -4 |

## Decision

- Launch Prime now: no
- Buy OpenAI judgments now: no
- Use constrained scaffold as next GPU target: no
- Keep as zero-cost baseline: yes
- Reason: The constrained scaffold improves over normalized Qwen (5 vs 4) but loses to the DPO-prompt-repaired baseline (7) and to the abstention prior (9).
- Next step: Use this constrained scaffold only as a floor. A next candidate must beat both the DPO-prompt-repaired diagnostic baseline and the abstention prior on this skewed surface before any Prime or OpenAI spend.
