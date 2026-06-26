# Citation Contract Repair

## Setup

- Source run: `openai-student-direct-mini-extended-future-holdout-80-160-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 80
- Eval examples: 80
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 58 | 86.3% | 69.0% | 73.0% | 23.9% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 15 | 27 | 27 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
