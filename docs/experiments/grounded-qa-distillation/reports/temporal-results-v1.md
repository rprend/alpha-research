# Temporal Results V1

## Setup

Temporal data:

- `temporal_train`: 53 papers, 244 examples, 2016-03 through 2019-04
- `temporal_validation`: 33 papers, 168 examples, 2019-05 through 2019-10
- `temporal_test`: 34 papers, 172 examples, 2019-11 through 2020-04

The split is inferred from arXiv-style QASPER paper ids. It is month-disjoint and paper-disjoint: every paper and every inferred publication month appears in exactly one temporal split.

Runs:

- `temporal-validation-v1`: train on `temporal_train`, evaluate on `temporal_validation`
- `temporal-test-v1`: train on `temporal_train`, evaluate on `temporal_test`

## Key Metrics

Temporal validation:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lexical_overlap_t0` | 39.9% | 36.7% | 10.4% | 69.6% | 0.0% |
| `learned_selector_top2_t0p35` | 51.1% | 34.5% | 7.9% | 66.1% | 44.0% |
| `suff_calibrated_top2_t0p35` | 48.3% | 40.0% | 8.0% | 67.3% | 46.4% |
| `suff_compressed_top2_t0p35` | 48.3% | 40.0% | 8.1% | 67.3% | 46.4% |

Temporal test:

| System | Citation precision | Citation recall | Answer token F1 | Abstention accuracy | Abstention rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| `lexical_overlap_t0` | 39.0% | 33.3% | 7.9% | 68.6% | 0.0% |
| `learned_selector_top2_t0p35` | 53.8% | 40.5% | 5.6% | 68.6% | 39.5% |
| `suff_calibrated_top2_t0p35` | 49.5% | 45.1% | 6.6% | 68.6% | 40.7% |
| `suff_compressed_top2_t0p35` | 49.5% | 45.1% | 6.3% | 68.6% | 40.7% |

## Interpretation

The chronological split makes the evolving-KB setting more credible than the earlier split-as-time proxy. On temporal test, the sufficiency-calibrated student improves citation recall over no-abstain lexical overlap by 11.8 points and citation precision by 10.5 points. This supports the central distillation hypothesis for evidence selection and sufficiency.

The same result also sharpens the main weakness: answer token F1 remains below lexical overlap because selected evidence is cited but not synthesized into concise answer spans. The compressed ablation again fails to fix this on test. The next paper-critical step should be model-facing supervised answer generation or span extraction, not additional deterministic evidence-selection tuning.

## Limitations

- QASPER dates are inferred from arXiv-style ids rather than trusted metadata fields.
- This is still a public scientific-paper corpus, not a private enterprise knowledge base.
- The current student is a cheap scaffold, not yet a small generative model.
