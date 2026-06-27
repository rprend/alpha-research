# Faithfulness Ranking Control

Scope: 321-389 final window over direct mini + citation repair.

This run makes no LLM calls and launches no GPU jobs. It trains a lexical cited-evidence faithfulness threshold on 241-320, then applies the fixed threshold to 321-389. It does not rewrite citations or answers; it only suppresses low-score answers, so inherited GPT-4o support judgments remain interpretable as a support-oracle diagnostic.

## Threshold Selection

Selected threshold: 24.0%.

| Threshold | Train answer rate | Train answer support | Train support-oracle correct | Delta vs direct | Suppressions |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 0.0% | 80.0% | 64.1% | 57/80 (71.3%) | 0 | 0 |
| 20.0% | 76.3% | 67.2% | 60/80 (75.0%) | +3 | 3 |
| 24.0% | 73.8% | 69.5% | 62/80 (77.5%) | +5 | 5 |
| 40.0% | 67.5% | 70.4% | 61/80 (76.3%) | +4 | 10 |
| 60.0% | 45.0% | 75.0% | 57/80 (71.3%) | 0 | 28 |
| 80.0% | 17.5% | 78.6% | 47/80 (58.8%) | -10 | 50 |
| 100.0% | 0.0% | 0.0% | 39/80 (48.8%) | -18 | 64 |

## Final-Window Result

| Policy | Answer rate | Answer support | Support-oracle correct | Suppressions | Harmful suppressions |
| --- | ---: | ---: | ---: | ---: | ---: |
| Direct repair baseline | 76.8% | 64.2% | 50/69 (72.5%) | 0 | 0 |
| Faithfulness ranking filter | 76.8% | 64.2% | 50/69 (72.5%) | 0 | 0 |

Delta: 0 rows, 0.0pp.

## Local Task Metrics After Filter

| Answered | Answer-type acc. | Citation precision | Citation recall | Answer F1 | Inline citation rate |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 53 | 81.2% | 68.2% | 77.3% | 32.2% | 100.0% |

## Feature Separation

| Supported answer score | Unsupported answer score | Supported overlap | Unsupported overlap | Unsupported-number rows |
| ---: | ---: | ---: | ---: | ---: |
| 65.2% | 64.4% | 71.9% | 72.0% | 0 |

## Suppressed Examples

| Example | Interpretation | Source verdict | Faithfulness score | Cited answer overlap | Best cited rank | Unsupported numbers | Answer preview |
| --- | --- | --- | ---: | ---: | ---: | --- | --- |
| none | none | none | n/a | n/a | n/a | none | none |

## Paper Implication

The lexical faithfulness/ranking filter does not improve inherited final-window correctness over direct repair at the selected 24.0% threshold (50/69 vs 50/69); reviewer-facing retrieval-side controls remain necessary, but they do not replace the Qwen repair/regeneration test.
