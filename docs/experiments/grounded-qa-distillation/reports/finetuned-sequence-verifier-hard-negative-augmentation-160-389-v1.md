# Fine-Tuned Sequence Verifier From Mini-Negative Teacher Labels

Scope: leave-window-out supervised fine-tuned sequence verifier over cited evidence and candidate answers on extended_temporal_future_holdout examples 161-389

This run makes no OpenAI calls. It fine-tunes `cross-encoder/nli-distilroberta-base` as a binary keep/suppress verifier over cited-evidence/candidate-answer pairs, then evaluates leave-window-out across the judged future windows.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress | Teacher suppress actions |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 229 | 138 | 91 | 185 | 44 | 98 | 40 | 7 |

## Method

- Epochs: 2
- Batch size: 4
- Learning rate: 2e-05
- Unfrozen encoder layers: 2
- Train-only hard-negative augmentation: True (max 2 per supported train row)
- Class weighting: inverse-frequency cross entropy over answered training rows

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported teacher action | 192 / 229 (83.8%) | 131 | 74.8% | 7 | 7 | 0 |
| Strong support target | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |
| Exported policy action | 185 / 229 (80.8%) | 138 | 71.0% | 0 | 0 | 0 |

## Cross-Window Folds

| Objective | Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Strong support target | 161-240 | 0.150 | 66 / 80 (82.5%) | 48 | 72.9% | 0 | 0 | 0 | 0.0% | 0.0% |
| Strong support target | 241-320 | 0.300 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Strong support target | 321-389 | 0.050 | 55 / 69 (79.7%) | 44 | 70.5% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 161-240 | 0.050 | 66 / 80 (82.5%) | 48 | 72.9% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 241-320 | 0.050 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% |
| Exported policy action | 321-389 | 0.050 | 55 / 69 (79.7%) | 44 | 70.5% | 0 | 0 | 0 | 0.0% | 0.0% |

## Objective Details

### Strong support target

Fine-tune a binary sequence verifier on GPT-4o-derived keep/suppress labels.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), 0 answered rows.
- Delta vs exported teacher: -7 support-oracle rows (-3.1pp), +7 answered rows.
- Answered-row suppress classification: 71.0% accuracy, 0.0% suppress recall, 0.0% suppress precision.

### Exported policy action

Fine-tune a binary sequence verifier to imitate the exported mini-negative teacher action.

- Delta vs balanced gate: 0 support-oracle rows (0.0pp), 0 answered rows.
- Delta vs exported teacher: -7 support-oracle rows (-3.1pp), +7 answered rows.
- Answered-row suppress classification: 94.9% accuracy, 0.0% suppress recall, 0.0% suppress precision.

## Interpretation

This tests whether the failure of the frozen sequence verifier was due to the fixed representation. A paper-relevant amortized verifier should improve over the balanced support-risk gate and approach the exported mini-negative teacher without calling an LLM at inference time.
