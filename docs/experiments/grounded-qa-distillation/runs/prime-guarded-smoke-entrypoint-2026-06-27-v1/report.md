# Prime Guarded Smoke Entrypoint

Generated: 2026-06-27T15:55:16.649Z

Status: `refuse_prime_pod_creation`

This artifact is the fail-closed launch predicate for the Qwen 3B Prime smoke. It refuses pod creation unless the remote backend gate, Prime auth/price gate, runbook, repair-signal audit, packet check, budget check, and explicit execute flag all pass.

## Decision

- Pod creation allowed: `false`
- Reason: Pod creation is refused until execute=true and every launch gate passes.
- Blockers: none

## Checks

- PASS execute_flag_not_set: Dry-run/refusal mode; no pod creation is allowed.
- PASS budget_under_cap_now: Actual spend is $5.915586 / $100.
- PASS projected_prime_path_under_cap: Projected Prime smoke plus judge total is $10.363551 / $100.
- PASS remote_gate_prime_ready: Remote gate status is remote_backend_ready_for_qwen3b_smoke; Prime backend status is ready.
- PASS prime_auth_price_gate_ready: Prime auth/price gate status is auth_and_live_price_verified.
- PASS prime_cli_authenticated_now: Passed: prime --plain whoami
- PASS runbook_ready: Runbook status is ready_after_prime_auth_and_live_price.
- PASS repair_signal_present: Repair signal audit status is repair_regeneration_signal_present_but_untested.
- PASS packet_is_qwen3b_joint_action: Packet base model is Qwen/Qwen2.5-3B-Instruct.

## Budget

| Actual spend | External compute | Remaining | Projected Prime total | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $5.915586 | $0.019200 | $94.084414 | $10.363551 | $100.00 |

Dry-run launch command after all gates pass:

```bash
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
```

This entrypoint makes no OpenAI calls, creates no GPU jobs, and records no spend.
