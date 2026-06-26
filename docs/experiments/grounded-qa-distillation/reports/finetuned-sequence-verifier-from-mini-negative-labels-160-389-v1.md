# Fine-Tuned Sequence Verifier From Mini-Negative Teacher Labels

Scope: leave-window-out supervised fine-tuned sequence verifier over cited evidence and candidate answers on extended_temporal_future_holdout examples 161-389

This run makes no OpenAI calls. It fine-tunes `cross-encoder/nli-distilroberta-base` as a binary keep/suppress verifier over cited-evidence/candidate-answer pairs, then evaluates leave-window-out across the judged future windows.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 138 | 91 | 185 | 44 | 98 | 40 | 7 |

## Method

- Epochs: 6
- Batch size: 4
- Learning rate: 2e-05
- Unfrozen encoder layers: 2
- Class weighting: inverse-frequency cross entropy over answered training rows

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported teacher action | 192 / 229 (83.8%) | 131 | 74.8% | 7 | 7 | 0 |
| Strong support target | 186 / 229 (81.2%) | 119 | 74.8% | 19 | 10 | 9 |
| Exported policy action | 184 / 229 (80.3%) | 127 | 72.4% | 11 | 5 | 6 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 161-240 | 0.493 | 66 / 80 (82.5%) | 38 | 78.9% | 10 | 5 | 5 | 38.5% | 50.0% |
| Strong support target | 241-320 | 0.328 | 65 / 80 (81.2%) | 41 | 73.2% | 5 | 3 | 2 | 21.4% | 60.0% |
| Strong support target | 321-389 | 0.408 | 55 / 69 (79.7%) | 40 | 72.5% | 4 | 2 | 2 | 15.4% | 50.0% |
| Exported policy action | 161-240 | 0.995 | 67 / 80 (83.8%) | 41 | 78.0% | 7 | 4 | 3 | 66.7% | 28.6% |
| Exported policy action | 241-320 | 0.600 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 321-389 | 0.989 | 53 / 69 (76.8%) | 40 | 70.0% | 4 | 1 | 3 | 50.0% | 25.0% |

## Objective Details

### Strong support target

Fine-tune a binary sequence verifier on GPT-4o-derived keep/suppress labels.

- Delta vs balanced gate: +1 support-oracle rows (+0.4pp), -19 answered rows.
- Delta vs exported teacher: -6 support-oracle rows (-2.6pp), -12 answered rows.
- Answered-row suppress classification: 71.7% accuracy, 25.0% suppress recall, 52.6% suppress precision.

### Exported policy action

Fine-tune a binary sequence verifier to imitate the exported mini-negative teacher action.

- Delta vs balanced gate: -1 support-oracle rows (-0.4pp), -11 answered rows.
- Delta vs exported teacher: -8 support-oracle rows (-3.5pp), -4 answered rows.
- Answered-row suppress classification: 91.3% accuracy, 42.9% suppress recall, 27.3% suppress precision.

## Interpretation

This tests whether the failure of the frozen sequence verifier was due to the fixed representation. A paper-relevant amortized verifier should improve over the balanced support-risk gate and approach the exported mini-negative teacher without calling an LLM at inference time.
