# Grounded QA Risk Gate

## Setup

- Label packet: `judge-support-direct-repair-future-holdout-0-320-v1`
- Source run: `citation-contract-repair-direct-mini-extended-future-holdout-320-389-v1`
- Eval split: `extended_temporal_future_holdout`
- Eval window: 320-389
- LLM calls: 0
- Run cost: $0.0000000

The risk gate trains on accepted/rejected answered labels from the strict export and applies a local support-risk threshold to cheap source predictions.

## Train Gate

| Split | Examples | Accepted labels | Rejected labels | Accepted by gate | Precision | Accepted recall | F1 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Train | 185 | 126 | 59 | 126 | 81.7% | 81.7% | 81.7% |
| Validation | 59 | 38 | 21 | 40 | 77.5% | 81.6% | 79.5% |

## Eval Result

| Examples | Answered before | Answered after | Gate fired | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 53 | 42 | 11 | 73.9% | 69.4% | 62.5% | 26.7% | 100.0% |

## Inherited Judge Result

| Answered | Answer support | Abstained | Abstention support | Inherited overall correct | Useful suppressions | Harmful suppressions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 42 | 69.0% | 27 | 63.0% | 66.7% | 6 | 5 |


This is a zero-call amortization experiment. It must be judged independently before claiming support preservation.
