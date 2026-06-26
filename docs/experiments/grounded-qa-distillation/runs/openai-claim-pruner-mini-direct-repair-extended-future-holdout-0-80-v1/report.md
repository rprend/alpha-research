# OpenAI Claim Pruner

## Setup

- Source run: `citation-contract-repair-direct-mini-extended-future-holdout-0-80-v1`
- Model: `gpt-4o-mini`
- Split: `extended_temporal_future_holdout`
- Eval offset: 0
- Eval examples: 80
- LLM calls: 63
- Run cost: $0.0146648

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 63 | 76.3% | 65.3% | 66.8% | 29.8% | 96.8% |

LLM claim pruning tests whether unsupported subclaims can be removed from existing answer candidates before final judging.

This pass is an expensive teacher/verifier scaffold, not the final amortized cheap student.
