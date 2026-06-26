# OpenAI Claim Pruner

## Setup

- Source run: `citation-contract-repair-quote-extractive-temporal-test-132-172-v1`
- Model: `gpt-4o`
- Split: `temporal_test`
- Eval offset: 132
- Eval examples: 40
- LLM calls: 26
- Run cost: $0.0789950

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 24 | 85.0% | 90.3% | 51.5% | 26.4% | 8.3% |

LLM claim pruning tests whether unsupported subclaims can be removed from existing answer candidates before final judging.

This pass is an expensive teacher/verifier scaffold, not the final amortized cheap student.
