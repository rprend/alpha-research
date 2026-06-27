# Qwen 3B Pareto Update Contract Audit

Generated: 2026-06-27T04:55:14.298Z

Status: `qwen3b_pareto_update_contract_verified`

| Check | Value |
| --- | --- |
| Existing rows preserved | yes |
| Qwen row schema ok | yes |
| No duplicate ids | yes |
| Qwen comparable for frontier | yes |
| Qwen frontier decision | `synthetic_qwen_row_on_frontier` |

Original systems: 7
Updated systems: 8

Original frontier: `claim_entailment_guard`, `balanced_risk_gate`, `cross_window_candidate_selector`, `direct_mini_repair`, `local_qwen05b_sft_answer_repeat2`, `zero_call_span_distilled_scaffold`

Updated frontier with synthetic Qwen row: `claim_entailment_guard`, `balanced_risk_gate`, `qwen3b_joint_action_smoke`, `direct_mini_repair`, `zero_call_span_distilled_scaffold`

## Required After Real Qwen Integration

- Read qwen3b-result-integration.pareto_row_to_add only after predictions and paid judge exist.
- Append exactly one qwen3b_joint_action_smoke row to cost-coverage-support-pareto systems.
- Preserve all existing baseline/scaffold rows byte-for-byte unless a separate decision log entry justifies a broader table regeneration.
- Recompute pareto_frontier with answer rate, answer support, overall judged correctness, and online OpenAI calls/query.
- Regenerate amortization, final evidence, final claim, manuscript evidence map, manuscript draft, and reviewer-risk artifacts after the table update.

This audit makes no OpenAI calls, launches no GPU jobs, records no spend, and does not claim model quality.
