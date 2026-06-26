# OpenAI Claim Pruner

## Setup

- Source run: `citation-contract-repair-direct-mini-extended-future-holdout-80-160-v1`
- Model: `gpt-4o-mini`
- Split: `extended_temporal_future_holdout`
- Eval offset: 80
- Eval examples: 80
- LLM calls: 58
- Run cost: $0.0134595

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 80 | 58 | 86.3% | 69.5% | 72.1% | 28.0% | 86.2% |

LLM claim pruning tests whether unsupported subclaims can be removed from existing answer candidates before final judging.

This pass is an expensive teacher/verifier scaffold, not the final amortized cheap student.
