# Cost/Coverage/Support Pareto

Generated: 2026-06-26T19:21:06.214Z

Status: `tradeoff_mapped_not_final_result`

## Systems

| System | Online calls/query | Answer rate | Answer support | Abstention support | Overall judged correct | Citation recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| direct_mini_repair | 1 | 78.5% | 64.1% | 100.0% | 71.8% | 70.4% |
| balanced_risk_gate | 1 | 60.4% | 70.0% | 94.9% | 79.9% | 56.2% |
| claim_entailment_guard | 1 | 57.0% | 74.1% | 95.3% | 83.2% | 55.1% |
| mini_verifier_combined_gate | 2 | 55.0% | n/a | n/a | 83.9% | n/a |
| zero_call_span_distilled_scaffold | 0 | 75.4% | 19.2% | 100.0% | 39.1% | 58.0% |
| local_qwen05b_sft_answer_repeat2 | 0 | 58.0% | 5.0% | 93.1% | 42.0% | 30.7% |

## Pareto Frontier

- `claim_entailment_guard`
- `balanced_risk_gate`
- `direct_mini_repair`
- `local_qwen05b_sft_answer_repeat2`
- `zero_call_span_distilled_scaffold`

## Conclusions

- The current completed support gains are real but mostly buy support by abstaining more.
- The claim-entailment guard is the best zero-extra-call support-first operating point among aggregate judged policies.
- The mini-verifier gate has stronger correctness but violates the desired low-cost amortization shape because it adds a per-query LLM verifier.
- The zero-call local/tiny-model attempts are not yet acceptable substitutes for the missing Qwen 3B joint-action run.

## Required Next Evidence

- Run the Qwen 3B joint-action smoke and place it on this same table.
- Judge Qwen 3B predictions for answer support, abstention support, and overall grounded correctness.
- Report answer rate and citation recall alongside correctness so abstention-driven gains are visible.

This artifact makes no OpenAI calls, launches no GPU jobs, and records no new spend.
