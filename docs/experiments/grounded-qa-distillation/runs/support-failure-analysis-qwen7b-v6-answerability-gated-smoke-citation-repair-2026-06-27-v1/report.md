# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 34 | 21 | 13 | 61.8% | 4 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `missing_direct_evidence` | 6 |
| `unsupported_context_or_annotation` | 6 |
| `unsupported_task_or_experiment` | 6 |
| `counterfactual_answered` | 4 |
| `partial_support` | 4 |
| `other_unsupported_claim` | 1 |
| `too_short_or_yes_no` | 1 |
| `unsupported_comparison_or_baseline` | 1 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_task_or_experiment, missing_direct_evidence): Yes. The paper mentions that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as they tend to overestimate the number of anglicisms [E3].
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; unsupported_comparison_or_baseline, unsupported_context_or_annotation): The interviews do not fall under a specific news category. The interviews are informal long spoken exchanges between a host and a guest, which are not constrained by any specific topic or category. This is evidenced b...
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (unsupported; unsupported_context_or_annotation, unsupported_task_or_experiment): They evaluated on eight NER tasks: BC5CDR, BC2GM, JNLPBA, GENIA, CONLL03, i2b2, MIMIC-III, and CDRS. [E2]
- `2004.03685:eeaceee98ef1f6c971dac7b0b8930ee8060d71c2` (partial; partial_support, unsupported_task_or_experiment, missing_direct_evidence): They propose two approaches: (1) developing formal definition and evaluation for faithfulness that allows us the freedom to say when a method is sufficiently faithful to be useful in practice; (2) across models and ta...
- `2004.03685:eeaceee98ef1f6c971dac7b0b8930ee8060d71c2:counterfactual-insufficient` (unsupported; counterfactual_answered): They propose a more practical view of faithfulness, calling for a graded criteria that measures the extent and likelihood of an interpretation to be faithful, in practice [E1: §SECREF8]. They also propose that faithfu...
- `2004.03744:66bf0d61ffc321f15e7347aaed191223f4ce4b4a` (unsupported; unsupported_context_or_annotation, missing_direct_evidence, too_short_or_yes_no): 2060 [E3]
- `2004.04228:dfd9302615b27abf8cbef1a2f880a73dd5f0c753` (partial; partial_support): QAGS evaluates QA models of varying quality. Specifically, QAGS trains QA models by fine-tuning different versions of BERT on SQuAD. [E4]
- `2004.04435:e2cfaa2ec89b944bbc46e5edf7753b3018dbdc8f` (unsupported; missing_direct_evidence): No. The AD implementation in ROOT is not used in any deep learning framework. The evidence does not mention any deep learning frameworks. The closest evidence [E2] only mentions that gradients are important in trainin...

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
