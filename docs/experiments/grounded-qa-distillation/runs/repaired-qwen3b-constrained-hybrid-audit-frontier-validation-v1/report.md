# Repaired Qwen3B Constrained Hybrid Audit

Generated: 2026-06-29T03:09:13.016Z

Status: `constrained_hybrid_beats_scaffold_by_one_but_not_paper_ready`

## Variants

| Variant | Answered | Contract Correct |
| --- | ---: | ---: |
| baseline_train_calibrated_scaffold | 20/70 | 44/70 (62.9%) |
| qwen_repaired_only | 33/70 | 35/70 (50.0%) |
| agreement_answer_else_abstain | 8/70 | 43/70 (61.4%) |
| scaffold_answerability_qwen_citations_when_both_answer | 20/70 | 45/70 (64.3%) |
| scaffold_answer_only_if_qwen_also_answers | 16/70 | 42/70 (60.0%) |

## Selected

- Variant: `scaffold_answerability_qwen_citations_when_both_answer`
- Description: Preserve scaffold answerability; when both systems answer, use repaired Qwen citation structure; otherwise keep scaffold output.
- Delta vs train-calibrated scaffold: 1 examples
- Promote as final scaffold: no
- Next step: Use the hybrid only as a diagnostic signal; build a train-selected constrained policy and evaluate on a fresh nonfinal slice before spending on judges or larger models.

The selected variant is a post-smoke diagnostic over the repaired validation gate. It is not a final train-selected policy and must be confirmed on a fresh held-out slice before paper claims.
