# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v5-coverage-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 44 | 22 | 22 | 50.0% | 10 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 12 |
| `counterfactual_answered` | 10 |
| `missing_direct_evidence` | 10 |
| `unsupported_comparison_or_baseline` | 6 |
| `unsupported_context_or_annotation` | 6 |
| `partial_support` | 4 |
| `invalid_citation_id` | 2 |
| `other_unsupported_claim` | 1 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): The paper does not mention any other works proposing methods to detect anglicisms in Spanish. It mentions that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as...
- `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` (unsupported; unsupported_comparison_or_baseline): The SVM with RBF kernel is used as a baseline that relies only on claim-specific linguistic features [E3].
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_context_or_annotation, missing_direct_evidence): The dataset includes annotations for communicator credibility and character (ethos), audience traits and prior beliefs, and pragmatic context (kairos). [E1]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, unsupported_task_or_experiment, missing_direct_evidence): They compared to speaker-agnostic dialog settings [E1].
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; other_unsupported_claim): The interviews do not fall under a specific news category. The interviews are natural open-domain dialog in both simple daily conversation and informal long spoken exchanges. [E4]
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (unsupported; unsupported_context_or_annotation, missing_direct_evidence): No. The dataset was automatically collected from public sources. Interviews were transcribed automatically. No manual annotation was reported. [E3]
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): They focused on interview settings. Interview's scale, spoken origins, role diversity, and complex utterances make it a better source for grounded open-domain conversations. -- E1 We investigate how appropriate such d...
- `2004.03090:d68cc9aaf0466b97354600a5646c3be4512fc096` (invalid; invalid_citation_id, unsupported_task_or_experiment): Role modeling and role change detection. The paper directly states the two dialog tasks experimented on: role modeling and role change detection. [E2] The paper also describes the role modeling task in detail, includi...

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
