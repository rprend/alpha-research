# Citation Contract Repair

## Setup

- Source run: `openai-student-claim-pruned-rubric-extended-future-holdout-0-80-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 0
- Eval examples: 80
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 61 | 71.3% | 65.6% | 60.6% | 23.5% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 2 | 2 | 2 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
