# Grounded QA Distillation Run

Run: `temporal-test-v1`

Split: `temporal_test`

Train split: `temporal_train`

Examples: 172

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 90.9% over 300 positive and 732 negative candidates.
- `suff_calibrated_*`: learned selector plus separate sufficiency calibrator. Training accuracy: 85.7% over 164 answerable and 80 insufficient examples.
- `suff_compressed_*`: sufficiency-calibrated selector plus phrase-ranked token-salience answer compressor. Compressor vocabulary: 3042 tokens.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 68.6% | 24.4% | 19.5% | 6.4% | 68.6% | 0.0% |
| lexical_overlap_t0 | 68.6% | 39.0% | 33.3% | 7.9% | 68.6% | 0.0% |
| lexical_overlap_t0p04 | 57.6% | 52.5% | 14.1% | 4.1% | 57.6% | 64.5% |
| lexical_overlap_t0p08 | 39.0% | 58.8% | 3.0% | 0.9% | 39.0% | 90.1% |
| lexical_overlap_t0p12 | 36.6% | 72.7% | 2.0% | 0.6% | 36.6% | 93.6% |
| learned_selector_top1 | 68.6% | 41.3% | 36.9% | 5.5% | 68.6% | 0.0% |
| learned_selector_top2_t0p35 | 68.6% | 53.8% | 40.5% | 5.6% | 68.6% | 39.5% |
| learned_selector_top2_t0p5 | 66.9% | 53.3% | 32.3% | 5.3% | 66.9% | 47.1% |
| learned_selector_top2_t0p65 | 62.8% | 54.5% | 27.2% | 3.7% | 62.8% | 54.7% |
| suff_calibrated_top2_t0p35 | 68.6% | 49.5% | 45.1% | 6.6% | 68.6% | 40.7% |
| suff_calibrated_top2_t0p5 | 66.9% | 50.5% | 41.9% | 6.4% | 66.9% | 45.9% |
| suff_calibrated_top2_t0p65 | 66.3% | 52.3% | 39.3% | 5.9% | 66.3% | 50.0% |
| suff_compressed_top2_t0p35 | 68.6% | 49.5% | 45.1% | 6.3% | 68.6% | 40.7% |
| suff_compressed_top2_t0p5 | 66.9% | 50.5% | 41.9% | 6.0% | 66.9% | 45.9% |
| suff_compressed_top2_t0p65 | 66.3% | 52.3% | 39.3% | 5.4% | 66.3% | 50.0% |

## Decision

Keep the learned selector as an ablation, not yet the main student. Best lexical variant is `lexical_overlap_t0`; best learned variant is `learned_selector_top2_t0p35`.
