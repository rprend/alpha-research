# Joint-Action Launch Plan

## Scope

- Provider: `prime_intellect`
- Packet: `joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9`
- Preflight: `joint-action-launch-preflight-qwen7b-span-claim-construction-v9`
- Base model: `Qwen/Qwen2.5-7B-Instruct`
- Estimated smoke cost: $4.00
- Planned ledger action: `recorded`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $7.21957060 |
| External compute actual | $2.98410000 |
| Total actual before plan | $10.20367060 |
| Remaining before plan | $89.79632940 |
| Estimated total if launched | $14.20367060 |

Launch within budget: `true`

## Preflight Gate

| Check | Result |
| --- | --- |
| Dataset validation | passed |
| Train script compile | passed |
| Launch safety | passed |
| Prompt rows over limit | 8 |

## Commands

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=joint-action-qwen7b-span-claim-construction-smoke-eval-v9 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-span-claim-construction-curriculum-v9/run_joint_action_smoke.sh
```

## Conclusion

Status: `ready_for_backend_auth_then_launch`

Next step: Refresh Prime auth, verify pricing, then run the bounded command from this artifact.
