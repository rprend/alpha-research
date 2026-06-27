# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-v4-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v4-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 35 | 23 | 12 | 65.7% | 3 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 5 |
| `unsupported_context_or_annotation` | 4 |
| `unsupported_task_or_experiment` | 4 |
| `counterfactual_answered` | 3 |
| `partial_support` | 3 |
| `unsupported_comparison_or_baseline` | 3 |
| `invalid_citation_id` | 1 |
| `too_short_or_yes_no` | 1 |

## Examples

- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_comparison_or_baseline, unsupported_context_or_annotation): The results are better than the baseline models. The F1 score of the BERT model with flat context representation is significantly higher than the BERT model with only the claim for claims with context length 1, 3, and...
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (unsupported; unsupported_comparison_or_baseline): They compared to GPT2, DialoGPT, and pre-trained transformers fine-tuned on DailyDialog and CALLHOME. [E3] [E4]
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): They evaluated on eight NER tasks: BC5CDR, BC2GM, JNLPBA, GENIA, CONLL03, i2b2, MIMIC-III, and CDRS. [E2]
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd` (unsupported; too_short_or_yes_no): 28912 [E2]
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753` (unsupported; unsupported_context_or_annotation, missing_direct_evidence): The following models are evaluated with QAGS: bert-base, bert-large, and bert-large-wwm [E4].
- `2004.04435:e2cfaa2ec89b944bbc46e5edf7753b3018dbdc8f` (unsupported; missing_direct_evidence): No. The AD implementation in ROOT is not used in any deep learning framework. The evidence does not mention any deep learning frameworks using the AD implementation in ROOT. [E1] [E2] [E3]
- `2004.04498:2749fb1725a2c4bdba5848e2fc424a43e7c4be51` (invalid; invalid_citation_id, unsupported_context_or_annotation, unsupported_task_or_experiment): The set of trusted, gender-balanced examples is selected from a handcrafted profession dataset. This dataset contains 194 professions, giving 388 sentences in a gender-balanced set. Each profession is from a list coll...
- `2004.04498:cf82251a6a5a77e29627560eb7c05c3eddc20825` (partial; partial_support): Lattice rescoring improves inference by creating gender-inflected search spaces which can be rescored by the adapted model. This approach can reduce gender bias in machine translation while maintaining general transla...

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
