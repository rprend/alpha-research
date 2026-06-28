# Current Readiness Audit

Generated: 2026-06-28T23:37:00.043Z

Status: `not_neurips_ready_current_blockers`

| Requirement | Status | Blocks Paper | Description |
| --- | --- | --- | --- |
| budget_under_cap | pass | yes | Total OpenAI plus external compute spend remains under $100. |
| novelty_scope_current_but_conditional | pass | yes | June 2026 novelty pressure is captured and broad RAG/citation/distillation claims are rejected. |
| deployable_selector_baseline_exists | pass | yes | A zero-call/deployable final-window selector baseline exists for comparison. |
| structural_verifier_component_positive | pass | yes | The structural target-completeness verifier clears the component-level promotion threshold. |
| structural_selector_not_promoted | pass | no | Structural target score has been tested as a selector and rejected when it hurts support/abstention safety. |
| trained_qwen3b_student_positive | fail | yes | A trained Qwen 3B student must beat the calibrated/deployable support-preserving baseline. |
| qwen7b_support_delta_positive | fail | yes | A Qwen 7B support-delta run must add support-preserving coverage beyond the calibrated hybrid. |
| judge_reliability_submission_ready | fail | yes | Grounded-correctness claims must be human/stronger-judge adjudicated or explicitly caveated. |

## Blocking Failures

- trained_qwen3b_student_positive: A trained Qwen 3B student must beat the calibrated/deployable support-preserving baseline.
- qwen7b_support_delta_positive: A Qwen 7B support-delta run must add support-preserving coverage beyond the calibrated hybrid.
- judge_reliability_submission_ready: Grounded-correctness claims must be human/stronger-judge adjudicated or explicitly caveated.

## Decision

- Paper ready now: no
- Train or rent GPU now: no
- Buy more OpenAI labels now: no
- Keep calibrated hybrid as current deployable selector: yes
- Reason: The project now has a strong structural verifier component and clear negative selector evidence, but no trained smaller model or zero-call selector currently beats the calibrated hybrid support/coverage frontier.
- Next step: Stop hand-tuning structural selectors; either build a larger non-final listwise packet with explicit support/abstention labels, or run a bounded generation/repair experiment designed to beat the calibrated hybrid on support-preserving coverage.

No OpenAI calls, Prime jobs, or new spend were made for this artifact.
