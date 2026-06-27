# Final Evidence Checklist

Generated: 2026-06-27T00:51:48.579Z

Status: `final_evidence_missing`

Readiness gate: `not_paper_ready` (10/12 passing)

## Budget

| Current actual spend | Planned GPU estimate | Planned Qwen 3B judge estimate | Estimated total | Within $100 cap |
| ---: | ---: | ---: | ---: | --- |
| $5.896386 | $4.000000 | $0.467165 | $10.363551 | yes |

## Acceptance Criteria

| ID | Status | Requirement | Evidence |
| --- | --- | --- | --- |
| packet_quality_ready | pass | Qwen 3B joint-action packet passes support-risk, citation, DPO, and leakage checks. | Current status: ready_for_bounded_qwen3b_smoke. |
| script_contract_ready | pass | Qwen 3B smoke scripts compile, validate the packet, preserve bounded settings, and emit judge-ready artifact names. | Current status: script_contract_ready_for_paid_smoke. |
| local_controls_rejected_as_substitutes | pass | Local Qwen base and citation-repair controls are rejected as final trained-smoke substitutes by production gates. | Current status: local_controls_rejected_as_final_qwen_smoke. |
| amortization_break_even_ready | pass | Qwen 3B planned GPU+judge spend is converted into explicit break-even accounting and kept under the $100 cap without claiming quality. | Current status: amortization_accounting_ready_not_quality_evidence; planned offline investment: $4.4672. |
| distillation_loss_accounting_ready | pass | Student/scaffold preservation and loss dimensions are explicit before interpreting Qwen 3B results. | Current status: loss_accounting_ready_waiting_for_qwen3b; acceptance dimensions: 6. |
| actual_compute_ledger_ready | pass | Post-smoke finalizer can record actual external compute cost only after smoke artifacts and budget gates pass. | Current status: waiting_for_smoke_artifacts; ledger action: not_recorded. |
| prime_runbook_ready | pass | Prime GPU smoke runbook and pod bootstrap are ready once auth and live pricing succeed. | Current status: ready_after_prime_auth_and_live_price. |
| remote_backend_ready | fail | At least one remote backend has verified auth/permissions and stays under the $100 total budget for the Qwen 3B smoke plus judge. | Current remote backend gate status: remote_backend_blocked. Prime: blocked; HF Jobs: blocked. |
| smoke_artifacts_complete | fail | Bounded Qwen 3B smoke creates predictions, eval result, report, and smoke manifest. | No Qwen 3B prediction run exists yet. |
| remote_provenance_ready | fail | Remote Qwen smoke includes Prime pod status, remote environment, bootstrap manifest, and bounded smoke manifest. | Current status: waiting_for_smoke_artifacts. |
| integrity_gate_ready | fail | Prediction integrity gate reaches ready_for_paid_judge. | Current status: waiting_for_qwen3b_predictions. |
| dry_judge_full_coverage | fail | Dry judge accounts for all 69 final-window examples before any paid judge. | Dry judge cannot run until predictions exist. |
| paid_judge_complete | fail | Paid grounded-correctness judge completes with positive calls and examples_judged. | Paid judge cannot run until integrity and dry judge pass. |
| qwen3b_result_integrated | fail | Qwen 3B judged result is compared against direct and 70% coverage-constrained acceptance targets. | Current status: waiting_for_qwen3b_predictions. |
| qwen3b_on_pareto_table | fail | Qwen 3B result is added to the cost/coverage/support table and compared with zero-call gates. | The table currently has no trained Qwen 3B row. |
| manuscript_regenerated | fail | Evidence map, manuscript draft, readiness gate, and reviewer-risk audit are regenerated after the Qwen 3B judge. | Current manuscript explicitly says Qwen 3B is missing. |
| novelty_refreshed_at_submission | fail | Novelty/paper search is refreshed immediately before any NeurIPS-ready claim. | Current watchlist is useful but must be refreshed at final claim time. |

## Execution Sequence

1. `refresh_auth_and_live_price`: `node scripts/grounded-qa-distillation-prime-auth-price-gate.mjs && node scripts/grounded-qa-distillation-remote-backend-readiness-gate.mjs`
   Guard: Do not create a pod or HF job unless the remote backend readiness gate reports remote_backend_ready_for_qwen3b_smoke.
2. `follow_prime_runbook`: `Open docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_prime_qwen3b_smoke_on_pod.sh and prime-qwen3b-smoke-runbook-2026-06-26-v1/report.md for the exact pod create, sync, bootstrap, fetch, finalize, and terminate steps.`
   Guard: The runbook is still gated on auth and live price; it does not authorize spend by itself.
3. `run_bounded_qwen3b_smoke`: `RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_joint_action_smoke.sh`
   Guard: Must preserve MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none for the smoke.
4. `record_actual_gpu_cost`: `node scripts/grounded-qa-distillation-joint-action-smoke-ledger-finalizer.mjs --record=true --status=completed --actual-cost-usd=<backend-cost>`
   Guard: Only after smoke artifacts exist and backend billing/cost is known; rerun total budget afterward.
5. `refresh_amortization_accounting`: `node scripts/grounded-qa-distillation-amortization-break-even.mjs`
   Guard: Rerun after actual GPU cost and Qwen judge cost are known; this is accounting only, not quality evidence.
6. `verify_remote_provenance`: `node scripts/grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs`
   Guard: Must pass before paid judge, Qwen result integration, or Pareto claims.
7. `run_post_smoke_pipeline_dry`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100`
   Guard: Must reach ready_for_explicit_paid_judge before paid judge.
8. `run_post_smoke_pipeline_paid`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true`
   Guard: Only after integrity and dry judge pass, OPENAI_API_KEY is loaded, and total budget remains under $100.
9. `integrate_qwen3b_result`: `node scripts/grounded-qa-distillation-qwen3b-result-integration.mjs`
   Guard: Must run after Qwen predictions and paid judge exist; status determines whether the result is positive or negative.
10. `refresh_distillation_loss_accounting`: `node scripts/grounded-qa-distillation-distillation-loss-accounting.mjs`
   Guard: Rerun after Qwen result integration so preservation/loss claims include the trained row.
11. `regenerate_paper_artifacts`: `node scripts/grounded-qa-distillation-total-budget.mjs && node scripts/grounded-qa-distillation-paper-readiness-gate.mjs && node scripts/grounded-qa-distillation-manuscript-evidence-map.mjs && node scripts/grounded-qa-distillation-manuscript-draft.mjs && node scripts/grounded-qa-distillation-reviewer-risk-audit.mjs`
   Guard: Readiness may only turn green if all final evidence artifacts exist and validate.

## Paper Claim Constraints

- Until this checklist passes, do not claim a trained smaller model preserves citation-grounded correctness.
- Report Qwen 3B answer rate, answer support, abstention support, citation recall, and second-pass reliability slices together.
- Keep the public dated-QASPER/arXiv proxy caveat unless a versioned private KB is added.
- Keep abstention-boundary instability as a limitation unless human/stronger-judge adjudication closes it.

This checklist makes no OpenAI calls, launches no GPU jobs, and records no new spend.
