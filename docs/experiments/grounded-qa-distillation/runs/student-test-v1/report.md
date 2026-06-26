# Grounded QA Distillation Run

Run: `student-test-v1`

Split: `test`

Examples: 149

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 93.3% over 232 positive and 459 negative candidates.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 96.0% | 36.9% | 19.9% | 7.5% | 96.0% | 0.0% |
| lexical_overlap_t0 | 96.0% | 62.4% | 36.7% | 9.4% | 96.0% | 0.0% |
| lexical_overlap_t0p04 | 46.3% | 88.6% | 18.7% | 7.0% | 46.3% | 56.4% |
| lexical_overlap_t0p08 | 22.8% | 97.3% | 9.5% | 5.7% | 22.8% | 81.2% |
| lexical_overlap_t0p12 | 15.4% | 99.3% | 7.3% | 5.1% | 15.4% | 88.6% |
| learned_selector_top1 | 96.0% | 61.1% | 37.9% | 9.8% | 96.0% | 0.0% |
| learned_selector_top2_t0p35 | 79.2% | 66.8% | 42.2% | 9.9% | 79.2% | 20.8% |
| learned_selector_top2_t0p5 | 75.8% | 68.5% | 38.4% | 10.0% | 75.8% | 25.5% |
| learned_selector_top2_t0p65 | 67.8% | 72.5% | 33.2% | 9.2% | 67.8% | 33.6% |

## Decision

Keep the learned selector as an ablation, not yet the main student. Best lexical variant is `lexical_overlap_t0`; best learned variant is `learned_selector_top1`.
