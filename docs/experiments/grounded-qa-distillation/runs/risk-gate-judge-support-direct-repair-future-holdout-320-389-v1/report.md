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

| Examples | Accepted labels | Rejected labels | Accepted by gate | Precision | Accepted recall | F1 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 249 | 167 | 82 | 161 | 81.4% | 78.4% | 79.9% |

## Eval Result

| Examples | Answered before | Answered after | Gate fired | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 69 | 53 | 41 | 12 | 72.5% | 69.9% | 60.2% | 26.1% | 100.0% |

This is a zero-call amortization experiment. It must be judged independently before claiming support preservation.
