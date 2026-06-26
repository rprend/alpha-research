# Pretrained NLI Verifier Over Combined Labels

Scope: cross-window pretrained NLI verifier over balanced-gate candidate answers on extended_temporal_future_holdout examples 241-389

This run makes no OpenAI calls. It uses `cross-encoder/nli-distilroberta-base` as a pretrained NLI cross-encoder over cited evidence and candidate answer/claim hypotheses, then tunes only a keep/suppress threshold on one future window and evaluates on the other.

## Data

| Examples | Answered | Abstained | Strong keep | Strong suppress | Answered keep | Answered suppress |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 149 | 90 | 59 | 119 | 30 | 63 | 27 |

## Aggregate Policy Result

| Policy | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Balanced support-risk gate | 119 / 149 (79.9%) | 90 | 70.0% | 0 | 0 | 0 |
| Combined teacher action | 125 / 149 (83.9%) | 82 | 75.6% | 8 | 7 | 1 |
| Pretrained NLI verifier | 120 / 149 (80.5%) | 87 | 71.3% | 3 | 2 | 1 |

## Delta

- Vs balanced gate: +1 support-oracle rows (+0.7pp), -3 answered rows.
- Vs combined teacher: -5 support-oracle rows (-3.4pp), +5 answered rows.

## Cross-Window Folds

| Eval window | Threshold | Correct / examples | Answered | Answer support | Gate fired | Suppressed unsupported | Harmful suppressions | Suppress recall | Suppress precision | Mean score supported | Mean score unsupported |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 241-320 | 0.005 | 64 / 80 (80.0%) | 46 | 69.6% | 0 | 0 | 0 | 0.0% | 0.0% | 0.296 | 0.209 |
| 321-389 | 0.008 | 56 / 69 (81.2%) | 41 | 73.2% | 3 | 2 | 1 | 15.4% | 66.7% | 0.234 | 0.261 |

## Interpretation

This tests whether an off-the-shelf entailment model supplies the missing claim/evidence signal that local lexical gates lacked. A useful result would suppress unsupported answers faster than supported answers and approach the combined teacher without per-query LLM verifier calls.
