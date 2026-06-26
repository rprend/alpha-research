# Policy Selector

## Setup

- Split: `temporal_test`
- Eval offset: 132
- Eval examples: 40
- LLM calls: 0
- Run cost: $0.0000000

## Result

| Examples | Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate | Inherited judged correct |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 40 | 31 | 82.5% | 78.0% | 70.2% | 23.4% | 100.0% | 92.5% |

## Policy Mix

- balanced_rubric: 7
- citation_repair: 9
- direct: 24

This selector is an analysis scaffold over already-judged component predictions. It does not make fresh model calls and should be treated as a routing upper-bound/control until validated on a separate slice.
