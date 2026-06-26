# Student Results v1

Superseded for current comparisons by `reports/calibrated-results-v1.md`, which adds counterfactual insufficient-evidence examples and corrected answer/citation metrics.

Generated from:

- `runs/student-validation-v1/result.json`
- `runs/student-test-v1/result.json`

## Setup

This run uses the larger pilot materialization:

- train: 153 examples from 40 QASPER rows,
- validation: 127 examples from 40 QASPER rows,
- test: 149 examples from 40 QASPER rows.

The learned student is a dependency-free logistic evidence selector trained on `train.jsonl`. It uses only model-visible question, evidence, section, title, abstract, retrieval rank, lexical overlap, numeric-intent, and table-like features. Teacher evidence roles are used only as training labels and evaluation labels.

Training accuracy: 93.3% over 232 positive and 459 negative evidence candidates.

## Validation

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 96.1% | 29.1% | 17.1% | 6.2% | 0.0% |
| `lexical_overlap_t0` | 96.1% | 52.8% | 33.1% | 8.0% | 0.0% |
| `learned_selector_top1` | 96.1% | 63.0% | 39.9% | 8.9% | 0.0% |
| `learned_selector_top2_t0p35` | 85.0% | 69.7% | 49.0% | 11.8% | 17.3% |
| `learned_selector_top2_t0p5` | 74.0% | 75.6% | 42.1% | 11.0% | 28.3% |
| `learned_selector_top2_t0p65` | 62.2% | 81.1% | 35.3% | 9.1% | 40.2% |

## Test

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 96.0% | 36.9% | 19.9% | 7.5% | 0.0% |
| `lexical_overlap_t0` | 96.0% | 62.4% | 36.7% | 9.4% | 0.0% |
| `learned_selector_top1` | 96.0% | 61.1% | 37.9% | 9.8% | 0.0% |
| `learned_selector_top2_t0p35` | 79.2% | 66.8% | 42.2% | 9.9% | 20.8% |
| `learned_selector_top2_t0p5` | 75.8% | 68.5% | 38.4% | 10.0% | 25.5% |
| `learned_selector_top2_t0p65` | 67.8% | 72.5% | 33.2% | 9.2% | 33.6% |

## Interpretation

The learned selector is now doing nontrivial distillation work. On test, the top-2 learned variants improve citation precision, citation recall, and answer F1 over the best no-abstain lexical selector. The gain is small but directionally important because the model uses training labels rather than only same-example lexical overlap.

The weak point is abstention calibration. Thresholded learned variants refuse many answerable questions. That makes them unacceptable as a full QA system even when their cited answers are better grounded.

## Next Change

Separate the student into two calibrated components:

1. evidence selection: rank or select evidence candidates,
2. sufficiency: decide whether the selected evidence supports any answer.

The current threshold couples those decisions. A paper-worthy system needs explicit sufficiency supervision and a stronger answer compressor or small generative model.
