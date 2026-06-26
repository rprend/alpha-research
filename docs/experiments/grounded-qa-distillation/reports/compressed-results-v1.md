# Compressed Answer Results V1

## Setup

Run ids:

- `compressed-validation-v1`
- `compressed-test-v1`

This run adds `suff_compressed_*`, a dependency-free phrase-ranked answer compressor on top of the sufficiency-calibrated selector. The compressor is trained from `train.jsonl` by comparing tokens in gold evidence against tokens in teacher answers, then selecting the highest-scoring sentence or clause from each selected evidence item.

The trained compressor has:

- 199 training examples,
- 2,797 vocabulary entries,
- 1,631 positive evidence tokens,
- 10,040 negative evidence tokens.

## Key Metrics

Validation:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lexical_overlap_t0` | 37.6% | 34.5% | 8.3% | 68.5% | 0.0% |
| `suff_calibrated_top2_t0p35` | 53.4% | 48.5% | 8.1% | 69.7% | 42.7% |
| `suff_compressed_top2_t0p35` | 53.4% | 48.5% | 9.1% | 69.7% | 42.7% |

Test:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lexical_overlap_t0` | 44.9% | 38.3% | 9.8% | 69.1% | 0.0% |
| `suff_calibrated_top2_t0p35` | 45.7% | 42.1% | 7.8% | 68.6% | 38.2% |
| `suff_compressed_top2_t0p35` | 45.7% | 42.1% | 7.2% | 68.6% | 38.2% |

## Interpretation

The phrase-ranked compressor improves validation answer overlap without changing selection, citation, or abstention behavior, but it does not generalize to test. A representative failure is selecting a broad dataset-description sentence when the reference answer asks for a short count or value. The selected evidence is often relevant, but the answer span is not specific enough.

The current best scaffold remains `suff_calibrated_top2_t0p35` for citation recall and abstention calibration. The compressor is retained as a negative ablation showing that answer synthesis needs either model-facing fine-tuning data or a stronger supervised span-generation component.
