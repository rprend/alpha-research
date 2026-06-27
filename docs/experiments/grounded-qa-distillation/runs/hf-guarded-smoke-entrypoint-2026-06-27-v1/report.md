# Hugging Face Guarded Smoke Entrypoint

Generated: 2026-06-27T03:12:45.116Z

Status: `refuse_hf_job_creation`

This artifact is the fail-closed launch predicate for the Qwen 3B Hugging Face Jobs smoke. It refuses job creation unless the remote backend gate, HF permission evidence, launch plan, repair-signal audit, packet check, budget check, and explicit execute flag all pass.

## Decision

- HF job creation allowed: `false`
- Reason: HF job creation is refused until execute=true and every launch gate passes.
- Blockers: remote_gate_hf_ready, hf_job_write_permission_proven

## Checks

- PASS execute_flag_not_set: Dry-run/refusal mode; no HF job creation is allowed.
- PASS budget_under_cap_now: Actual spend is $5.896386 / $100.
- PASS projected_hf_path_under_cap: Projected HF smoke plus judge total is $9.363551 / $100.
- FAIL remote_gate_hf_ready: Remote gate status is remote_backend_blocked; HF backend status is blocked.
- PASS hf_cli_authenticated_now: Passed: hf auth whoami
- PASS hf_jobs_cli_available: Passed: hf jobs --help
- FAIL hf_job_write_permission_proven: Latest HF attempt status is failed_before_creation; backend_job_created=false; failure=missing permissions: job.write.
- PASS hf_launch_plan_within_budget: HF launch plan total is $9.896386 before judge.
- PASS repair_signal_present: Repair signal audit status is repair_regeneration_signal_present_but_untested.
- PASS packet_is_qwen3b_joint_action: Packet base model is Qwen/Qwen2.5-3B-Instruct.

## Budget

| Actual spend | External compute | Remaining | Projected HF total | Cap |
| ---: | ---: | ---: | ---: | ---: |
| $5.896386 | $0.000000 | $94.103614 | $9.363551 | $100.00 |

Dry-run bounded command after all gates pass:

```bash
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
```

Example HF Jobs wrapper to verify before use:

```bash
hf jobs run --flavor a10g-large --timeout 2h --secrets HF_TOKEN -- RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
```

This entrypoint makes no OpenAI calls, creates no HF jobs, and records no spend.
