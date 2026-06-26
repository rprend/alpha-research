# Citation Contract Repair

## Setup

- Source run: `openai-student-direct-mini-extended-future-holdout-320-389-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 320
- Eval examples: 69
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 53 | 81.2% | 68.2% | 77.3% | 32.2% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 10 | 13 | 13 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
