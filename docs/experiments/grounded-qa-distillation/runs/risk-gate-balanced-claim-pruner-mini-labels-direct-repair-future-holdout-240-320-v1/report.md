# Grounded QA Risk Gate

## Setup

- Label packet: `teacher-repair-claim-pruner-mini-direct-future-holdout-0-160-v1`
- Source run: `citation-contract-repair-direct-mini-extended-future-holdout-240-320-v1`
- Eval split: `extended_temporal_future_holdout`
- Eval window: 240-320
- LLM calls: 0
- Run cost: $0.0000000

The risk gate trains on accepted/rejected answered labels from the strict export and applies a local support-risk threshold to cheap source predictions.

## Train Gate

| Examples | Accepted labels | Rejected labels | Accepted by gate | Precision | Accepted recall | F1 |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 121 | 85 | 36 | 87 | 80.5% | 82.4% | 81.4% |

## Eval Result

| Examples | Answered before | Answered after | Gate fired | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 64 | 46 | 18 | 68.8% | 64.7% | 51.7% | 23.3% | 100.0% |

This is a zero-call amortization experiment. It must be judged independently before claiming support preservation.
