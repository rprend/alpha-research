# Citation Contract Repair

## Setup

- Source run: `openai-student-direct-mini-extended-future-holdout-160-240-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 160
- Eval examples: 80
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 64 | 77.5% | 59.8% | 61.7% | 26.1% | 96.9% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 22 | 35 | 35 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
