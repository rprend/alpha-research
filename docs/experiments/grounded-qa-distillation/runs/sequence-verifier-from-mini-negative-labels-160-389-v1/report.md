# Sequence Verifier From Mini-Negative Teacher Labels

Scope: leave-window-out frozen pretrained sequence verifier over cited evidence and candidate answers on extended_temporal_future_holdout examples 161-389

This run makes no OpenAI calls. It embeds cited-evidence/candidate-answer pairs with `cross-encoder/nli-distilroberta-base` and trains only a small logistic verifier head in leave-window-out evaluation.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 138 | 91 | 185 | 44 | 98 | 40 | 7 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported teacher action | 192 / 229 (83.8%) | 131 | 74.8% | 7 | 7 | 0 |
| Strong support target | 178 / 229 (77.7%) | 115 | 72.2% | 23 | 8 | 15 |
| Exported policy action | 182 / 229 (79.5%) | 121 | 72.7% | 17 | 7 | 10 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 161-240 | 0.200 | 64 / 80 (80.0%) | 40 | 75.0% | 8 | 3 | 5 | 23.1% | 37.5% |
| Strong support target | 241-320 | 0.200 | 62 / 80 (77.5%) | 40 | 70.0% | 6 | 2 | 4 | 14.3% | 33.3% |
| Strong support target | 321-389 | 0.200 | 52 / 69 (75.4%) | 35 | 71.4% | 9 | 3 | 6 | 23.1% | 33.3% |
| Exported policy action | 161-240 | 0.600 | 62 / 80 (77.5%) | 32 | 78.1% | 16 | 6 | 10 | 66.7% | 12.5% |
| Exported policy action | 241-320 | 0.050 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 321-389 | 0.050 | 56 / 69 (81.2%) | 43 | 72.1% | 1 | 1 | 0 | 50.0% | 100.0% |

## Objective Details

### Strong support target

Train a sequence-embedding verifier on GPT-4o-derived keep/suppress labels.

- Delta vs balanced gate: -7 support-oracle rows (-3.1pp), -23 answered rows.
- Delta vs exported teacher: -14 support-oracle rows (-6.1pp), -16 answered rows.
- Answered-row suppress classification: 65.9% accuracy, 20.0% suppress recall, 34.8% suppress precision.

### Exported policy action

Train a sequence-embedding verifier to imitate the exported mini-negative teacher action.

- Delta vs balanced gate: -3 support-oracle rows (-1.3pp), -17 answered rows.
- Delta vs exported teacher: -10 support-oracle rows (-4.4pp), -10 answered rows.
- Answered-row suppress classification: 87.0% accuracy, 42.9% suppress recall, 17.6% suppress precision.

## Interpretation

This tests whether a pretrained claim/evidence sequence representation can recover the mini-negative teacher's sparse high-precision suppressions better than hand-engineered or TF-IDF features. A useful amortized verifier should improve support-oracle correctness over the balanced gate and approach the exported teacher without calling an LLM at inference time.
