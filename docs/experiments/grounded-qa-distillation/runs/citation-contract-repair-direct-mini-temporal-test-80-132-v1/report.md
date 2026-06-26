# Citation Contract Repair

## Setup

- Source run: `openai-student-temporal-test-full-v1`
- Split: `temporal_test`
- Eval offset: 80
- Eval examples: 52
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 52 | 37 | 76.9% | 73.0% | 57.7% | 21.3% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 8 | 12 | 12 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
