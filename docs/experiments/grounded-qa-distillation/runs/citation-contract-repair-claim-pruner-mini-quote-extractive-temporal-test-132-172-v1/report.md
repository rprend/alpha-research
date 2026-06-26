# Citation Contract Repair

## Setup

- Source run: `openai-claim-pruner-mini-quote-extractive-temporal-test-132-172-v1`
- Split: `temporal_test`
- Eval offset: 132
- Eval examples: 40
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 25 | 82.5% | 86.7% | 51.2% | 24.0% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 4 | 7 | 7 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
