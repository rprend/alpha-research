# Local Verifier From Exported Teacher Labels

Scope: cross-window local verifier trained from exported verifier labels on extended_temporal_future_holdout

This run makes no LLM calls. It trains a local logistic verifier on one future window and evaluates on the other, using the exported verifier labels from `teacher-mini-negative-future-holdout-160-389-v1`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 138 | 91 | 185 | 44 | 98 | 40 | 7 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported teacher action | 192 / 229 (83.8%) | 131 | 74.8% | 7 | 7 | 0 |
| Strong support target | 182 / 229 (79.5%) | 129 | 71.3% | 9 | 3 | 6 |
| Exported policy action | 185 / 229 (80.8%) | 128 | 72.7% | 10 | 5 | 5 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 161-240 | 0.563 | 64 / 80 (80.0%) | 42 | 73.8% | 6 | 2 | 4 | 15.4% | 33.3% |
| Strong support target | 241-320 | 0.633 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Strong support target | 321-389 | 0.664 | 54 / 69 (78.3%) | 41 | 70.7% | 3 | 1 | 2 | 7.7% | 33.3% |
| Exported policy action | 161-240 | 0.929 | 65 / 80 (81.3%) | 45 | 73.3% | 3 | 1 | 2 | 0.0% | 0.0% |
| Exported policy action | 241-320 | 0.929 | 65 / 80 (81.3%) | 41 | 73.2% | 5 | 3 | 2 | 50.0% | 20.0% |
| Exported policy action | 321-389 | 0.930 | 55 / 69 (79.7%) | 42 | 71.4% | 2 | 1 | 1 | 0.0% | 0.0% |

## Objective Details

### Strong support target

Train on GPT-4o-derived keep/suppress verifier labels.

- Delta vs balanced gate: -3 support-oracle rows (-1.3pp), -9 answered rows.
- Delta vs exported teacher: -10 support-oracle rows (-4.4pp), -2 answered rows.
- Answered-row suppress classification: 68.8% accuracy, 7.5% suppress recall, 33.3% suppress precision.

### Exported policy action

Train to imitate the exported verifier teacher action.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), -10 answered rows.
- Delta vs exported teacher: -7 support-oracle rows (-3.1pp), -3 answered rows.
- Answered-row suppress classification: 89.1% accuracy, 14.3% suppress recall, 10.0% suppress precision.

## Interpretation

The exported labels are useful as a training object, but this local logistic verifier does not recover the teacher's high-precision suppressions cross-window. A paper-grade amortized verifier likely needs a stronger model class over claim/evidence pairs, not another shallow lexical logistic gate.
