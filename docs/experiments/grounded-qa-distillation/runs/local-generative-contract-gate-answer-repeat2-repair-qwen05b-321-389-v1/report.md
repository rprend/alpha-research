# Local Generative Contract Gate

## Setup

- Source run: `citation-contract-repair-local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-321-389-v1`
- Split: `extended_temporal_future_holdout`
- Eval offset: 320
- Eval examples: 69
- Gate feature: `unique_answer_token_overlap_with_cited_evidence`
- Selected threshold: 0.4
- LLM calls: 0
- Run cost: $0.0000000

## Selected Result

| Examples | Answered | Suppressed | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 15 | 25 | 40.6% | 38.3% | 13.1% | 3.7% | 100.0% |

## Threshold Grid

| Threshold | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Suppressed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 34 | 56.5% | 29.2% | 23.9% | 9.4% | 100.0% | 6 |
| 0.1 | 28 | 53.6% | 29.5% | 19.3% | 8.0% | 100.0% | 12 |
| 0.2 | 24 | 50.7% | 34.4% | 19.3% | 6.5% | 100.0% | 16 |
| 0.3 | 19 | 46.4% | 38.2% | 18.2% | 5.7% | 100.0% | 21 |
| 0.4 | 15 | 40.6% | 38.3% | 13.1% | 3.7% | 100.0% | 25 |
| 0.5 | 9 | 40.6% | 50.0% | 9.7% | 2.8% | 100.0% | 31 |
| 0.6 | 5 | 37.7% | 50.0% | 5.7% | 2.6% | 100.0% | 35 |
| 0.7 | 2 | 39.1% | 100.0% | 3.4% | 1.8% | 100.0% | 38 |
| 0.8 | 2 | 39.1% | 100.0% | 3.4% | 1.8% | 100.0% | 38 |

## Interpretation

The gate only checks lexical alignment between generated answers and cited evidence. It cannot prove support, recover missing citations, or learn abstention behavior.
