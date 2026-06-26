# Grounded QA Failure Analysis

## Setup

- Split: `extended_temporal_future_holdout`
- Window: 0-160
- LLM calls: 0
- Run cost: $0.0000000

## Policy Metrics

| Policy | Examples | Answered | Judged correct | Answer support | Answer-type acc. | Unsupported answers | Wrong abstentions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| direct | 160 | 121 | 75.6% | 67.8% | 81.3% | 39 | 0 |
| claim_pruned_rubric | 160 | 118 | 72.5% | 62.7% | 78.1% | 44 | 0 |

## Pairwise Categories

- both_correct: 104
- both_wrong_abstention_target: 6
- both_wrong_answerable: 21
- direct_only_correct: 17
- rubric_only_correct: 12

## Interpretation

This diagnostic measures whether the current candidate pool has routing headroom. Rows where both policies are wrong require a materially different candidate or better evidence acquisition; rows where exactly one policy is correct are the only immediate selector headroom.
