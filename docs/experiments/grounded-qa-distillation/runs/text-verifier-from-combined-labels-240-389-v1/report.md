# Text Verifier From Combined Teacher Labels

Scope: cross-window high-dimensional local text verifier trained from combined verifier labels on extended_temporal_future_holdout examples 241-389

This run makes no LLM calls. It trains a local TF-IDF logistic verifier on one future window and evaluates on the other, using the exported combined verifier labels from `teacher-combined-mini-det-guard-future-holdout-240-389-v1`.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Combined suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 149 | 90 | 59 | 119 | 30 | 63 | 27 | 8 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 |
| Combined teacher action | 125 / 149 (83.9%) | 82 | 75.6% | 8 | 7 | 1 |
| Strong support target | 106 / 149 (71.1%) | 73 | 65.8% | 17 | 2 | 15 |
| Combined policy action | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 241-320 | 0.500 | 55 / 80 (68.8%) | 33 | 63.6% | 13 | 2 | 11 | 14.3% | 15.4% |
| Strong support target | 321-389 | 0.455 | 51 / 69 (73.9%) | 40 | 67.5% | 4 | 0 | 4 | 0.0% | 0.0% |
| Combined policy action | 241-320 | 0.300 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Combined policy action | 321-389 | 0.353 | 55 / 69 (79.7%) | 44 | 70.5% | 0 | 0 | 0 | 0.0% | 0.0% |

## Objective Details

### Strong support target

Train a text verifier on GPT-4o-derived keep/suppress labels.

- Delta vs balanced gate: -13 support-oracle rows (-8.7pp), -17 answered rows.
- Delta vs combined teacher: -19 support-oracle rows (-12.8pp), -9 answered rows.
- Answered-row suppress classification: 55.6% accuracy, 7.4% suppress recall, 11.8% suppress precision.

### Combined policy action

Train a text verifier to imitate mini-negative plus deterministic-guard teacher actions.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), 0 answered rows.
- Delta vs combined teacher: -6 support-oracle rows (-4.0pp), +8 answered rows.
- Answered-row suppress classification: 91.1% accuracy, 0.0% suppress recall, 0.0% suppress precision.

## Interpretation

The high-dimensional text verifier is a stronger local model than the handcrafted logistic gate, but it still does not distill the combined teacher's high-precision suppressions. This narrows the next step to a pretrained entailment/cross-encoder model or actual generative SFT, rather than more local bag-of-words verifier variants.
