# Reviewer Risk Audit

Generated: 2026-06-26T18:54:21.917Z

Status: `not_submission_ready`

Readiness gate: `paper-readiness-gate-2026-06-26-v1` (10/12 passing)

## Critical Blockers

- `R1_missing_trained_qwen3b_result`
- `R2_missing_grounded_correctness_judge_for_student`

## Risks

| ID | Severity | Status | Reviewer objection | Required next evidence |
| --- | --- | --- | --- | --- |
| R1_missing_trained_qwen3b_result | critical | blocking | The paper question asks whether expensive grounded behavior can be distilled into a cheaper trained model or scaffold, but the final Qwen 3B joint-action student has not been trained/evaluated. | runs/joint-action-qwen3b-smoke-eval-v1/predictions.jsonl<br>runs/joint-action-qwen3b-smoke-eval-v1/result.json<br>runs/joint-action-qwen3b-smoke-eval-v1/smoke_manifest.json |
| R2_missing_grounded_correctness_judge_for_student | critical | blocking | No paper-ready claim can be made about citation-grounded correctness until the trained student's predictions are judged for support and abstention correctness. | Integrity gate status ready_for_paid_judge<br>Dry judge covers all 69 final-window examples<br>Paid openai-judge run with positive calls_made and examples_judged |
| R3_private_kb_claim_overreach | high | managed_but_not_closed | The motivating claim says private evolving KBs, while the current evaluation is a public QASPER/arXiv proxy. | Keep the manuscript caveat unless a versioned private/domain corpus is added.<br>If adding a private KB, create train-time and final-time snapshots with immutable date provenance. |
| R4_novelty_pressure_from_rag_distillation_and_citation_sft | high | managed_but_needs_final_refresh | The contribution may be perceived as generic RAG distillation, generic citation SFT, or KB write-back memory rather than a sharper grounded-correctness amortization result. | Refresh web/paper search immediately before any submission claim.<br>Update related-work notes with any June 2026 or newer direct overlaps. |
| R5_model_judge_reliability | medium_high | open | A model-based grounded-correctness judge can be biased, under-calibrated, or insufficient as the only correctness authority. | Add a small independent audit or human spot-check before submission if budget/time permits.<br>Report judge prompts, schemas, abstention criteria, and disagreement examples. |
| R6_coverage_support_tradeoff | medium_high | open | The strongest completed scaffold results improve support largely by suppressing risky answers, so correctness gains may hide poor answer coverage. | Report answer rate, abstention correctness, support, and utility together.<br>Compare trained Qwen 3B against zero-call gates on both correctness and coverage. |
| R7_remote_compute_reproducibility_and_auth | medium | operational_blocker | The paper-critical run depends on external GPU execution, while Prime auth and HF credits are currently unavailable. | Install a valid Prime key through hidden input or repair HF credits.<br>Record provider, GPU type, wall time, cost, and command transcript for the smoke. |

## Acceptance Path

1. Repair Prime auth or HF credits without exceeding the $100 total budget.
2. Run the one-command bounded Qwen 3B SFT/DPO smoke and produce complete predictions.
3. Run the Qwen 3B prediction integrity gate and default post-smoke dry judge.
4. Run the paid grounded-correctness judge only after the dry gate passes.
5. Refresh the novelty watchlist/web search immediately before making a submission-ready claim.
6. Regenerate the evidence map, manuscript draft, readiness gate, and this risk audit.

## Budget

- Actual total spend: $5.878324
- External compute spend: $0.000000
- Remaining: $94.121676

This audit makes no OpenAI calls, launches no GPU jobs, and records no spend.
