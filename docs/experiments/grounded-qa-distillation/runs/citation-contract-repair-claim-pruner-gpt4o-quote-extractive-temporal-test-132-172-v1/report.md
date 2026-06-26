# Citation Contract Repair

## Setup

- Source run: `openai-claim-pruner-gpt4o-quote-extractive-temporal-test-132-172-v1`
- Split: `temporal_test`
- Eval offset: 132
- Eval examples: 40
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 24 | 85.0% | 90.3% | 51.5% | 26.4% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 22 | 25 | 25 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
