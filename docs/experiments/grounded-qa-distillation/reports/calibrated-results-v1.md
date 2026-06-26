# Calibrated Student Results v1

Generated from:

- `runs/calibrated-validation-v1/result.json`
- `runs/calibrated-test-v1/result.json`

## Setup

This run adds counterfactual insufficient-evidence examples and separates the student into:

1. a learned evidence selector,
2. a learned sufficiency calibrator,
3. a simple extractive sentence-copy answerer.

The corpus now has:

- train: 199 examples, 134 answerable and 65 abstentions,
- validation: 178 examples, 122 answerable and 56 abstentions,
- test: 207 examples, 143 answerable and 64 abstentions.

The evidence selector trains over 232 positive and 597 negative evidence candidates. The sufficiency calibrator trains over 134 answerable and 65 insufficient examples.

Metrics are corrected so abstentions do not inflate answer quality: citation precision is averaged only over cited predictions, citation recall and answer F1 are averaged over answerable references, and abstention accuracy is reported separately.

## Validation

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 68.5% | 20.8% | 17.8% | 6.4% | 0.0% |
| `lexical_overlap_t0` | 68.5% | 37.6% | 34.5% | 8.3% | 0.0% |
| `learned_selector_top1` | 68.5% | 45.5% | 42.3% | 9.4% | 0.0% |
| `learned_selector_top2_t0p35` | 71.3% | 55.5% | 40.8% | 8.6% | 38.8% |
| `suff_calibrated_top2_t0p35` | 69.7% | 53.4% | 48.5% | 8.1% | 42.7% |

## Test

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 69.1% | 26.6% | 20.7% | 7.8% | 0.0% |
| `lexical_overlap_t0` | 69.1% | 44.9% | 38.3% | 9.8% | 0.0% |
| `learned_selector_top1` | 69.1% | 41.1% | 36.9% | 9.0% | 0.0% |
| `learned_selector_top2_t0p35` | 69.6% | 48.9% | 36.7% | 7.2% | 36.2% |
| `suff_calibrated_top2_t0p35` | 68.6% | 45.7% | 42.1% | 7.8% | 38.2% |

## Interpretation

Counterfactual insufficient-evidence examples made abstention meaningful. Always-answer systems now have answer type accuracy around the answerable rate, roughly 69%.

The sufficiency-calibrated student improves citation recall over lexical overlap on test (42.1% vs. 38.3%) while slightly improving citation precision (45.7% vs. 44.9%). That is the intended direction: it finds more supporting evidence while refusing some insufficient packs.

The weakness is answer compression. The current answerer copies full evidence sentences, so answer token F1 trails lexical overlap even when citation recall improves. This is not a final QA student.

## Next Change

Add a constrained answer compressor trained from `output.claim_table` and `output.answer`, or export this corpus to a small generative model. The next paper-relevant question is whether evidence-selection improvements survive answer synthesis instead of being lost in verbose sentence copying.
