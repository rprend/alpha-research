# Oracle-Gap Repair Audit

Generated: 2026-06-28T02:40:04.027Z

Status: `oracle_gap_partly_recoverable_with_planning`

## Summary

| Examples | High recoverability | Partial recoverability | Low recoverability | Qwen partial attempts | All Qwen abstained |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 13 | 4 | 3 | 6 | 3 | 1 |

## Bucket Counts

| Bucket | Count |
| --- | ---: |
| table_metric_or_numeric_answer | 13 |
| low_recoverability_from_gold_evidence_text | 6 |
| multi_evidence_reference_answer | 6 |
| high_recoverability_single_evidence_span | 4 |
| explanatory_or_synthesis_question | 3 |
| partial_recoverability_single_evidence_span | 3 |
| qwen_attempt_contains_partial_answer | 3 |
| all_qwen_policies_abstained | 1 |

## Rows

| Example | Gold span F1 | Any span F1 | Buckets | Recommended signal |
| --- | ---: | ---: | --- | --- |
| 2004.03090:369d7bc5351409910c7a5e05c0cbb5abab8e50ec | 0.000 | 0.000 | low_recoverability_from_gold_evidence_text, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.03090:c66e0aa86b59bbf9e6a1dc725fb9785473bfa137 | 0.800 | 0.800 | high_recoverability_single_evidence_span, table_metric_or_numeric_answer | Add extractive answer-span planning targets for this row family before free-form generation. |
| 2004.03354:1d3e914d0890fc09311a70de0b20974bf7f0c9fe | 0.000 | 0.000 | low_recoverability_from_gold_evidence_text, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.03685:d4b9cdb4b2dfda1e0d96ab6c3b5e2157fd52685e | 0.436 | 0.436 | partial_recoverability_single_evidence_span, multi_evidence_reference_answer, table_metric_or_numeric_answer, qwen_attempt_contains_partial_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.03744:5dfa59c116e0ceb428efd99bab19731aa3df4bbd | 0.435 | 0.500 | partial_recoverability_single_evidence_span, multi_evidence_reference_answer, table_metric_or_numeric_answer, explanatory_or_synthesis_question, qwen_attempt_contains_partial_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.04060:2fec84a62b4028bbe6500754d9c058eefbc24d9a | 0.333 | 0.333 | low_recoverability_from_gold_evidence_text, multi_evidence_reference_answer, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.04435:d353a6bbdc66be9298494d0c853e0d8d752dec4b | 1.000 | 1.000 | high_recoverability_single_evidence_span, table_metric_or_numeric_answer, explanatory_or_synthesis_question | Add extractive answer-span planning targets for this row family before free-form generation. |
| 2004.04498:2749fb1725a2c4bdba5848e2fc424a43e7c4be51 | 0.621 | 0.621 | high_recoverability_single_evidence_span, multi_evidence_reference_answer, table_metric_or_numeric_answer, explanatory_or_synthesis_question, qwen_attempt_contains_partial_answer | Add extractive answer-span planning targets for this row family before free-form generation. |
| 2004.04498:919681faa9731057b3fae5052b7da598abd3e04b | 0.500 | 0.500 | partial_recoverability_single_evidence_span, multi_evidence_reference_answer, table_metric_or_numeric_answer, all_qwen_policies_abstained | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.04721:0737954caf66f2b4c898b356d2a3c43748b9706b | 0.000 | 0.000 | low_recoverability_from_gold_evidence_text, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.04721:664b3eadc12c8dde309e8bbd59e9af961a433cde | 0.000 | 0.000 | low_recoverability_from_gold_evidence_text, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |
| 2004.04721:73906462bd3415f23d6378590a5ba28709b17605 | 0.737 | 0.737 | high_recoverability_single_evidence_span, multi_evidence_reference_answer, table_metric_or_numeric_answer | Add extractive answer-span planning targets for this row family before free-form generation. |
| 2004.04721:88bf368491f9613767f696f84b4bb1f5a7d7cb48 | 0.000 | 0.000 | low_recoverability_from_gold_evidence_text, table_metric_or_numeric_answer | Add table/metric normalization targets with exact numeric span copying and citation checks. |

## Training Implication

GPU launch ready: no

The audit is diagnostic only; it identifies target families but does not yet materialize a leakage-safe train packet or prove new supported candidate generation.

Next data change: Build a mixed repair curriculum that separates extractive rows from table/metric and multi-evidence synthesis rows before another LoRA run.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
