# Citation Contract Repair

## Setup

- Source run: `openai-claim-pruner-mini-direct-repair-extended-future-holdout-80-160-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 80
- Eval examples: 80
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 58 | 86.3% | 69.5% | 72.1% | 28.0% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 8 | 13 | 13 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
