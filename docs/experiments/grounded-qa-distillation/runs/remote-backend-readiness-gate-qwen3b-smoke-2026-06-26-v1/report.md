# Remote Backend Readiness Gate

Generated: 2026-06-26T22:57:06.042Z

Status: `remote_backend_blocked`

## Checks

- PASS budget_under_cap_now: Actual tracked spend is $5.896386 / $100.
- FAIL prime_cli_authenticated_now: Failed: prime --plain whoami; Error: API key unauthorized. Please check that your API key has the correct permissions, generate a new one at https://app.primeintellect.ai/dashboard/tokens or run 'prime login' to configure a new API key.
- FAIL prime_live_price_gate_verified: Prime gate status is auth_or_price_blocked; estimated total with Prime smoke and judge is $10.363551.
- PASS hf_cli_authenticated_now: Passed: hf auth whoami
- FAIL hf_jobs_permission_verified: Latest HF launch attempt status is failed_before_creation; blocker is auth_permission; evidence: missing permissions: job.write.
- FAIL any_backend_ready_for_qwen3b_smoke: No backend is currently ready for the bounded Qwen 3B smoke.

## Backend Summary

| Backend | Status | Estimate | Blocker |
| --- | --- | ---: | --- |
| Prime Intellect | blocked | $4.00 | Prime CLI auth/live pricing is not verified. |
| Hugging Face Jobs | blocked | $3.00 | Hugging Face rejected job creation because the active token is missing job.write permission for namespace rprendergast. |

## Budget Gate

| Actual spend | Remaining | Prime total if ready | HF total if ready | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $5.896386 | $94.103614 | $10.363551 | $9.363551 | $100.00 |

Next step: Do not launch compute. Repair Prime credentials or use a Hugging Face token with job.write and available billing, then rerun this gate.

This gate makes no OpenAI calls, creates no remote compute jobs, and records no spend.
