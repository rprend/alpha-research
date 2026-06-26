# Local Generative Contract Gate

## Setup

- Source run: `citation-contract-repair-local-generative-sft-answered-only-mini-negative-temporal-qwen05b-321-389-v1`
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
| 69 | 10 | 26 | 33.3% | 33.3% | 6.3% | 3.0% | 100.0% |

## Threshold Grid

| Threshold | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citations | Suppressed |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 | 31 | 40.6% | 18.8% | 8.5% | 9.0% | 100.0% | 5 |
| 0.1 | 28 | 36.2% | 20.8% | 8.5% | 7.5% | 100.0% | 8 |
| 0.2 | 19 | 31.9% | 25.4% | 8.0% | 4.8% | 100.0% | 17 |
| 0.3 | 14 | 30.4% | 27.4% | 6.8% | 3.1% | 100.0% | 22 |
| 0.4 | 10 | 33.3% | 33.3% | 6.3% | 3.0% | 100.0% | 26 |
| 0.5 | 9 | 31.9% | 33.3% | 5.7% | 2.8% | 100.0% | 27 |
| 0.6 | 6 | 33.3% | 33.3% | 3.4% | 1.8% | 100.0% | 30 |
| 0.7 | 2 | 36.2% | 50.0% | 1.1% | 1.8% | 100.0% | 34 |
| 0.8 | 1 | 37.7% | 100.0% | 1.1% | 1.8% | 100.0% | 35 |

## Interpretation

The gate only checks lexical alignment between generated answers and cited evidence. It cannot prove support, recover missing citations, or learn abstention behavior.
