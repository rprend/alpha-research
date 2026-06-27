# Prime Guarded Smoke Entrypoint

Generated: 2026-06-27T03:12:44.604Z

Status: `refuse_prime_pod_creation`

This artifact is the fail-closed launch predicate for the Qwen 3B Prime smoke. It refuses pod creation unless the remote backend gate, Prime auth/price gate, runbook, repair-signal audit, packet check, budget check, and explicit execute flag all pass.

## Decision

- Pod creation allowed: `false`
- Reason: Pod creation is refused until execute=true and every launch gate passes.
- Blockers: remote_gate_prime_ready, prime_auth_price_gate_ready, prime_cli_authenticated_now

## Checks

- PASS execute_flag_not_set: Dry-run/refusal mode; no pod creation is allowed.
- PASS budget_under_cap_now: Actual spend is $5.896386 / $100.
- PASS projected_prime_path_under_cap: Projected Prime smoke plus judge total is $10.363551 / $100.
- FAIL remote_gate_prime_ready: Remote gate status is remote_backend_blocked; Prime backend status is blocked.
- FAIL prime_auth_price_gate_ready: Prime auth/price gate status is auth_or_price_blocked.
- FAIL prime_cli_authenticated_now: Failed: prime --plain whoami; Error: API key unauthorized. Please check that your API key has the correct permissions, generate a new one at https://app.primeintellect.ai/dashboard/tokens or run 'prime login' to configure a new API key.
- PASS runbook_ready: Runbook status is ready_after_prime_auth_and_live_price.
- PASS repair_signal_present: Repair signal audit status is repair_regeneration_signal_present_but_untested.
- PASS packet_is_qwen3b_joint_action: Packet base model is Qwen/Qwen2.5-3B-Instruct.

## Budget

| Actual spend | External compute | Remaining | Projected Prime total | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $5.896386 | $0.000000 | $94.103614 | $10.363551 | $100.00 |

Dry-run launch command after all gates pass:

```bash
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
```

This entrypoint makes no OpenAI calls, creates no GPU jobs, and records no spend.
