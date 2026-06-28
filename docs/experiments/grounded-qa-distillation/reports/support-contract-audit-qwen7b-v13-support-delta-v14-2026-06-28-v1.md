# Support Contract Audit

## Setup

- Prediction run: `joint-action-qwen7b-v13-support-delta-smoke-eval-v14-citation-repair`
- Judge run: `openai-judge-gpt4o-joint-action-qwen7b-v13-support-delta-v14-citation-repair`
- Split: `extended_temporal_future_holdout`
- LLM calls: 0
- Run cost: $0

## Summary

| Answered | Supported answers | Unsupported/invalid answers | Invalid answered judgments | Status |
| ---: | ---: | ---: | ---: | --- |
| 51 | 20 | 31 | 7 | `contract_failures_explain_invalid_judgments` |

## Citation Contract

| Channel | Rows with any | Rows all valid | Rows missing | Rows with invalid ids |
| --- | ---: | ---: | ---: | ---: |
| Top-level citations | 44 | 44 | 7 | 0 |
| Inline answer citations | 44 | 44 | 7 | 0 |
| Claim-table citations | 13 | 13 | 38 | 0 |

## Invalid Judgment Tags

| Tag | Count |
| --- | ---: |
| `missing_inline_citations` | 7 |
| `missing_top_level_citations` | 7 |
| `unsupported_task_or_experiment` | 7 |
| `missing_claim_table_citations` | 5 |
| `missing_direct_evidence` | 4 |
| `too_short_or_yes_no` | 2 |
| `top_level_claim_table_mismatch` | 2 |
| `counterfactual_answered` | 1 |

## Invalid Judgment Examples

- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, unsupported_task_or_experiment): DialoGPT, GPT2, and GPT2 fine-tuned on Interview, DailyDialog, and CALLHOME.
- `2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): The authors focused on the following news outlets: CNN, Fox News, MSNBC, and The New York Times.
- `2004.03354:16535db1d73a9373ffe9d6eedaa2369cefd91ac4` (missing_top_level_citations, missing_inline_citations, top_level_claim_table_mismatch, missing_direct_evidence, unsupported_task_or_experiment, too_short_or_yes_no): PubMed+PMC
- `2004.03744:a08b5018943d4428f067c08077bfff1af3de9703` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, missing_direct_evidence, unsupported_task_or_experiment, too_short_or_yes_no): neutral
- `2004.04478:468eb961215a554ace8088fa9097a7ad239f2d71:counterfactual-insufficient` (counterfactual_answered, missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, missing_direct_evidence, unsupported_task_or_experiment): The paper does not mention any dataset for CDSA task.
- `2004.04721:5bc1dc6ebcb88fd0310b21d2a74939e35a4c1a11` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, missing_direct_evidence, unsupported_task_or_experiment): English, Spanish, Finnish
- `2004.04721:bfc1de5fa4da2f0e301fd22aea19cf01e2bb5b31` (missing_top_level_citations, missing_inline_citations, missing_claim_table_citations, unsupported_task_or_experiment): English, Spanish, and Finnish

Invalid judge verdicts are evidence of output-contract/citation failures unless the prediction has complete valid top-level, inline, and claim-table citations.
