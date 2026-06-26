# Joint-Action Launch Plan

## Scope

- Provider: `prime_intellect`
- Packet: `joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`
- Preflight: `joint-action-launch-preflight-joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated smoke cost: $4.00
- Planned ledger action: `already_recorded`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $5.87832365 |
| External compute actual | $0.00000000 |
| Total actual before plan | $5.87832365 |
| Remaining before plan | $94.12167635 |
| Estimated total if launched | $9.87832365 |

Launch within budget: `true`

## Preflight Gate

| Check | Result |
| --- | --- |
| Dataset validation | passed |
| Train script compile | passed |
| Launch safety | passed |
| Prompt rows over limit | 0 |

## Commands

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/validate_joint_action_dataset_uv.py
RUN_ID=joint-action-qwen3b-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen3b-support-contrast-0-320-to-321-389-v1/run_joint_action_smoke.sh
```

## Conclusion

Status: `ready_for_backend_auth_then_launch`

Next step: Refresh Prime auth, verify pricing, then run the bounded command from this artifact.
