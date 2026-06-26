# Grounded QA Distillation Run

Run: `baseline-validation-v1`

Split: `validation`

Examples: 22

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 100.0% | 31.8% | 18.6% | 6.5% | 100.0% | 0.0% |
| lexical_overlap_t0 | 100.0% | 59.1% | 37.9% | 10.2% | 100.0% | 0.0% |
| lexical_overlap_t0p04 | 40.9% | 90.9% | 20.5% | 6.5% | 40.9% | 59.1% |
| lexical_overlap_t0p08 | 13.6% | 90.9% | 4.5% | 1.9% | 13.6% | 86.4% |
| lexical_overlap_t0p12 | 4.5% | 95.5% | 0.0% | 0.2% | 4.5% | 95.5% |

## Decision

Prioritize a learned evidence selector and abstention calibrator. Best lexical variant is `lexical_overlap_t0`, but lexical overlap is still not enough to preserve grounded correctness.
