# Grounded QA Distillation Run

Run: `compressed-validation-v1`

Split: `validation`

Examples: 178

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 92.5% over 232 positive and 597 negative candidates.
- `suff_calibrated_*`: learned selector plus separate sufficiency calibrator. Training accuracy: 93.0% over 134 answerable and 65 insufficient examples.
- `suff_compressed_*`: sufficiency-calibrated selector plus phrase-ranked token-salience answer compressor. Compressor vocabulary: 2797 tokens.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 68.5% | 20.8% | 17.8% | 6.4% | 68.5% | 0.0% |
| lexical_overlap_t0 | 68.5% | 37.6% | 34.5% | 8.3% | 68.5% | 0.0% |
| lexical_overlap_t0p04 | 54.5% | 47.9% | 16.5% | 5.0% | 54.5% | 59.0% |
| lexical_overlap_t0p08 | 38.8% | 39.1% | 4.4% | 0.9% | 38.8% | 87.1% |
| lexical_overlap_t0p12 | 34.8% | 50.0% | 1.5% | 0.2% | 34.8% | 95.5% |
| learned_selector_top1 | 68.5% | 45.5% | 42.3% | 9.4% | 68.5% | 0.0% |
| learned_selector_top2_t0p35 | 71.3% | 55.5% | 40.8% | 8.6% | 71.3% | 38.8% |
| learned_selector_top2_t0p5 | 64.0% | 58.3% | 35.0% | 6.1% | 64.0% | 49.4% |
| learned_selector_top2_t0p65 | 62.9% | 61.0% | 32.0% | 6.3% | 62.9% | 53.9% |
| suff_calibrated_top2_t0p35 | 69.7% | 53.4% | 48.5% | 8.1% | 69.7% | 42.7% |
| suff_calibrated_top2_t0p5 | 67.4% | 53.1% | 46.0% | 7.5% | 67.4% | 44.9% |
| suff_calibrated_top2_t0p65 | 65.2% | 53.3% | 42.6% | 6.5% | 65.2% | 48.3% |
| suff_compressed_top2_t0p35 | 69.7% | 53.4% | 48.5% | 9.1% | 69.7% | 42.7% |
| suff_compressed_top2_t0p5 | 67.4% | 53.1% | 46.0% | 8.4% | 67.4% | 44.9% |
| suff_compressed_top2_t0p65 | 65.2% | 53.3% | 42.6% | 7.5% | 65.2% | 48.3% |

## Decision

Promote `suff_compressed_top2_t0p35` as the current constrained student: compression improves answer F1 without losing citation recall.
