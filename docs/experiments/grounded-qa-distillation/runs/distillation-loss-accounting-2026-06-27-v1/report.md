# Distillation-Loss Accounting

Generated: 2026-06-27T17:13:43.964Z

Status: `loss_accounting_ready_waiting_for_qwen3b`

## Preservation/Loss Rows

| System | Family | Answer rate | Answer support | Overall judged correct | Online calls/query | Preserves | Loses |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| direct_mini_repair | api_baseline | 78.5% | 64.1% | 71.8% | 1 | coverage, citation_format | answer_support, zero_call_inference |
| claim_entailment_guard | zero_extra_call_guard | 57.0% | 74.1% | 83.2% | 1 | answer_support, abstention_support | coverage, answer_recall |
| zero_call_span_distilled_scaffold | local_zero_call_scaffold | 75.4% | 19.2% | 39.1% | 0 | zero_call_inference, some_coverage | answer_support, answer_f1 |
| local_qwen05b_sft_answer_repeat2 | tiny_sft_model | 58.0% | 5.0% | 42.0% | 0 | zero_call_inference, citation_format | answer_support, citation_recall, coverage |
| zero_call_risk_gate_final_window | final_window_scaffold | 63.8% | 70.5% | 79.7% | 0 | answer_support, overall_correctness, citation_format | coverage, answer_f1 |
| local_qwen3b_base_control | untrained_3b_control | 76.8% | n/a | n/a | 0 | coverage | citation_format, json_contract, trained_adapter_evidence |
| local_qwen3b_base_citation_repair | syntax_repair_control | 76.8% | n/a | n/a | 0 | citation_format | support_evidence, answer_f1 |

## Aggregate Lessons

- Current zero-call systems are cheap but either lose support or lose answer coverage.
- Citation format is not a preservation target by itself; repaired syntax can coexist with weak support.
- Abstention support is strong in many systems, but abstention-boundary disagreements remain a reporting limitation.
- The trained Qwen 3B row must be judged as a preservation/loss tradeoff, not only as a score improvement.

## Qwen 3B Acceptance Contract

- answer_support_rate: compare against direct baseline, deployable selector baseline, and 70% coverage-constrained frontier.
- overall_judged_correct_rate: compare against direct baseline, deployable selector baseline, and 70% coverage-constrained frontier.
- answer_rate: compare against coverage collapse guard.
- citation_support_and_recall: compare against not citation syntax alone.
- abstention_boundaries: compare against judge reliability caveat.
- amortized_cost: compare against planned zero-call deployed model/scaffold.

## Failure Policy

- If Qwen improves support only by dropping below 70% answer rate, report a coverage/support tradeoff rather than support-preserving distillation.
- If Qwen preserves citation syntax but not judged support, report a negative result analogous to the local Qwen 0.5B and syntax-repair controls.
- If Qwen improves judged correctness but depends on per-query LLM verification, it is not the final amortized system.

No OpenAI calls, GPU jobs, or new spend were made for this artifact.
