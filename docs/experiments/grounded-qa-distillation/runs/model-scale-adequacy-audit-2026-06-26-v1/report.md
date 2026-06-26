# Model Scale Adequacy Audit

Generated: 2026-06-26T23:15:27.370Z

Status: `qwen3b_gpu_smoke_still_required`

## Systems

| System | Role | Answer rate | Answer support | Overall judged correctness | Inline citation rate | Verdict |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| direct_mini_rag_student | cheap_prompted_baseline | 76.8% | 64.2% | 72.5% | 100.0% | baseline_not_final_student |
| zero_call_risk_gate_over_direct_student | amortized_scaffold | 63.8% | 70.5% | 79.7% | 100.0% | useful_scaffold_but_coverage_tradeoff |
| zero_call_span_distilled_scaffold | local_distilled_scaffold | 75.4% | 19.2% | 39.1% | 100.0% | underpowered_for_grounded_synthesis |
| local_qwen05b_sft_answer_repeat2 | tiny_foundation_model | 58.0% | 5.0% | 42.0% | 97.5% | too_small_for_final_claim |
| local_qwen05b_compact_sft_all_abstain | tiny_foundation_model | 0.0% | n/a | n/a | 0.0% | collapsed_to_abstention |
| local_qwen05b_contract_gate | tiny_foundation_model_with_local_contract_gate | 21.7% | n/a | n/a | 100.0% | format_control_not_grounded_correctness_evidence |
| local_qwen3b_base_control | larger_base_model_no_training | 83.3% | n/a | n/a | 15.0% | scale_alone_not_contract_sufficient |

## Decision

- Use tiny models as final student: no
- Use tiny models as ground-truth labelers: no
- Rent GPU for bounded Qwen 3B smoke: yes
- Rent cutting-edge large GPU model now: no

- The tiny Qwen 0.5B SFT result has high inline citation compliance but only 5.0% judged answer support and 42.0% overall judged correctness on the final window.
- The compact local Qwen 0.5B SFT path collapses to all abstentions, so it cannot answer the support-preserving distillation question.
- The local Qwen 3B base-control answers 83.3% of a 12-example future-window slice, but reaches only 15.0% inline citation rate and 83.3% valid JSON, so scale alone does not satisfy the grounded citation contract.
- The best zero-call scaffold improves support/correctness by reducing answer coverage, so the missing evidence is a trained student that can recover useful coverage.
- The Qwen 3B joint-action packet already encodes answer repair, abstention, citation placement, and support-risk contrast; the next credible paid step is the bounded Qwen 3B smoke, not a larger open-ended GPU experiment.
- Prime auth currently blocks execution before wallet or live price checks, so no pod should be created until the auth/price gate passes under the $100 total cap.

## Qwen 3B Target

- Minimum: Beat the direct baseline on answer support and overall judged correctness while keeping answer rate above 70%; if that is not possible, report the exact coverage/support frontier instead of claiming support-preserving distillation.
- Success condition: Beat direct baseline support/correctness while keeping answer rate at or above 70%; otherwise report a negative result against the coverage-constrained frontier.

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $5.8964; Prime auth/price gate is `auth_or_price_blocked`.
