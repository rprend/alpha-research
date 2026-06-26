# Judge Support Label Export

## Setup

- Prefix: `judge-support-local-sft-answer-repeat2-final-window-v1`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Answered labels | Accepted | Rejected | Accepted rate |
| ---: | ---: | ---: | ---: |
| 40 | 2 | 38 | 5.0% |

These labels reuse existing `gpt-4o` judgments over direct mini plus citation-repair predictions. Accepted rows are answered predictions judged fully supported; rejected rows are answered predictions judged partial, unsupported, invalid, or otherwise not fully supported.
