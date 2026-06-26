# Grounded QA Paper Readiness Gate

Generated: 2026-06-26T16:48:23.927Z

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
| drag_like_rag_distillation_comparison | fail | A generic RAG-to-SLM distillation comparison or documented non-comparability result exists. |
| longcite_style_citation_sft_comparison | pass | A LongCite-style citation-SFT framing is compared using support metrics, not just citation syntax. |
| writeback_kb_amortization_baseline | fail | A KB write-back/evidence-distillation baseline exists or is explicitly scoped out with evidence. |
| trusted_dated_or_private_kb_snapshot | fail | Evaluation uses trusted dated/private KB snapshots beyond arXiv-id-inferred temporal splits. |
| paper_claims_narrowed | pass | Decision log records narrowed novelty claims and claims-to-avoid. |

## Top Blockers

- qwen3b_joint_action_smoke_result: A bounded Qwen 3B joint-action smoke has actually trained and produced eval predictions.
- grounded_correctness_eval_for_student: The trained joint-action student has grounded-correctness judging on the final future window.
- drag_like_rag_distillation_comparison: A generic RAG-to-SLM distillation comparison or documented non-comparability result exists.
- writeback_kb_amortization_baseline: A KB write-back/evidence-distillation baseline exists or is explicitly scoped out with evidence.
- trusted_dated_or_private_kb_snapshot: Evaluation uses trusted dated/private KB snapshots beyond arXiv-id-inferred temporal splits.

## Next Actions

- Refresh Prime auth or add HF credits, then run the bounded Qwen 3B joint-action smoke.
- Judge the trained Qwen 3B outputs for answer support, citation support, and abstention support on the held-out future window.
- Add DRAG-like and WriteBack-RAG-style comparisons or documented scoped exclusions.
- Replace arXiv-id-inferred temporal splits with trusted dated/private KB snapshots before strong evolving-KB claims.

## Budget

No OpenAI API calls, no GPU jobs, and no new spend.
