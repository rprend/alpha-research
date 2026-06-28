# Trained Selector Miss Audit

Generated: 2026-06-28T04:44:31.806Z

Selector run: `trained-contract-selector-240-320-to-321-389-v1`

## Summary

| Missed supported answers | Status | Mean selected-oracle score gap |
| ---: | --- | ---: |
| 26 | `verifier_score_miscalibration_dominates` | 0.000 |

## Tag Counts

| Tag | Count |
| --- | ---: |
| `oracle_candidate_low_score` | 26 |
| `unsupported_candidate_scored_above_oracle` | 26 |
| `many_supported_candidates_available` | 22 |
| `qwen_over_supported_scaffold` | 20 |
| `selected_unsupported_answer_over_supported_answer` | 17 |
| `selected_abstention_over_supported_answer` | 9 |
| `missed_qwen_supported_answer` | 5 |

## Examples

- `2004.03034:8e8097cada29d89ca07166641c725e0f8fed6676` (selected_abstention_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen3b_v1`, oracle `balanced_risk_gate`.
- `2004.03034:951098f0b7169447695b47c142384f278f451a1e` (selected_unsupported_answer_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen7b_v9`, oracle `balanced_risk_gate`.
- `2004.03034:ca26cfcc755f9d0641db0e4d88b4109b903dbb26` (selected_unsupported_answer_over_supported_answer, unsupported_candidate_scored_above_oracle, missed_qwen_supported_answer, oracle_candidate_low_score): selected `qwen7b_v9`, oracle `qwen7b_v5`.
- `2004.03090:25e6ba07285155266c3154d3e2ca1ae05c2f7f2d` (selected_unsupported_answer_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen3b_v3`, oracle `balanced_risk_gate`.
- `2004.03090:7625068cc22a095109580b83eff48616387167c2` (selected_abstention_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen7b_v5`, oracle `balanced_risk_gate`.
- `2004.03090:a24b2269b292fd0ee81d50303d1315383c594382` (selected_abstention_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen3b_v1`, oracle `balanced_risk_gate`.
- `2004.03090:d038e5d2a6f85e68422caaf8b96cb046db6599fa` (selected_unsupported_answer_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen3b_v1`, oracle `balanced_risk_gate`.
- `2004.03685:2a859e80d8647923181cb2d8f9a2c67b1c3f4608` (selected_unsupported_answer_over_supported_answer, unsupported_candidate_scored_above_oracle, qwen_over_supported_scaffold, many_supported_candidates_available, oracle_candidate_low_score): selected `qwen3b_v1`, oracle `balanced_risk_gate`.

This audit makes no LLM calls and launches no compute.
