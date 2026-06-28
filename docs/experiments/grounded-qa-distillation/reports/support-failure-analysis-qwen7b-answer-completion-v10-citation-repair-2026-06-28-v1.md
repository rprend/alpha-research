# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-answer-completion-repair-smoke-eval-v10-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-answer-completion-v10-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 22 | 7 | 15 | 31.8% | 5 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 12 |
| `invalid_citation_id` | 9 |
| `too_short_or_yes_no` | 9 |
| `missing_direct_evidence` | 6 |
| `counterfactual_answered` | 5 |
| `partial_support` | 4 |
| `unsupported_context_or_annotation` | 1 |

## Examples

- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no):
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no):
- `2004.03090:d68cc9aaf0466b97354600a5646c3be4512fc096` (partial; partial_support, unsupported_task_or_experiment, missing_direct_evidence): role modeling, role change detection [E2] [E4]
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (invalid; invalid_citation_id, unsupported_task_or_experiment, missing_direct_evidence, too_short_or_yes_no):
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_task_or_experiment, missing_direct_evidence, too_short_or_yes_no):
- `2004.03685:2a859e80d8647923181cb2d8f9a2c67b1c3f4608:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, missing_direct_evidence): We must develop formal definition and evaluation for faithfulness that allows us the freedom to say when a method is sufficiently faithful to be useful in practice. [E1] Defining Faithfulness ::: Assumption 3 (The Lin...
- `2004.03685:eeaceee98ef1f6c971dac7b0b8930ee8060d71c2:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_task_or_experiment): We propose a more practical view of faithfulness, calling for a graded criteria that measures the extent and likelihood of an interpretation to be faithful, in practice. [E1:E1] We also propose that faithfulness evalu...
- `2004.03744:f33236ebd6f5a9ccb9b9dbf05ac17c3724f93f91` (invalid; invalid_citation_id, unsupported_task_or_experiment, too_short_or_yes_no):

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
