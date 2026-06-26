# Final Evidence Checklist

Generated: 2026-06-26T19:57:18.816Z

Status: `final_evidence_missing`

Readiness gate: `not_paper_ready` (10/12 passing)

## Budget

| Current actual spend | Planned GPU estimate | Planned Qwen 3B judge estimate | Estimated total | Within $100 cap |
| ---: | ---: | ---: | ---: | --- |
| $5.893100 | $4.000000 | $0.467165 | $10.360265 | yes |

## Acceptance Criteria

| ID | Status | Requirement | Evidence |
| --- | --- | --- | --- |
| auth_and_pricing_verified | fail | Prime/HF auth works and live GPU price keeps estimated total under $100. | Prime key is still unauthorized and HF credits are insufficient. |
| smoke_artifacts_complete | fail | Bounded Qwen 3B smoke creates predictions, eval result, report, and smoke manifest. | No Qwen 3B prediction run exists yet. |
| integrity_gate_ready | fail | Prediction integrity gate reaches ready_for_paid_judge. | Current status: waiting_for_qwen3b_predictions. |
| dry_judge_full_coverage | fail | Dry judge accounts for all 69 final-window examples before any paid judge. | Dry judge cannot run until predictions exist. |
| paid_judge_complete | fail | Paid grounded-correctness judge completes with positive calls and examples_judged. | Paid judge cannot run until integrity and dry judge pass. |
| qwen3b_on_pareto_table | fail | Qwen 3B result is added to the cost/coverage/support table and compared with zero-call gates. | The table currently has no trained Qwen 3B row. |
| manuscript_regenerated | fail | Evidence map, manuscript draft, readiness gate, and reviewer-risk audit are regenerated after the Qwen 3B judge. | Current manuscript explicitly says Qwen 3B is missing. |
| novelty_refreshed_at_submission | fail | Novelty/paper search is refreshed immediately before any NeurIPS-ready claim. | Current watchlist is useful but must be refreshed at final claim time. |

## Execution Sequence

1. `refresh_auth_and_live_price`: `prime whoami && prime availability list`
   Guard: Do not create a pod unless estimated total spend remains under $100.
2. `run_bounded_qwen3b_smoke`: `RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_joint_action_smoke.sh`
   Guard: Must preserve MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none for the smoke.
3. `run_post_smoke_pipeline_dry`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100`
   Guard: Must reach ready_for_explicit_paid_judge before paid judge.
4. `run_post_smoke_pipeline_paid`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true`
   Guard: Only after integrity and dry judge pass, OPENAI_API_KEY is loaded, and total budget remains under $100.
5. `regenerate_paper_artifacts`: `node scripts/grounded-qa-distillation-total-budget.mjs && node scripts/grounded-qa-distillation-paper-readiness-gate.mjs && node scripts/grounded-qa-distillation-manuscript-evidence-map.mjs && node scripts/grounded-qa-distillation-manuscript-draft.mjs && node scripts/grounded-qa-distillation-reviewer-risk-audit.mjs`
   Guard: Readiness may only turn green if all final evidence artifacts exist and validate.

## Paper Claim Constraints

- Until this checklist passes, do not claim a trained smaller model preserves citation-grounded correctness.
- Report Qwen 3B answer rate, answer support, abstention support, citation recall, and second-pass reliability slices together.
- Keep the public dated-QASPER/arXiv proxy caveat unless a versioned private KB is added.
- Keep abstention-boundary instability as a limitation unless human/stronger-judge adjudication closes it.

This checklist makes no OpenAI calls, launches no GPU jobs, and records no new spend.
