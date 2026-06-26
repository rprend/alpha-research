# Grounded QA Distillation Run

Run: `span-temporal-validation-v1`

Split: `temporal_validation`

Train split: `temporal_train`

Examples: 168

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 90.9% over 300 positive and 732 negative candidates.
- `suff_calibrated_*`: learned selector plus separate sufficiency calibrator. Training accuracy: 85.7% over 164 answerable and 80 insufficient examples.
- `suff_compressed_*`: sufficiency-calibrated selector plus phrase-ranked token-salience answer compressor. Compressor vocabulary: 3042 tokens.
- `suff_span_*`: sufficiency-calibrated selector plus supervised logistic answer-span selector. Training accuracy: 50.1% over 222 positive and 1446 negative span candidates.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 69.6% | 28.6% | 25.2% | 8.3% | 69.6% | 0.0% |
| lexical_overlap_t0 | 69.6% | 39.9% | 36.7% | 10.4% | 69.6% | 0.0% |
| lexical_overlap_t0p04 | 60.1% | 47.6% | 19.5% | 5.6% | 60.1% | 50.0% |
| lexical_overlap_t0p08 | 43.5% | 44.7% | 7.6% | 3.4% | 43.5% | 77.4% |
| lexical_overlap_t0p12 | 36.9% | 58.8% | 3.6% | 1.5% | 36.9% | 89.9% |
| learned_selector_top1 | 69.6% | 39.9% | 33.4% | 10.0% | 69.6% | 0.0% |
| learned_selector_top2_t0p35 | 66.1% | 51.1% | 34.5% | 7.9% | 66.1% | 44.0% |
| learned_selector_top2_t0p5 | 63.1% | 54.9% | 29.1% | 6.1% | 63.1% | 51.8% |
| learned_selector_top2_t0p65 | 59.5% | 64.9% | 27.1% | 5.7% | 59.5% | 60.1% |
| suff_calibrated_top2_t0p35 | 67.3% | 48.3% | 40.0% | 8.0% | 67.3% | 46.4% |
| suff_calibrated_top2_t0p5 | 65.5% | 49.4% | 37.0% | 7.7% | 65.5% | 50.6% |
| suff_calibrated_top2_t0p65 | 62.5% | 51.4% | 31.8% | 6.2% | 62.5% | 58.3% |
| suff_compressed_top2_t0p35 | 67.3% | 48.3% | 40.0% | 8.1% | 67.3% | 46.4% |
| suff_compressed_top2_t0p5 | 65.5% | 49.4% | 37.0% | 7.8% | 65.5% | 50.6% |
| suff_compressed_top2_t0p65 | 62.5% | 51.4% | 31.8% | 7.4% | 62.5% | 58.3% |
| suff_span_top2_t0p35 | 67.3% | 48.3% | 40.0% | 7.2% | 67.3% | 46.4% |
| suff_span_top2_t0p5 | 65.5% | 49.4% | 37.0% | 7.1% | 65.5% | 50.6% |
| suff_span_top2_t0p65 | 62.5% | 51.4% | 31.8% | 6.2% | 62.5% | 58.3% |

## Decision

Promote `suff_compressed_top2_t0p35` as the current constrained student: compression improves answer F1 without losing citation recall.
