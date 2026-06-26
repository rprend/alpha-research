# Learned Entailment Gate Cross-Window Evaluation

Scope: balanced support-risk gate outputs on extended_temporal_future_holdout examples 241-389

This run makes no LLM calls. It trains a local logistic claim-entailment gate on one already judged future window and evaluates on the other, then aggregates both directions.

| Policy | Answered | Answer rate | Support-oracle correct | Answer support | Citation recall | Answer F1 | Gate fired | Suppressed unsupported | Harmful suppressed supported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 90 | 60.4% | 119 / 149 (79.9%) | 70.0% | 56.1% | 24.7% | 0 | 0 | 0 |
| Cross-window learned entailment gate | 84 | 56.4% | 113 / 149 (75.8%) | 67.9% | 51.1% | 23.0% | 6 | 0 | 6 |

## Delta vs Balanced Gate

- Answered examples: -6
- Support-oracle correctness: -4.0pp
- Answer support: -2.1pp
- Citation recall: -5.0pp
- Answer F1: -1.8pp

## Fold Details

| Eval window | Train windows | Threshold | Answered | Support-oracle correct | Answer support | Gate fired | Suppressed unsupported | Harmful suppressed supported |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 241-320 | 321-389 | 0.650 | 42 | 75.0% | 66.7% | 4 | 0 | 4 |
| 321-389 | 241-320 | 0.631 | 42 | 76.8% | 69.0% | 2 | 0 | 2 |

## Interpretation

The cross-window setup tests whether broader local entailment features transfer beyond the window used to fit them. A useful gate should suppress unsupported answers faster than supported answers while preserving more coverage than a blunt abstention rule.
