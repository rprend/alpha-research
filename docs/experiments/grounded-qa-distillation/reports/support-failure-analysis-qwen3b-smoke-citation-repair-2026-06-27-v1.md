# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen3b-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen3b-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 54 | 7 | 47 | 13.0% | 16 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `too_short_or_yes_no` | 38 |
| `unsupported_task_or_experiment` | 33 |
| `invalid_citation_id` | 23 |
| `missing_direct_evidence` | 23 |
| `counterfactual_answered` | 16 |
| `unsupported_context_or_annotation` | 9 |
| `partial_support` | 5 |
| `unsupported_comparison_or_baseline` | 3 |

## Examples

- `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no):
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no): [E1],[E4]
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (incorrect_abstention; counterfactual_answered, invalid_citation_id, unsupported_context_or_annotation, unsupported_task_or_experiment, too_short_or_yes_no): [E1],[E2],[E3]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, missing_direct_evidence, too_short_or_yes_no): DialoGPT [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, missing_direct_evidence, too_short_or_yes_no): DialoGPT [E3]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; missing_direct_evidence, too_short_or_yes_no): yes [E1]
- `2004.03090:7625068cc22a095109580b83eff48616387167c2` (invalid; invalid_citation_id, unsupported_task_or_experiment, missing_direct_evidence): {'answer': 'Task 1: Role Modeling', 'citations': ['E2']}
- `2004.03090:7625068cc22a095109580b83eff48616387167c2:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_task_or_experiment, missing_direct_evidence, too_short_or_yes_no): ['speaker role modeling', 'speaker change detection']

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
