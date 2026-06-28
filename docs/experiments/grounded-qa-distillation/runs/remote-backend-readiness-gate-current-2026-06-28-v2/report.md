# Remote Backend Readiness Gate

Generated: 2026-06-28T23:37:01.497Z

Status: `remote_backend_ready_for_qwen3b_smoke`

Inputs: Prime gate `prime-auth-price-gate-current-2026-06-27-v1`; Prime plan `joint-action-launch-plan-prime-qwen3b-smoke-v1`; HF plan `joint-action-launch-plan-huggingface-qwen3b-smoke-v2`; HF attempt `huggingface-qwen3b-smoke-launch-attempt-2026-06-26-v1`.

## Checks

- PASS budget_under_cap_now: Actual tracked spend is $14.041616 / $100.
- PASS prime_cli_authenticated_now: Passed: prime --plain whoami
- PASS prime_live_price_gate_verified: Prime gate status is auth_and_live_price_verified; estimated total with Prime smoke and judge is $18.508781.
- PASS hf_cli_authenticated_now: Passed: hf auth whoami
- FAIL hf_jobs_permission_verified: Latest HF launch attempt status is failed_before_creation; blocker is auth_permission; evidence: missing permissions: job.write.
- PASS any_backend_ready_for_qwen3b_smoke: At least one backend is ready.

## Backend Summary

| Backend | Status | Estimate | Blocker |
| --- | --- | ---: | --- |
| Prime Intellect | ready | $4.00 | none |
| Hugging Face Jobs | blocked | $4.00 | Hugging Face rejected job creation because the active token is missing job.write permission for namespace rprendergast. |

## Budget Gate

| Actual spend | Remaining | Prime total if ready | HF total if ready | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $14.041616 | $85.958384 | $18.508781 | $18.508781 | $100.00 |

Next step: Run the bounded Qwen 3B smoke on the ready backend, then record actual compute spend and run integrity/dry/paid judge gates.

This gate makes no OpenAI calls, creates no remote compute jobs, and records no spend.
