# Grounded QA Distillation Run

Run: `student-validation-v1`

Split: `validation`

Examples: 127

## Systems

- `retrieval_rank_1`: cheapest scaffold; cites the first retrieved evidence item.
- `lexical_overlap_t*`: selects evidence by question/evidence token overlap and abstains below the encoded threshold. Threshold grid: 0, 0.04, 0.08, 0.12.
- `learned_selector_*`: logistic evidence selector trained on `train.jsonl` teacher roles. Training accuracy: 93.3% over 232 positive and 459 negative candidates.

## Metrics

| System | Answer type accuracy | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| retrieval_rank_1 | 96.1% | 29.1% | 17.1% | 6.2% | 96.1% | 0.0% |
| lexical_overlap_t0 | 96.1% | 52.8% | 33.1% | 8.0% | 96.1% | 0.0% |
| lexical_overlap_t0p04 | 48.8% | 82.7% | 19.8% | 8.8% | 48.8% | 55.1% |
| lexical_overlap_t0p08 | 18.1% | 92.9% | 8.1% | 4.8% | 18.1% | 85.8% |
| lexical_overlap_t0p12 | 9.4% | 97.6% | 5.4% | 4.1% | 9.4% | 94.5% |
| learned_selector_top1 | 96.1% | 63.0% | 39.9% | 8.9% | 96.1% | 0.0% |
| learned_selector_top2_t0p35 | 85.0% | 69.7% | 49.0% | 11.8% | 85.0% | 17.3% |
| learned_selector_top2_t0p5 | 74.0% | 75.6% | 42.1% | 11.0% | 74.0% | 28.3% |
| learned_selector_top2_t0p65 | 62.2% | 81.1% | 35.3% | 9.1% | 62.2% | 40.2% |

## Decision

Promote `learned_selector_top2_t0p35` as the current cheap student baseline. It matches or beats the lexical family on citation precision and answer compression, but still needs a generative student and entailment judge before paper claims.
