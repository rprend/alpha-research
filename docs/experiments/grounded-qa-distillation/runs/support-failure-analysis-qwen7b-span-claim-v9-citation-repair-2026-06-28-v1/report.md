# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-span-claim-construction-smoke-eval-v9-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-span-claim-v9-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 28 | 14 | 14 | 50.0% | 2 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `too_short_or_yes_no` | 8 |
| `unsupported_task_or_experiment` | 7 |
| `unsupported_context_or_annotation` | 3 |
| `counterfactual_answered` | 2 |
| `missing_direct_evidence` | 2 |
| `other_unsupported_claim` | 2 |
| `partial_support` | 2 |
| `unsupported_comparison_or_baseline` | 2 |
| `invalid_citation_id` | 1 |

## Examples

- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment, too_short_or_yes_no): impact votes [E4]
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26` (partial; partial_support, unsupported_context_or_annotation, unsupported_task_or_experiment, too_short_or_yes_no): 55.98% [E2]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, missing_direct_evidence, too_short_or_yes_no): DailyDialog, CALLHOME [E3] [E4]
- `2004.03685:d4b9cdb4b2dfda1e0d96ab6c3b5e2157fd52685e` (unsupported; unsupported_task_or_experiment): The Model Assumption, The Prediction Assumption, and The Plausibility Assumption. [E2] [E5]
- `2004.03685:eeaceee98ef1f6c971dac7b0b8930ee8060d71c2` (partial; partial_support, unsupported_task_or_experiment): We propose the following challenge to the community: We must develop formal definition and evaluation for faithfulness that allows us the freedom to say when a method is sufficiently faithful to be useful in practice....
- `2004.03744:0c557b408183630d1c6c325b5fb9ff1573661290` (unsupported; unsupported_task_or_experiment, too_short_or_yes_no): 0.16% [E3]
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd` (unsupported; too_short_or_yes_no): 2 [E2]
- `2004.03744:a08b5018943d4428f067c08077bfff1af3de9703` (unsupported; unsupported_comparison_or_baseline, too_short_or_yes_no): neutral [E4]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
