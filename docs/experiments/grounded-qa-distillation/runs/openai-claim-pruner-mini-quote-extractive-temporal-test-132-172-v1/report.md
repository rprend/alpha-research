# OpenAI Claim Pruner

## Setup

- Source run: `citation-contract-repair-quote-extractive-temporal-test-132-172-v1`
- Model: `gpt-4o-mini`
- Split: `temporal_test`
- Eval offset: 132
- Eval examples: 40
- LLM calls: 26
- Run cost: $0.0052359

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 25 | 82.5% | 86.7% | 51.2% | 24.0% | 84.0% |

LLM claim pruning tests whether unsupported subclaims can be removed from existing answer candidates before final judging.

This pass is an expensive teacher/verifier scaffold, not the final amortized cheap student.
