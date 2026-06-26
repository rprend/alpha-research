# Baseline Results v1

Generated from:

- `runs/baseline-validation-v1/result.json`
- `runs/baseline-test-v1/result.json`

## Setup

The corpus uses QASPER examples with stable mixed evidence ordering. Model inputs contain compact evidence packs, document metadata, and instructions. Teacher evidence roles are available only in `teacher_trace.evidence_roles` for evaluation.

## Validation

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 100.0% | 31.8% | 18.6% | 6.5% | 0.0% |
| `lexical_overlap_t0` | 100.0% | 59.1% | 37.9% | 10.2% | 0.0% |
| `lexical_overlap_t0p04` | 40.9% | 90.9% | 20.5% | 6.5% | 59.1% |
| `lexical_overlap_t0p08` | 13.6% | 90.9% | 4.5% | 1.9% | 86.4% |
| `lexical_overlap_t0p12` | 4.5% | 95.5% | 0.0% | 0.2% | 95.5% |

## Test

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `retrieval_rank_1` | 96.2% | 30.8% | 12.8% | 4.3% | 0.0% |
| `lexical_overlap_t0` | 96.2% | 65.4% | 30.1% | 11.0% | 0.0% |
| `lexical_overlap_t0p04` | 57.7% | 92.3% | 24.0% | 12.5% | 46.2% |
| `lexical_overlap_t0p08` | 38.5% | 96.2% | 13.5% | 9.6% | 65.4% |
| `lexical_overlap_t0p12` | 26.9% | 100.0% | 11.5% | 8.2% | 76.9% |

## Interpretation

Mixed evidence ordering removed the trivial `E1` shortcut: rank-one citation precision fell to about 31% on both validation and test.

Lexical overlap is a useful cheap selector, but it is not enough. With no abstention threshold, it improves citation precision and recall over rank-one retrieval. With higher thresholds, it over-abstains and misses answerable questions.

## Next Change

Build a learned student scaffold with three heads:

1. evidence selection over compact packs,
2. sufficiency or abstention calibration,
3. short answer synthesis constrained to selected evidence.

The next run should compare that student against the lexical threshold sweep and a larger teacher on held-out examples.
