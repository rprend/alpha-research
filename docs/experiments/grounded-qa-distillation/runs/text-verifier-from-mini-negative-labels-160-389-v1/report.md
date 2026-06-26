# Text Verifier From Combined Teacher Labels

Scope: cross-window high-dimensional local text verifier trained from exported verifier labels on extended_temporal_future_holdout

This run makes no LLM calls. It trains a local TF-IDF logistic verifier on one future window and evaluates on the other, using the exported verifier labels from `teacher-mini-negative-future-holdout-160-389-v1`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 138 | 91 | 185 | 44 | 98 | 40 | 7 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported teacher action | 192 / 229 (83.8%) | 131 | 74.8% | 7 | 7 | 0 |
| Strong support target | 166 / 229 (72.5%) | 101 | 69.3% | 37 | 9 | 28 |
| Exported policy action | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 161-240 | 0.500 | 66 / 80 (82.5%) | 38 | 78.9% | 10 | 5 | 5 | 38.5% | 50.0% |
| Strong support target | 241-320 | 0.446 | 54 / 80 (67.5%) | 34 | 61.8% | 12 | 1 | 11 | 7.1% | 8.3% |
| Strong support target | 321-389 | 0.518 | 46 / 69 (66.7%) | 29 | 65.5% | 15 | 3 | 12 | 23.1% | 20.0% |
| Exported policy action | 161-240 | 0.250 | 66 / 80 (82.5%) | 48 | 72.9% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 241-320 | 0.374 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 321-389 | 0.250 | 55 / 69 (79.7%) | 44 | 70.5% | 0 | 0 | 0 | 0.0% | 0.0% |

## Objective Details

### Strong support target

Train a text verifier on GPT-4o-derived keep/suppress labels.

- Delta vs balanced gate: -19 support-oracle rows (-8.3pp), -37 answered rows.
- Delta vs combined teacher: -26 support-oracle rows (-11.4pp), -30 answered rows.
- Answered-row suppress classification: 57.2% accuracy, 22.5% suppress recall, 24.3% suppress precision.

### Exported policy action

Train a text verifier to imitate the exported verifier teacher actions.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), 0 answered rows.
- Delta vs combined teacher: -7 support-oracle rows (-3.1pp), +7 answered rows.
- Answered-row suppress classification: 94.9% accuracy, 0.0% suppress recall, 0.0% suppress precision.

## Interpretation

The high-dimensional text verifier is a stronger local model than the handcrafted logistic gate, but it still must be judged against the exported teacher's high-precision suppressions. A failed transfer narrows the next step to a pretrained entailment/cross-encoder model or actual generative SFT, rather than more local bag-of-words verifier variants.
