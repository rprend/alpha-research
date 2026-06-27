# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen3b-v4-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen3b-v4-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 45 | 15 | 30 | 33.3% | 10 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 14 |
| `unsupported_task_or_experiment` | 11 |
| `counterfactual_answered` | 10 |
| `partial_support` | 8 |
| `unsupported_context_or_annotation` | 8 |
| `invalid_citation_id` | 7 |
| `unsupported_comparison_or_baseline` | 6 |
| `too_short_or_yes_no` | 3 |
| `other_unsupported_claim` | 1 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (invalid; counterfactual_answered, invalid_citation_id, unsupported_task_or_experiment): The paper mentions other works proposing methods to detect anglicisms in Spanish. Specifically, the paper cites BIBREF32, which addresses the differences between lexical borrowing and code-switching and notes that app...
- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (unsupported; unsupported_context_or_annotation): The dataset includes 47,219 claims from kialo.com for 741 controversial topics, each with impact votes from users indicating the impact of the claim in its context. [E1]
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_comparison_or_baseline, unsupported_context_or_annotation, missing_direct_evidence): The fine-tuned BERT model with flat context representation performs better than the baseline FastText model, especially for claims with limited context. [E1] [E2] [E3]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence, too_short_or_yes_no): DialoGPT [E3] [E4]
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, missing_direct_evidence): The paper compares to simple yet strong models. [E1] [E2]
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_task_or_experiment, too_short_or_yes_no): Biomedical NER [E3]
- `2004.03685:2a859e80d8647923181cb2d8f9a2c67b1c3f4608` (partial; partial_support, invalid_citation_id): Be explicit in what you evaluate. [E2] [E6]
- `2004.03685:2a859e80d8647923181cb2d8f9a2c67b1c3f4608:counterfactual-insufficient` (unsupported; counterfactual_answered, missing_direct_evidence): The linearity assumption is used by methods that consider heat-maps over the input as explanations, particularly popular in NLP. These methods can design 'stress tests' to verify whether they uphold their claims. A fi...

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
