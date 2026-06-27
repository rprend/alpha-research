# Joint-Action Remote Smoke Plan

This plan reduces the paid GPU run to one command after backend authentication is repaired.

```bash
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2/run_joint_action_smoke.sh
```

## Runner Checks

| Check | Status |
| --- | --- |
| Executable | pass |
| Bash syntax | pass |
| Dataset validation | pass |
| Bounded train | pass |
| Adapter eval | pass |
| Smoke manifest | pass |

Estimated total after smoke and judge: $10.3636 of $100.
