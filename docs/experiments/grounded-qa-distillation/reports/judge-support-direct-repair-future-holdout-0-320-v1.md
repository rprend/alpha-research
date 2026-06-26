# Judge Support Label Export

## Setup

- Prefix: `judge-support-direct-repair-future-holdout-0-320-v1`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Answered labels | Accepted | Rejected | Accepted rate |
| ---: | ---: | ---: | ---: |
| 249 | 167 | 82 | 67.1% |

These labels reuse existing `gpt-4o` judgments over direct mini plus citation-repair predictions. Accepted rows are answered predictions judged fully supported; rejected rows are answered predictions judged partial, unsupported, invalid, or otherwise not fully supported.
