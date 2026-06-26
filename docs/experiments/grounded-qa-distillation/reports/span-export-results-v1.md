# Span Export Results V1

## Setup

This run adds two artifacts:

- Model-facing SFT exports in `exports/*.sft.jsonl`
- `suff_span_*`, a supervised logistic answer-span selector trained on answer-like spans from `temporal_train`

Export counts:

| Split | Examples | Grounded answers | Abstentions |
| --- | ---: | ---: | ---: |
| `temporal_train` | 244 | 164 | 80 |
| `temporal_validation` | 168 | 117 | 51 |
| `temporal_test` | 172 | 118 | 54 |

Each exported row includes chat-style `messages` plus structured `input` and `target` fields. The input contains question, compact evidence pack, document metadata, and temporal date fields. The target contains answer type, cited answer, citations, claim table, and abstention reason.

## Key Metrics

Temporal validation:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `suff_calibrated_top2_t0p35` | 48.3% | 40.0% | 8.0% | 67.3% | 46.4% |
| `suff_compressed_top2_t0p35` | 48.3% | 40.0% | 8.1% | 67.3% | 46.4% |
| `suff_span_top2_t0p35` | 48.3% | 40.0% | 7.2% | 67.3% | 46.4% |

Temporal test:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `suff_calibrated_top2_t0p35` | 49.5% | 45.1% | 6.6% | 68.6% | 40.7% |
| `suff_compressed_top2_t0p35` | 49.5% | 45.1% | 6.3% | 68.6% | 40.7% |
| `suff_span_top2_t0p35` | 49.5% | 45.1% | 5.2% | 68.6% | 40.7% |

## Interpretation

The SFT export is the right next artifact for training a genuine cheaper model. The deterministic supervised span selector is not. It preserves the calibrated selector's citation and abstention behavior, but it reduces answer F1 on both temporal validation and temporal test.

The failure is informative: even supervised span labels over gold evidence do not reliably recover QASPER-style answers once the selected evidence is imperfect and the answer may require synthesis across multiple spans. The next system should train or call a small generative model on the exported data, then evaluate it with the same temporal split and citation metrics.
