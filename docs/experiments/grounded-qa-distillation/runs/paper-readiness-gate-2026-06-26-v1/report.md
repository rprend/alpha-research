# Grounded QA Paper Readiness Gate

Generated: 2026-06-26T19:57:18.893Z

Status: `not_paper_ready`

| Requirement | Status | Description |
| --- | --- | --- |
| novelty_watchlist_current | pass | June 2026 novelty watchlist exists with high-pressure neighbors. |
| budget_under_cap | pass | Total actual OpenAI plus external compute spend remains under the $100 cap. |
| joint_action_packet_ready | pass | Joint-action SFT/DPO packet exists for Qwen 3B training. |
| joint_action_preflight_passed | pass | Bounded joint-action launch preflight exists and passed packet/script/safety checks. |
| budgeted_prime_launch_plan | pass | Budget-gated Prime smoke launch plan exists with planned zero-actual-cost spend row. |
| qwen3b_joint_action_smoke_result | fail | A bounded Qwen 3B joint-action smoke has actually trained and produced eval predictions. |
| grounded_correctness_eval_for_student | fail | The trained joint-action student has grounded-correctness judging on the final future window. |
| drag_like_rag_distillation_comparison | pass | A generic RAG-to-SLM distillation comparison or documented non-comparability result exists. |
| longcite_style_citation_sft_comparison | pass | A LongCite-style citation-SFT framing is compared using support metrics, not just citation syntax. |
| writeback_kb_amortization_baseline | pass | A KB write-back/evidence-distillation baseline exists or is explicitly scoped out with evidence. |
| trusted_dated_or_private_kb_snapshot | pass | Evaluation uses trusted dated/private KB snapshots beyond arXiv-id-inferred temporal splits. |
| paper_claims_narrowed | pass | Decision log records narrowed novelty claims and claims-to-avoid. |

## Top Blockers

- qwen3b_joint_action_smoke_result: A bounded Qwen 3B joint-action smoke has actually trained and produced eval predictions.
- grounded_correctness_eval_for_student: The trained joint-action student has grounded-correctness judging on the final future window.

## Next Actions

- Refresh Prime auth or add HF credits, then run the bounded Qwen 3B joint-action smoke.
- Judge the trained Qwen 3B outputs for answer support, citation support, and abstention support on the held-out future window.

## Budget

No OpenAI API calls, no GPU jobs, and no new spend.
