# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-mixed-metric-repair-smoke-eval-v11-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-mixed-metric-v11-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 44 | 19 | 25 | 43.2% | 9 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 15 |
| `missing_direct_evidence` | 14 |
| `too_short_or_yes_no` | 12 |
| `counterfactual_answered` | 9 |
| `unsupported_context_or_annotation` | 8 |
| `invalid_citation_id` | 7 |
| `unsupported_comparison_or_baseline` | 4 |
| `other_unsupported_claim` | 2 |
| `partial_support` | 2 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment): Yes, the paper mentions other works proposing methods to detect anglicisms in Spanish (cited in BIBREF32). [E3]
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (invalid; invalid_citation_id, unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): The dataset contains claims and impact votes. Users can pick one of 5 possible impact labels for a particular claim: no impact, low impact, medium impact, high impact and very high impact.
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_context_or_annotation, missing_direct_evidence): The dataset contains claims, their contexts, and the corresponding labels. [E1]
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26` (invalid; invalid_citation_id, unsupported_comparison_or_baseline, unsupported_context_or_annotation, unsupported_task_or_experiment): The flat representation of the context achieves the highest F1 score. The SVM model with parent quality can achieve significantly higher F1 score than distance from the thesis and linguistic features. The BiLSTM model...
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_comparison_or_baseline, unsupported_task_or_experiment, too_short_or_yes_no): significantly better
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, unsupported_task_or_experiment, missing_direct_evidence): simple yet strong models [E2]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no): Yes
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): BC5CDR, BC2GM, JNLPBA, GENIA, CONLL03, i2b2, MIMIC, and CRAFT [E2]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
