# Support Contract Audit

## Setup

- Prediction run: `joint-action-qwen7b-qwen-coverage-gap-scaffold-smoke-eval-v13-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-coverage-gap-v13-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0

## Summary

| Answered | Supported answers | Unsupported/invalid answers | Invalid answered judgments | Status |
| ---: | ---: | ---: | ---: | --- |
| 52 | 21 | 31 | 17 | `contract_failures_explain_invalid_judgments` |

## Citation Contract

| Channel | Rows with any | Rows all valid | Rows missing | Rows with invalid ids |
| --- | ---: | ---: | ---: | ---: |
| Top-level citations | 35 | 35 | 17 | 0 |
| Inline answer citations | 35 | 35 | 17 | 0 |
| Claim-table citations | 18 | 18 | 34 | 0 |

## Invalid Judgment Tags

| Tag | Count |
| --- | ---: |
| `missing_inline_citations` | 17 |
| `missing_top_level_citations` | 17 |
| `unsupported_task_or_experiment` | 16 |
| `missing_claim_table_citations` | 13 |
| `counterfactual_answered` | 6 |
| `too_short_or_yes_no` | 6 |
| `missing_direct_evidence` | 4 |
| `top_level_claim_table_mismatch` | 4 |

## Invalid Judgment Examples

- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The best performing model is the one with flat context representation of length 4, which has an F1 score of 0.891. The baseline model, which uses only the claim, has an F1 score of 0.841. The difference between these ...
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The transcripts come from CNN, Fox News, MSNBC, and The New York Times.
- `2004.03090:a97137318025a6642ed0634f7159255270ba3d4f` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): No. The data was collected from public sources and no manual annotation was performed.
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.
- `2004.03354:16535db1d73a9373ffe9d6eedaa2369cefd91ac4` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, missing_direct_evidence, too_short_or_yes_no): PubMed+PMC
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, missing_direct_evidence, unsupported_task_or_experiment): BC5CDR, BC2GM, JNLPBA, GENIA, i2b2, MIMIC, ACE, and CONLL.
- `2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The eight NER tasks were: BC5CDR, BC4CHEMD, BC4FUNCT, BC4GAD, BC5PI, BC5PT, BC5BP, and BC5MM.
- `2004.03744:0c557b408183630d1c6c325b5fb9ff1573661290` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 0.16%
- `2004.03744:0c557b408183630d1c6c325b5fb9ff1573661290:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 0.0196
- `2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment, too_short_or_yes_no): 18,915

Invalid judge verdicts are evidence of output-contract/citation failures unless the prediction has complete valid top-level, inline, and claim-table citations.
