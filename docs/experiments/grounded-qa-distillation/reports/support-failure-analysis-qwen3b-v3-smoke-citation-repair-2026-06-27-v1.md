# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen3b-v3-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen3b-v3-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 46 | 15 | 31 | 32.6% | 10 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 17 |
| `unsupported_context_or_annotation` | 16 |
| `unsupported_task_or_experiment` | 11 |
| `counterfactual_answered` | 10 |
| `partial_support` | 8 |
| `unsupported_comparison_or_baseline` | 8 |
| `too_short_or_yes_no` | 6 |
| `other_unsupported_claim` | 1 |

## Examples

- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (unsupported; unsupported_context_or_annotation, missing_direct_evidence): The dataset contains 47,219 claims from kialo.com for 741 controversial topics and their corresponding impact votes. Impact votes are provided by the users of the platform to evaluate how impactful a particular claim ...
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_context_or_annotation, missing_direct_evidence, too_short_or_yes_no): BERT model [E1] [E2] [E3]
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation, missing_direct_evidence): The flat representation of the context achieves the highest F1 score. It may be more difficult for the models with a larger number of parameters to perform better than the flat representation since the dataset is smal...
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, unsupported_context_or_annotation): The BERT model with flat context representation for claims with context length 1, 2, 3, and 4 performs significantly better than the BERT model with claim only. [E1] [E2] [E3]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation, too_short_or_yes_no): DialoGPT [E3] [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline): The authors compared their work to DialoGPT. [E3]
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): The paper focuses on the Interview dataset, which is a new high-quality large-scale open-domain conversational dataset grounded in interview settings with annotations for specific speaker roles. [E1] [E2]
- `2004.03090:d038e5d2a6f85e68422caaf8b96cb046db6599fa` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): Annotation was done by providing speaker role information for each turn in the dataset. [E2] [E3]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
