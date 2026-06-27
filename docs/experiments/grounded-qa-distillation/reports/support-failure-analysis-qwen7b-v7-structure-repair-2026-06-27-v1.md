# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v7-soft-answerability-smoke-eval-v1-structure-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 63 | 26 | 37 | 41.3% | 17 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 22 |
| `counterfactual_answered` | 17 |
| `unsupported_task_or_experiment` | 15 |
| `unsupported_context_or_annotation` | 11 |
| `unsupported_comparison_or_baseline` | 5 |
| `other_unsupported_claim` | 4 |
| `partial_support` | 4 |
| `invalid_citation_id` | 3 |
| `too_short_or_yes_no` | 2 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): Yes. The paper mentions that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as they tend to overestimate the number of anglicisms [E3].
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_context_or_annotation, missing_direct_evidence): The dataset contains annotations for the credibility and character of the communicator (ethos), the traits and prior beliefs of the audience, and the pragmatic context in which the argument is presented (kairos). [E1]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, missing_direct_evidence): They compared to DailyDialog and CALLHOME. [E3]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, unsupported_task_or_experiment): They compared to speaker-agnostic dialog settings. [E1]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; other_unsupported_claim): The interviews fall under the news category of spoken, open-domain, and spontaneous dialog. [E1]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): The transcripts come from news sources. [E3]
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): Yes. The dataset was manually annotated. [E3] mentions 'We curate a subset, Interview 2P, with two roles: a host and a guest, comprising 23K two-party conversations'. [E1] mentions 'To condition on a speaker role, we ...
- `2004.03090:be0b438952048fe6bb91c61ba48e529d784bdcea` (correct_abstention; invalid_citation_id, unsupported_context_or_annotation, missing_direct_evidence): No. The paper does not mention using crowdsourcing for annotations. [E1] [E2] [E3]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
