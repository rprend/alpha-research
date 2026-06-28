# Support Failure Analysis

## Setup

- Prediction run: `trained-evidence-selector-constructor-final-window-2026-06-27-v1`
- Judge run: `openai-judge-gpt4o-trained-evidence-selector-constructor-final-window-2026-06-27-v1`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 43 | 4 | 39 | 9.3% | 0 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 27 |
| `unsupported_context_or_annotation` | 13 |
| `missing_direct_evidence` | 11 |
| `unsupported_comparison_or_baseline` | 7 |
| `other_unsupported_claim` | 6 |

## Examples

- `2004.03034:6cdd61ebf84aa742155f4554456cc3233b6ae2bf` (unsupported; unsupported_task_or_experiment): Except the thesis, every claim in the argument tree either opposes or supports its parent claim. [E4]
- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (unsupported; unsupported_context_or_annotation): An interesting observation is that, in this dataset, the same claim can have different impact labels depending on the context in which it is presented. [E1]
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): An interesting observation is that, in this dataset, the same claim can have different impact labels depending on the context in which it is presented. [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation, unsupported_task_or_experiment): We evaluated the zero-shot performance of these models on the test splits of these datasets, with perplexities shown in tab:datasetcomparison. [E4]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; unsupported_task_or_experiment): We avoid modeling salutations and sign-offs (which tend to be formulaic, speaker-independent, and specific to the radio station) by restricting the target turns to those with at least three prior turns and two followi...
- `2004.03090:7625068cc22a095109580b83eff48616387167c2` (unsupported; unsupported_task_or_experiment, missing_direct_evidence): These tasks are crucial components to building fluent and role-specific dialog systems, for settings such as healthcare and customer service. [E3]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (invalid; unsupported_task_or_experiment): These role-specific speaker IDs are modeled by a speaker embedding layer of the same dimensions as the transformer hidden state, injected into the transformer input layer. [E4]
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): Hosts each have one ID, while guests share a single ID, allowing us to model idiosyncrasies and interviewing patterns for individual hosts: [E1]

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
