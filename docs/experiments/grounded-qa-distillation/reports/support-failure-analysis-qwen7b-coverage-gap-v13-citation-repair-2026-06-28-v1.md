# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-coverage-gap-v13-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 52 | 21 | 31 | 40.4% | 12 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 19 |
| `invalid_citation_id` | 17 |
| `missing_direct_evidence` | 13 |
| `counterfactual_answered` | 12 |
| `too_short_or_yes_no` | 11 |
| `unsupported_context_or_annotation` | 10 |
| `partial_support` | 6 |
| `unsupported_comparison_or_baseline` | 6 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_task_or_experiment, missing_direct_evidence): Yes, the paper mentions other works proposing methods to detect anglicisms in Spanish. The paper states that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as t...
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_comparison_or_baseline, unsupported_context_or_annotation, unsupported_task_or_experiment): The best performing model is the one with flat context representation of length 4, which has an F1 score of 0.891. The baseline model, which uses only the claim, has an F1 score of 0.841. The difference between these ...
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (partial; partial_support, unsupported_comparison_or_baseline): DialoGPT, GPT2, and GPT2 fine-tuned on Interview, DailyDialog, and CALLHOME. [E3] [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, too_short_or_yes_no): DialoGPT [E3]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_task_or_experiment): The transcripts come from CNN, Fox News, MSNBC, and The New York Times.
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (invalid; invalid_citation_id, unsupported_context_or_annotation, unsupported_task_or_experiment): No. The data was collected from public sources and no manual annotation was performed.
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (invalid; invalid_citation_id, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.
- `2004.03354:16535db1d73a9373ffe9d6eedaa2369cefd91ac4` (invalid; invalid_citation_id, missing_direct_evidence, too_short_or_yes_no): PubMed+PMC

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
