# Grounded QA Distillation Run

Run: `calibrated-test-v1`

Split: `test`

Examples: 207

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 92.5% over 232 positive and 597 negative candidates.
- `suff_calibrated_*`: learned selector plus separate sufficiency calibrator. Training accuracy: 93.0% over 134 answerable and 65 insufficient examples.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 69.1% | 26.6% | 20.7% | 7.8% | 69.1% | 0.0% |
| lexical_overlap_t0 | 69.1% | 44.9% | 38.3% | 9.8% | 69.1% | 0.0% |
| lexical_overlap_t0p04 | 56.0% | 63.2% | 16.0% | 3.8% | 56.0% | 63.3% |
| lexical_overlap_t0p08 | 43.0% | 77.4% | 5.7% | 1.8% | 43.0% | 85.0% |
| lexical_overlap_t0p12 | 39.1% | 94.1% | 3.4% | 1.2% | 39.1% | 91.8% |
| learned_selector_top1 | 69.1% | 41.1% | 36.9% | 9.0% | 69.1% | 0.0% |
| learned_selector_top2_t0p35 | 69.6% | 48.9% | 36.7% | 7.2% | 69.6% | 36.2% |
| learned_selector_top2_t0p5 | 67.1% | 50.4% | 31.4% | 6.9% | 67.1% | 42.5% |
| learned_selector_top2_t0p65 | 62.3% | 50.5% | 26.7% | 6.0% | 62.3% | 50.2% |
| suff_calibrated_top2_t0p35 | 68.6% | 45.7% | 42.1% | 7.8% | 68.6% | 38.2% |
| suff_calibrated_top2_t0p5 | 68.6% | 46.0% | 41.8% | 7.8% | 68.6% | 39.1% |
| suff_calibrated_top2_t0p65 | 67.6% | 47.1% | 40.3% | 7.7% | 67.6% | 42.0% |

## Decision

Keep the learned selector as an ablation, not yet the main student. Best lexical variant is `lexical_overlap_t0`; best learned variant is `learned_selector_top2_t0p35`.
