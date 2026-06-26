# Citation Contract Repair

## Setup

- Source run: `local-generative-sft-answered-only-mini-negative-temporal-qwen05b-161-320-to-321-389-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 320
- Eval examples: 69
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 36 | 39.1% | 21.8% | 13.1% | 13.7% | 100.0% |

## Repair Summary

| Rows changed | Missing inline citations before | Repaired inline citations |
| ---: | ---: | ---: |
| 28 | 30 | 30 |

The repair only enforces that cited ids appear inline in the answer. It does not change which evidence ids are cited or whether claims are actually supported.
