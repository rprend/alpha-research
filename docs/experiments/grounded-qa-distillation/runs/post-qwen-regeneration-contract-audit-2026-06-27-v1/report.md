# Post-Qwen Regeneration Contract Audit

Generated: 2026-06-27T04:49:39.071Z

Status: `post_qwen_regeneration_contract_ready`

Qwen integration status: `waiting_for_qwen3b_predictions`

## Command Coverage

| Script | Covered |
| --- | --- |
| grounded-qa-distillation-total-budget.mjs | yes |
| grounded-qa-distillation-cost-coverage-pareto.mjs | yes |
| grounded-qa-distillation-amortization-break-even.mjs | yes |
| grounded-qa-distillation-distillation-loss-accounting.mjs | yes |
| grounded-qa-distillation-paper-readiness-gate.mjs | yes |
| grounded-qa-distillation-final-claim-acceptance-matrix.mjs | yes |
| grounded-qa-distillation-final-evidence-checklist.mjs | yes |
| grounded-qa-distillation-manuscript-evidence-map.mjs | yes |
| grounded-qa-distillation-manuscript-draft.mjs | yes |
| grounded-qa-distillation-reviewer-risk-audit.mjs | yes |

## Freshness Policy

| Artifact | Run | Generated after Qwen integration |
| --- | --- | --- |
| total_budget | `spend/budget.json` | no |
| cost_coverage_pareto | `cost-coverage-support-pareto-2026-06-26-v1` | no |
| amortization_break_even | `amortization-break-even-qwen3b-2026-06-26-v1` | no |
| distillation_loss_accounting | `distillation-loss-accounting-2026-06-27-v1` | no |
| paper_readiness | `paper-readiness-gate-2026-06-26-v1` | no |
| final_claim_matrix | `final-claim-acceptance-matrix-2026-06-27-v1` | no |
| final_evidence_checklist | `final-evidence-checklist-qwen3b-2026-06-26-v1` | no |
| manuscript_evidence_map | `manuscript-evidence-map-2026-06-27-v2` | no |
| manuscript_draft | `manuscript-draft-2026-06-27-v2` | no |
| reviewer_risk_audit | `reviewer-risk-audit-2026-06-27-v2` | no |

## Required Order After Real Qwen

- Run Qwen result integration after predictions and paid judge exist.
- Update cost-coverage-support Pareto with exactly one qwen3b_joint_action_smoke row from pareto_row_to_add.
- Regenerate total budget, cost-coverage-support Pareto, and amortization with actual GPU plus judge costs.
- Regenerate distillation-loss accounting so preservation/loss claims include Qwen.
- Regenerate paper readiness, final claim matrix, and final evidence checklist.
- Regenerate manuscript evidence map, manuscript draft, and reviewer-risk audit.
- Only after those artifacts are fresh should a final novelty refresh and submission-level claim audit run.

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
