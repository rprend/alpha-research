# Grounded QA Distillation Run

Run: `baseline-test-v1`

Split: `test`

Examples: 26

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 96.2% | 30.8% | 12.8% | 4.3% | 96.2% | 0.0% |
| lexical_overlap_t0 | 96.2% | 65.4% | 30.1% | 11.0% | 96.2% | 0.0% |
| lexical_overlap_t0p04 | 57.7% | 92.3% | 24.0% | 12.5% | 57.7% | 46.2% |
| lexical_overlap_t0p08 | 38.5% | 96.2% | 13.5% | 9.6% | 38.5% | 65.4% |
| lexical_overlap_t0p12 | 26.9% | 100.0% | 11.5% | 8.2% | 26.9% | 76.9% |

## Decision

Prioritize a learned evidence selector and abstention calibrator. Best lexical variant is `lexical_overlap_t0`, but lexical overlap is still not enough to preserve grounded correctness.
