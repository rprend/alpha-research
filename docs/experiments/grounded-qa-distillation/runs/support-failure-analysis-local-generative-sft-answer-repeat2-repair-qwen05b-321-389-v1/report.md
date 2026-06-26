# Support Failure Analysis

## Setup

- Prediction run: `citation-contract-repair-local-generative-sft-answer-repeat2-mini-negative-temporal-qwen05b-321-389-v1`
- Judge run: `openai-judge-gpt4o-local-generative-sft-answer-repeat2-repair-qwen05b-321-389-v1`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 40 | 2 | 38 | 5.0% | 12 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 24 |
| `unsupported_task_or_experiment` | 16 |
| `partial_support` | 13 |
| `counterfactual_answered` | 12 |
| `unsupported_context_or_annotation` | 10 |
| `unsupported_comparison_or_baseline` | 6 |
| `too_short_or_yes_no` | 4 |
| `invalid_citation_id` | 3 |

## Examples

- `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` (unsupported; unsupported_comparison_or_baseline, missing_direct_evidence): The models that rely only on claim-specific linguistic features are used as baselines. [E2]
- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (partial; partial_support, unsupported_context_or_annotation, unsupported_task_or_experiment): The evidence packs provide datasets containing claims and impact votes, along with information about the context in which these claims were evaluated. The introduction discusses the role of pragmatic and discourse con...
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (partial; partial_support, unsupported_context_or_annotation, missing_direct_evidence): Annotations include claims, impact votes, and the context in which these impacts occur. [E1] [E2] [E3] [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, unsupported_task_or_experiment, missing_direct_evidence): The authors compared two baselines: Speaker Role Modeling (SRM) and Speaker Change Detection (SCD), using Interview as a benchmark. [E2]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; missing_direct_evidence): The interviews do not fall under a specific news category. [E2]
- `2004.03090:7625068cc22a095109580b83eff48616387167c2` (partial; partial_support, unsupported_task_or_experiment, missing_direct_evidence): The experiments were conducted on three tasks: Speaker role modeling and speaker role prediction. [E2] [E3]
- `2004.03090:7625068cc22a095109580b83eff48616387167c2:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_task_or_experiment, missing_direct_evidence): The evidence packs contain information about the experiments conducted on task 1: Role Modeling. [E1]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): The transcripts come from related works, structured approaches, dialog modeling, and interview. [E1]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
