# Local Verifier From Combined Teacher Labels

Scope: cross-window local verifier trained from combined verifier labels on extended_temporal_future_holdout examples 241-389

This run makes no LLM calls. It trains a local logistic verifier on one future window and evaluates on the other, using the exported combined verifier labels from `teacher-combined-mini-det-guard-future-holdout-240-389-v1`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 149 | 90 | 59 | 119 | 30 | 63 | 27 | 8 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 |
| Combined teacher action | 125 / 149 (83.9%) | 82 | 75.6% | 8 | 7 | 1 |
| Strong support target | 116 / 149 (77.9%) | 81 | 70.4% | 9 | 3 | 6 |
| Combined policy action | 119 / 149 (79.9%) | 88 | 70.5% | 2 | 1 | 1 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 241-320 | 0.653 | 61 / 80 (76.3%) | 39 | 69.2% | 7 | 2 | 5 | 14.3% | 28.6% |
| Strong support target | 321-389 | 0.649 | 55 / 69 (79.7%) | 42 | 71.4% | 2 | 1 | 1 | 7.7% | 50.0% |
| Combined policy action | 241-320 | 0.700 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Combined policy action | 321-389 | 0.893 | 55 / 69 (79.7%) | 42 | 71.4% | 2 | 1 | 1 | 50.0% | 100.0% |

## Objective Details

### Strong support target

Train on GPT-4o-derived keep/suppress verifier labels.

- Delta vs balanced gate: -3 support-oracle rows (-2.0pp), -9 answered rows.
- Delta vs combined teacher: -9 support-oracle rows (-6.0pp), -1 answered rows.
- Answered-row suppress classification: 66.7% accuracy, 11.1% suppress recall, 33.3% suppress precision.

### Combined policy action

Train to imitate the exported mini-negative plus deterministic-guard teacher action.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), -2 answered rows.
- Delta vs combined teacher: -6 support-oracle rows (-4.0pp), +6 answered rows.
- Answered-row suppress classification: 93.3% accuracy, 25.0% suppress recall, 100.0% suppress precision.

## Interpretation

The exported labels are useful as a training object, but this local logistic verifier does not recover the combined teacher's high-precision suppressions cross-window. A paper-grade amortized verifier likely needs a stronger model class over claim/evidence pairs, not another shallow lexical logistic gate.
