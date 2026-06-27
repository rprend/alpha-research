# Cost/Coverage/Support Pareto

Generated: 2026-06-27T18:50:59.193Z

Status: `tradeoff_mapped_with_qwen3b_results`

## Systems

| System | Online calls/query | Answer rate | Answer support | Abstention support | Overall judged correct | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| direct_mini_repair | 1 | 78.5% | 64.1% | 100.0% | 71.8% | 70.4% |
| balanced_risk_gate | 1 | 60.4% | 70.0% | 94.9% | 79.9% | 56.2% |
| cross_window_candidate_selector | 1 | 72.5% | 66.0% | 100.0% | 75.4% | n/a |
| claim_entailment_guard | 1 | 57.0% | 74.1% | 95.3% | 83.2% | 55.1% |
| mini_verifier_combined_gate | 2 | 55.0% | n/a | n/a | 83.9% | n/a |
| zero_call_span_distilled_scaffold | 0 | 75.4% | 19.2% | 100.0% | 39.1% | 58.0% |
| local_qwen05b_sft_answer_repeat2 | 0 | 58.0% | 5.0% | 93.1% | 42.0% | 30.7% |
| qwen3b_joint_action_v2_smoke | 0 | 78.3% | 13.0% | 100.0% | 31.9% | 29.5% |
| qwen3b_failure_driven_v3_smoke | 0 | 66.7% | 32.6% | 100.0% | 55.1% | 62.1% |
| qwen3b_support_aware_v4_smoke | 0 | 65.2% | 33.3% | 100.0% | 56.5% | 58.1% |
| qwen7b_support_aware_v4_smoke | 0 | 50.7% | 65.7% | 100.0% | 82.6% | 49.6% |
| qwen7b_coverage_aware_v5_smoke | 0 | 63.8% | 50.0% | 100.0% | 68.1% | 61.0% |
| qwen3b_v4_structural_binder | 0 | 43.5% | 43.3% | 74.4% | 60.9% | n/a |

## Pareto Frontier

- `claim_entailment_guard`
- `qwen7b_support_aware_v4_smoke`
- `balanced_risk_gate`
- `cross_window_candidate_selector`
- `direct_mini_repair`
- `qwen7b_coverage_aware_v5_smoke`
- `qwen3b_support_aware_v4_smoke`
- `qwen3b_failure_driven_v3_smoke`
- `zero_call_span_distilled_scaffold`
- `qwen3b_joint_action_v2_smoke`

## Conclusions

- The current completed support gains are real but mostly buy support by abstaining more.
- A cross-window candidate selector is the best current deployable 70%-coverage operating point, but it remains a selector over direct-mini outputs.
- The claim-entailment guard is the best zero-extra-call support-first operating point among aggregate judged policies.
- The mini-verifier gate has stronger correctness but violates the desired low-cost amortization shape because it adds a per-query LLM verifier.
- The trained Qwen smokes remain negative zero-call student results against the 70%-coverage acceptance bar. The Qwen 7B v4 comparison materially improves support/correctness over 3B v4 by abstaining more, while Qwen 7B v5 recovers some coverage but loses support.

## Required Next Evidence

- Run a Qwen failure-mode audit before any larger GPU/model escalation.
- Do not claim support-preserving amortized distillation from this Qwen smoke.
- Report answer rate, citation recall, judged support, invalid-answer rate, and cost together.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
