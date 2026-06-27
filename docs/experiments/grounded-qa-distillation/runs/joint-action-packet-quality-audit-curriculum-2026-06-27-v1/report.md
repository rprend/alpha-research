# Joint-Action Packet Quality Audit

Generated: 2026-06-27T03:10:43.517Z

Status: `ready_for_bounded_qwen3b_smoke`

## Aggregate

| Surface | Rows | Grounded/Chosen grounded | Abstain/Chosen abstain | Citation issues |
| --- | ---: | ---: | ---: | ---: |
| SFT | 303 | 261 | 42 | 0 |
| DPO | 139 | 97 | 42 | 0 |

## Coverage Frontier Target

- Direct baseline answer rate: 79.0%
- Direct baseline answer support: 65.2%
- 70% frontier answer support: 68.5%
- 70% frontier judged correctness: 77.3%
- Qwen target: Beat the direct baseline on answer support and overall judged correctness while keeping answer rate above 70%; if that is not possible, report the exact coverage/support frontier instead of claiming support-preserving distillation.

## Checks

- PASS dataset_files_present: All SFT/DPO/eval JSONL files are non-empty.
- PASS sft_has_grounded_and_abstain_targets: SFT contains both grounded answers and abstentions.
- PASS dpo_has_repair_and_abstain_preferences: DPO contains both repair/regenerate and abstain choices.
- PASS dpo_rejects_grounded_answers: Every DPO rejected output is an attempted grounded answer.
- PASS grounded_targets_have_inline_citations: Grounded chosen/SFT targets include inline citations.
- PASS train_eval_paper_disjoint: Training rows share no papers with final eval prompts.
- PASS eval_matches_final_window: Eval prompt count matches the final Qwen smoke window.
- PASS coverage_frontier_target_available: Coverage-constrained acceptance target is available.

## Conclusions

- The packet is aligned with the new acceptance target if it contains both repair/regenerate and abstain supervision, not only citation-format SFT.
- The DPO rows directly prefer supported reference repairs or abstentions over judged unsupported grounded answers, which targets the observed frontier failure mode.
- The final smoke should still be treated as empirical evidence only after prediction integrity and grounded-correctness judging; this audit proves packet readiness, not model quality.

## Budget

No OpenAI calls, no GPU jobs, and no new spend. Actual total spend remains $5.8964.
