# Citation Contract Repair

## Setup

- Source run: `local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-170train-1epoch-321-389-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 320
- Eval examples: 69
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 40 | 56.5% | 33.1% | 30.7% | 13.9% | 97.5% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 38 | 52 | 52 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
