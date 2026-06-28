# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-v13-support-delta-smoke-eval-v14-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v13-support-delta-v14-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 51 | 20 | 31 | 39.2% | 12 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 18 |
| `unsupported_task_or_experiment` | 17 |
| `counterfactual_answered` | 12 |
| `too_short_or_yes_no` | 12 |
| `unsupported_context_or_annotation` | 11 |
| `invalid_citation_id` | 7 |
| `partial_support` | 4 |
| `unsupported_comparison_or_baseline` | 2 |
| `other_unsupported_claim` | 1 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): Yes, the paper mentions that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as they tend to overestimate the number of anglicisms [E3].
- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): The dataset contains 47,219 claims from kialo.com for 741 controversial topics and their corresponding impact votes. Impact votes are provided by the users of the platform to evaluate how impactful a particular claim ...
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_context_or_annotation, missing_direct_evidence): The dataset contains the following annotations: (1) the argumentative pragmatic context (i.e., kairos), (2) the traits and prior beliefs of the audience, and (3) the credibility and character of the communicator (i.e....
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (invalid; invalid_citation_id, unsupported_task_or_experiment): DialoGPT, GPT2, and GPT2 fine-tuned on Interview, DailyDialog, and CALLHOME.
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, missing_direct_evidence, too_short_or_yes_no): DialoGPT [E3]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; missing_direct_evidence, too_short_or_yes_no): Interview [E1]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382:counterfactual-insufficient` (unsupported; counterfactual_answered, missing_direct_evidence): The transcripts come from CNN, Fox News, MSNBC, and The New York Times. [E1]
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (invalid; invalid_citation_id, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
