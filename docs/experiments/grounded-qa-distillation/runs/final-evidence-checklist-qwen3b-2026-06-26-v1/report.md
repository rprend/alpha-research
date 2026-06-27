# Final Evidence Checklist

Generated: 2026-06-27T17:13:44.126Z

Status: `final_evidence_missing`

Readiness gate: `not_paper_ready` (13/14 passing)

## Budget

| Current actual spend | Planned GPU estimate | Planned Qwen 3B judge estimate | Estimated total | Within $100 cap |
| ---: | ---: | ---: | ---: | --- |
| $6.583861 | $4.000000 | $0.467165 | $11.051026 | yes |

## Acceptance Criteria

| ID | Status | Requirement | Evidence |
| --- | --- | --- | --- |
| packet_quality_ready | pass | Qwen 3B joint-action packet passes support-risk, citation, DPO, and leakage checks. | Current status: ready_for_bounded_qwen3b_smoke. |
| script_contract_ready | pass | Qwen 3B smoke scripts compile, validate the packet, preserve bounded settings, and emit judge-ready artifact names. | Current status: script_contract_ready_for_paid_smoke. |
| local_controls_rejected_as_substitutes | pass | Local Qwen base and citation-repair controls are rejected as final trained-smoke substitutes by production gates. | Current status: local_controls_rejected_as_final_qwen_smoke. |
| amortization_break_even_ready | pass | Qwen 3B planned GPU+judge spend is converted into explicit break-even accounting and kept under the $100 cap without claiming quality. | Current status: amortization_accounting_ready_not_quality_evidence; planned offline investment: $4.4672. |
| distillation_loss_accounting_ready | pass | Student/scaffold preservation and loss dimensions are explicit before interpreting Qwen 3B results. | Current status: loss_accounting_ready_waiting_for_qwen3b; acceptance dimensions: 6. |
| qwen_outcome_policy_preregistered | pass | Qwen 3B positive, negative, and inconclusive outcomes have pre-registered paper actions and model-escalation rules. | Current status: qwen3b_outcome_policy_preregistered; outcomes covered: 5. |
| post_smoke_provenance_guard_ready | pass | The guarded post-smoke pipeline refuses dry or paid judging when predictions pass integrity but remote provenance is missing. | Current status: post_smoke_provenance_guard_verified; pipeline status: failed_remote_provenance_not_ready. |
| qwen_pareto_update_contract_ready | pass | Future Qwen integration can add exactly one canonical Pareto row without mutating existing baseline/scaffold rows. | Current status: qwen3b_pareto_update_contract_verified; table delta: 7->8. |
| citation_faithfulness_positioning_ready | pass | Citation-RAG decomposition/ranking, academic citation prediction, faithfulness-aware ranking, and generate-then-verify neighbors are positioned before final paper claims. | Current comparison: citation-faithfulness-neighbor-comparison-2026-06-27-v1; post-Qwen requirements: 3. |
| novelty_delta_matrix_ready | pass | Broad novelty claims are rejected and the surviving core claim is explicitly conditional on Qwen 3B plus grounded judging. | Current status: surviving_claim_conditional_on_qwen3b_and_judge; rejected broad claims: 7. |
| judge_reliability_claim_gate_ready | pass | Model-judge reliability limitations, adjudication priority rows, and manuscript constraints are explicit before final Qwen claims. | Current status: judge_reliability_requires_final_adjudication; priority adjudication rows: 10. |
| actual_compute_ledger_ready | pass | Post-smoke finalizer can record actual external compute cost only after smoke artifacts and budget gates pass. | Current status: actual_completed_recorded; ledger action: recorded. |
| prime_runbook_ready | pass | Prime GPU smoke runbook and pod bootstrap are ready once auth and live pricing succeed. | Current status: ready_after_prime_auth_and_live_price. |
| prime_auth_repair_handoff_ready | pass | Prime auth repair can be done through hidden input, explicit apply, read-only gate refresh, and no pod creation. | Current status: prime_auth_repaired_gates_refreshed; apply requested: true. |
| prime_ssh_preflight_attempt_recorded | pass | A failed post-auth Prime SSH-preflight pod attempt is recorded with wallet debit, termination, and no-training boundary. | Current status: failed_after_pod_creation_ssh_denied; cost: $0.0192. |
| remote_backend_ready | pass | At least one remote backend has verified auth/permissions and stays under the $100 total budget for the Qwen 3B smoke plus judge. | Current remote backend gate status: remote_backend_ready_for_qwen3b_smoke. Prime: ready; HF Jobs: blocked. |
| smoke_artifacts_complete | pass | Bounded Qwen 3B smoke creates predictions, eval result, report, and smoke manifest. | No Qwen 3B prediction run exists yet. |
| remote_provenance_ready | pass | Remote Qwen smoke includes Prime pod status, remote environment, bootstrap manifest, and bounded smoke manifest. | Current status: remote_provenance_ready_for_judge. |
| integrity_gate_ready | fail | Prediction integrity gate reaches ready_for_paid_judge. | Current status: refuse_paid_judge_prediction_integrity_failed. |
| dry_judge_full_coverage | fail | Dry judge accounts for all 69 final-window examples before any paid judge. | Dry judge cannot run until predictions exist. |
| paid_judge_complete | fail | Paid grounded-correctness judge completes with positive calls and examples_judged. | Paid judge cannot run until integrity and dry judge pass. |
| qwen3b_result_integrated | pass | Qwen 3B judged result is compared against direct and 70% coverage-constrained acceptance targets. | Current status: qwen3b_negative_ready_for_pareto_update. |
| qwen3b_on_pareto_table | fail | Qwen 3B result is added to the cost/coverage/support table and compared with zero-call gates. | The table currently has no trained Qwen 3B row. |
| manuscript_regenerated | fail | Evidence map, manuscript draft, readiness gate, and reviewer-risk audit are regenerated after the Qwen 3B judge. | Current manuscript explicitly says Qwen 3B is missing. |
| novelty_refreshed_at_submission | fail | Novelty/paper search is refreshed immediately before any NeurIPS-ready claim. | Current watchlist is useful but must be refreshed at final claim time. |

## Execution Sequence

1. `repair_prime_key_with_hidden_input`: `/Users/ryanprendergast/.codex/scripts/ask-secret.sh PRIME_API_KEY /Users/ryanprendergast/.codex/secrets.env "Enter Prime Intellect API key"`
   Guard: Do not paste keys into chat; the hidden-input helper writes ~/.codex/secrets.env with private permissions.
2. `apply_prime_key_and_refresh_gates`: `set -a; source /Users/ryanprendergast/.codex/secrets.env; set +a; node scripts/grounded-qa-distillation-prime-auth-repair-handoff.mjs --apply=true --max-budget-usd=100`
   Guard: This updates ~/.prime/config.json only with --apply=true and then reruns read-only auth/price/backend/launch gates; it must not create a pod.
3. `refresh_auth_and_live_price`: `node scripts/grounded-qa-distillation-prime-auth-price-gate.mjs && node scripts/grounded-qa-distillation-remote-backend-readiness-gate.mjs`
   Guard: Do not create a pod or HF job unless the remote backend readiness gate reports remote_backend_ready_for_qwen3b_smoke.
4. `follow_prime_runbook`: `Open docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_prime_qwen3b_smoke_on_pod.sh and prime-qwen3b-smoke-runbook-2026-06-26-v1/report.md for the exact pod create, sync, bootstrap, fetch, finalize, and terminate steps.`
   Guard: The runbook is gated on auth, live price, and SSH preflight. If SSH fails, terminate immediately and record wallet debit before training.
5. `run_bounded_qwen3b_smoke`: `RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh`
   Guard: Must preserve MAX_SFT_STEPS=20, MAX_DPO_STEPS=10, PUSH_TO_HUB=false, REPORT_TO=none for the smoke.
6. `record_actual_gpu_cost`: `node scripts/grounded-qa-distillation-joint-action-smoke-ledger-finalizer.mjs --record=true --status=completed --actual-cost-usd=<backend-cost>`
   Guard: Only after smoke artifacts exist and backend billing/cost is known; rerun total budget afterward.
7. `refresh_amortization_accounting`: `node scripts/grounded-qa-distillation-amortization-break-even.mjs`
   Guard: Rerun after actual GPU cost and Qwen judge cost are known; this is accounting only, not quality evidence.
8. `verify_remote_provenance`: `node scripts/grounded-qa-distillation-qwen3b-remote-provenance-gate.mjs`
   Guard: Must pass before paid judge, Qwen result integration, or Pareto claims.
9. `run_post_smoke_pipeline_dry`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100`
   Guard: Must reach ready_for_explicit_paid_judge before paid judge.
10. `run_post_smoke_pipeline_paid`: `node scripts/grounded-qa-distillation-qwen3b-post-smoke-pipeline.mjs --prediction-run-id=joint-action-qwen3b-smoke-eval-v1 --packet-run-id=joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2 --run-id=qwen3b-post-smoke-judge-pipeline-joint-action-qwen3b-smoke-eval-v1 --model=gpt-4o --split=extended_temporal_future_holdout --max-budget-usd=100 --run-paid=true`
   Guard: Only after integrity and dry judge pass, OPENAI_API_KEY is loaded, and total budget remains under $100.
11. `integrate_qwen3b_result`: `node scripts/grounded-qa-distillation-qwen3b-result-integration.mjs`
   Guard: Must run after Qwen predictions and paid judge exist; status determines whether the result is positive or negative.
12. `refresh_distillation_loss_accounting`: `node scripts/grounded-qa-distillation-distillation-loss-accounting.mjs`
   Guard: Rerun after Qwen result integration so preservation/loss claims include the trained row.
13. `regenerate_paper_artifacts`: `node scripts/grounded-qa-distillation-total-budget.mjs && node scripts/grounded-qa-distillation-cost-coverage-pareto.mjs && node scripts/grounded-qa-distillation-amortization-break-even.mjs && node scripts/grounded-qa-distillation-distillation-loss-accounting.mjs && node scripts/grounded-qa-distillation-paper-readiness-gate.mjs && node scripts/grounded-qa-distillation-final-claim-acceptance-matrix.mjs && node scripts/grounded-qa-distillation-final-evidence-checklist.mjs && node scripts/grounded-qa-distillation-manuscript-evidence-map.mjs && node scripts/grounded-qa-distillation-manuscript-draft.mjs && node scripts/grounded-qa-distillation-reviewer-risk-audit.mjs`
   Guard: Readiness may only turn green if all final evidence artifacts exist and validate.

## Paper Claim Constraints

- Until this checklist passes, do not claim a trained smaller model preserves citation-grounded correctness.
- Report Qwen 3B answer rate, answer support, abstention support, citation recall, and second-pass reliability slices together.
- Keep the public dated-QASPER/arXiv proxy caveat unless a versioned private KB is added.
- Keep abstention-boundary instability as a limitation unless human/stronger-judge adjudication closes it.
- Do not call model-judged correctness human-validated unless the judge reliability claim gate is closed by human or stronger independent adjudication.
- Do not claim generic RAG distillation, citation SFT, dynamic QA, online agentic RAG, compact faithful-context QA, or memory/index amortization as the novelty.
- Follow the pre-registered Qwen outcome policy before escalating model scale or interpreting a negative smoke.
- Do not claim first citation-RAG decomposition/ranking, academic citation prediction, faithfulness-aware context ranking, or generate-then-verify RAG method.

This checklist makes no OpenAI calls, launches no GPU jobs, and records no new spend.
