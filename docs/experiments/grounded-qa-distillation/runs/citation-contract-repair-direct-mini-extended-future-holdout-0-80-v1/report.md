# Citation Contract Repair

## Setup

- Source run: `openai-student-direct-mini-extended-future-holdout-0-80-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 0
- Eval examples: 80
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 63 | 76.3% | 66.1% | 68.8% | 25.7% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 13 | 19 | 19 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
