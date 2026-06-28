# Support Failure Analysis

## Setup

- Prediction run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-support-targeted-v12-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0.0000000

## Summary

| Answered predictions | Supported | Unsupported | Support rate | Counterfactual unsupported |
| ---: | ---: | ---: | ---: | ---: |
| 41 | 11 | 30 | 26.8% | 9 |

## Failure Tags

| Tag | Count |
| --- | ---: |
| `unsupported_task_or_experiment` | 25 |
| `invalid_citation_id` | 19 |
| `missing_direct_evidence` | 11 |
| `too_short_or_yes_no` | 11 |
| `counterfactual_answered` | 9 |
| `unsupported_context_or_annotation` | 5 |
| `partial_support` | 3 |
| `unsupported_comparison_or_baseline` | 2 |

## Examples

- `2004.02929:bbc58b193c08ccb2a1e8235a36273785a3b375fb:counterfactual-insufficient` (partial; counterfactual_answered, partial_support, unsupported_task_or_experiment, missing_direct_evidence): Yes, the paper mentions other works proposing methods to detect anglicisms in Spanish. The paper states that applying code-switching models to lexical borrowing detection has previously proved to be unsuccessful, as t...
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (invalid; invalid_citation_id, unsupported_context_or_annotation, unsupported_task_or_experiment, missing_direct_evidence): The dataset contains claims and their corresponding impact votes. Impact votes are provided by the users of the platform to evaluate how impactful a particular claim is. Users can pick one of 5 possible impact labels ...
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (invalid; invalid_citation_id, unsupported_task_or_experiment): DialoGPT, GPT2, and GPT2 fine-tuned on Interview, DailyDialog, and CALLHOME.
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d:counterfactual-insufficient` (unsupported; counterfactual_answered, unsupported_comparison_or_baseline, missing_direct_evidence, too_short_or_yes_no): DialoGPT [E3]
- `2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec` (unsupported; missing_direct_evidence, too_short_or_yes_no): Interview [E1]
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (invalid; invalid_citation_id, unsupported_task_or_experiment): National Public Radio (NPR)
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (invalid; invalid_citation_id, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (invalid; invalid_citation_id, unsupported_task_or_experiment): BC5CDR, BC2GM, JNLPBA, GENIA, BioNLP-ST, i2b2, MIMIC-III, and CRAFT.

Tags are heuristic summaries of GPT-4o judge notes and unsupported claims; they are for dataset-design diagnosis, not final scoring.
