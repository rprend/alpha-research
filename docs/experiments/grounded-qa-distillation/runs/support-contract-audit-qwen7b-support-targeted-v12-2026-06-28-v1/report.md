# Support Contract Audit

## Setup

- Prediction run: `joint-action-qwen7b-support-targeted-planning-smoke-eval-v12-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-support-targeted-v12-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0

## Summary

| Answered | Supported answers | Unsupported/invalid answers | Invalid answered judgments | Status |
| ---: | ---: | ---: | ---: | --- |
| 41 | 11 | 30 | 19 | `contract_failures_explain_invalid_judgments` |

## Citation Contract

| Channel | Rows with any | Rows all valid | Rows missing | Rows with invalid ids |
| --- | ---: | ---: | ---: | ---: |
| Top-level citations | 22 | 22 | 19 | 0 |
| Inline answer citations | 22 | 22 | 19 | 0 |
| Claim-table citations | 9 | 9 | 32 | 0 |

## Invalid Judgment Tags

| Tag | Count |
| --- | ---: |
| `missing_inline_citations` | 19 |
| `missing_top_level_citations` | 19 |
| `unsupported_task_or_experiment` | 19 |
| `missing_claim_table_citations` | 14 |
| `too_short_or_yes_no` | 8 |
| `top_level_claim_table_mismatch` | 5 |
| `counterfactual_answered` | 4 |
| `missing_direct_evidence` | 4 |

## Invalid Judgment Examples

- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, missing_direct_evidence, unsupported_task_or_experiment): The dataset contains claims and their corresponding impact votes. Impact votes are provided by the users of the platform to evaluate how impactful a particular claim is. Users can pick one of 5 possible impact labels ...
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, unsupported_task_or_experiment): DialoGPT, GPT2, and GPT2 fine-tuned on Interview, DailyDialog, and CALLHOME.
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): National Public Radio (NPR)
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): BC5CDR, BC2GM, JNLPBA, GENIA, BioNLP-ST, i2b2, MIMIC-III, and CRAFT.
- `2004.03685:2a859e80d8647923181cb2d8f9a2c67b1c3f4608` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, missing_direct_evidence, unsupported_task_or_experiment): Be explicit in what you evaluate.
- `2004.03744:0c557b408183630d1c6c325b5fb9ff1573661290` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 0.16%
- `2004.03744:0c557b408183630d1c6c325b5fb9ff1573661290:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 0.019
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 100%
- `2004.03744:66bf0d61ffc321f15e7347aaed191223f4ce4b4a` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 2,060

Invalid judge verdicts are evidence of output-contract/citation failures unless the prediction has complete valid top-level, inline, and claim-table citations.
