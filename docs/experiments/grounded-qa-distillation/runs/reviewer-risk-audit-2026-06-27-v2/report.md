# Reviewer Risk Audit

Generated: 2026-06-27T20:28:31.598Z

Status: `not_submission_ready`

Readiness gate: `paper-readiness-gate-2026-06-26-v1` (13/14 passing)

## Critical Blockers

- `R1_missing_trained_qwen3b_result`
- `R2_missing_grounded_correctness_judge_for_student`

## Risks

| ID | Severity | Status | Reviewer objection | Required next evidence |
| --- | --- | --- | --- | --- |
| R1_missing_trained_qwen3b_result | critical | blocking | The paper question asks whether expensive grounded behavior can be distilled into a cheaper trained model or scaffold, but the final Qwen 3B joint-action student has not been trained/evaluated. | runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl<br>runs/joint-action-qwen3b-smoke-eval-v1/result.json<br>runs/joint-action-qwen3b-smoke-eval-v1/smoke_manifest.json<br>runs/joint-action-qwen3b-smoke-eval-v1/prime_pod_status.json<br>runs/joint-action-qwen3b-smoke-eval-v1/remote_environment.txt<br>runs/joint-action-qwen3b-smoke-eval-v1/remote_smoke_bootstrap_manifest.json |
| R2_missing_grounded_correctness_judge_for_student | critical | blocking | No paper-ready claim can be made about citation-grounded correctness until the trained student's predictions are judged for support and abstention correctness. | Integrity gate status ready_for_paid_judge<br>Dry judge covers all 69 final-window examples<br>Paid openai-judge run with positive calls_made and examples_judged<br>Qwen result integration status ready_for_pareto_update |
| R3_private_kb_claim_overreach | high | managed_but_not_closed | The motivating claim says private evolving KBs, while the current evaluation is a public QASPER/arXiv proxy. | Keep the manuscript caveat unless a versioned private/domain corpus is added.<br>Replace deterministic line-prefix questions with natural questions and snapshot-specific retrieval packs before claiming a natural versioned-KB benchmark.<br>If adding a private KB, create train-time and final-time snapshots with immutable date provenance.<br>If comparing write-back memory, allow writes only from prior snapshots and preserve derived-record provenance. |
| R4_novelty_pressure_from_rag_distillation_and_citation_sft | high | managed_but_needs_final_refresh | The contribution may be perceived as generic RAG distillation, generic citation SFT, or KB write-back memory rather than a sharper grounded-correctness amortization result. | Refresh web/paper search immediately before any submission claim.<br>Update related-work notes with any June 2026 or newer direct overlaps.<br>If reviewer pressure remains high, run a true compact faithful-context-QA baseline on the final update-heldout windows.<br>If reviewer pressure remains high, add a compact-memory or citation-grounding metric baseline/non-comparability artifact. |
| R5_model_judge_reliability | medium_high | open | A model-based grounded-correctness judge can be biased, under-calibrated, or insufficient as the only correctness authority. | Manually adjudicate the P0 abstention-boundary queue or run a stronger independent judge before claiming abstention calibration is solved.<br>Spot-adjudicate P1 support-boundary rows before treating unsupported/support rates as human truth.<br>Report judge prompts, schemas, abstention criteria, and disagreement examples. |
| R6_coverage_support_tradeoff | medium_high | open | The strongest completed scaffold results improve support largely by suppressing risky answers, so correctness gains may hide poor answer coverage. | Report answer rate, abstention correctness, support, and utility together.<br>Compare trained Qwen 3B against zero-call gates on both correctness and coverage.<br>Use qwen3b-result-integration to decide whether the result meets the minimum target or is a negative result. |
| R7_remote_compute_reproducibility_and_auth | medium | operational_blocker | The paper-critical run depends on external GPU execution; Prime auth/billing/pricing are now repaired, but SSH key provisioning failed before training. | Fix Prime dashboard SSH-key provisioning for the configured private key, or use a backend/image path that exposes working SSH.<br>Rerun the Prime auth/price gate and remote backend readiness gate; require remote_backend_ready_for_qwen3b_smoke and successful SSH preflight before repo sync or training.<br>If using Hugging Face Jobs, rerun the bounded a10g-large launch and record either backend job id or failed-before-creation reason.<br>Record provider, GPU type, wall time, backend run id, actual cost, and command transcript for the smoke.<br>Fetch prime_pod_status.json, remote_environment.txt, remote_smoke_bootstrap_manifest.json, and smoke_manifest.json.<br>Run the remote provenance gate and require remote_provenance_ready_for_judge before paid judging.<br>Run the smoke ledger finalizer with --record=true after artifacts and backend cost are known. |
| R8_model_scale_and_gpu_choice | medium_high | managed_but_waiting_for_qwen3b | The paper may be underpowered if the student model is too small, or wasteful if it jumps to an expensive cutting-edge model without first testing the minimal credible trained student. | Run the bounded Qwen 3B smoke only after auth_and_live_price_verified.<br>If Qwen 3B fails the 70% coverage-constrained target, report that negative result before escalating to a larger model.<br>Do not use tiny local model outputs as ground-truth labels. |

## Acceptance Path

1. Repair Prime auth or HF credits without exceeding the $100 total budget.
2. Run the one-command bounded Qwen 3B SFT/DPO smoke and produce complete predictions.
3. Record actual GPU cost with the smoke ledger finalizer and regenerate total budget.
4. Run the remote provenance gate and require pod status, remote environment, bootstrap manifest, and bounded smoke manifest before judging.
5. Run the Qwen 3B prediction integrity gate and default post-smoke dry judge.
6. Run the paid grounded-correctness judge only after the dry gate passes.
7. Run Qwen result integration and update the Pareto/frontier table with the actual judged row.
8. Regenerate amortization break-even accounting with the actual GPU and judge spend.
9. Regenerate distillation-loss accounting with the actual Qwen preservation/loss row.
10. Refresh the novelty watchlist/web search immediately before making a submission-ready claim.
11. Regenerate the evidence map, manuscript draft, readiness gate, and this risk audit.

## Budget

- Actual total spend: $8.116378
- External compute spend: $1.203900
- Remaining: $91.883622

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
