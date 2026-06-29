# Joint-Action Launch Plan

## Scope

- Provider: `prime_intellect`
- Packet: `support-boundary-schema-packet-frontier-repaired-length-reduced-v1`
- Preflight: `joint-action-launch-preflight-support-boundary-schema-length-reduced-frontier-repaired-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated smoke cost: $1.00
- Planned ledger action: `recorded`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $11.38408865 |
| External compute actual | $5.81710000 |
| Total actual before plan | $17.20118865 |
| Remaining before plan | $82.79881135 |
| Estimated total if launched | $18.20118865 |

Launch within budget: `true`

## Preflight Gate

| Check | Result |
| --- | --- |
| Dataset validation | passed |
| Train script compile | passed |
| Launch safety | passed |
| Prompt rows over limit | 50 |

## Commands

```bash
uv run docs/experiments/grounded-qa-distillation/runs/support-boundary-schema-packet-frontier-repaired-length-reduced-v1/validate_joint_action_dataset_uv.py
RUN_ID=support-boundary-schema-qwen3b-smoke-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/support-boundary-schema-packet-frontier-repaired-length-reduced-v1/run_joint_action_smoke.sh
```

## Conclusion

Status: `ready_for_backend_auth_then_launch`

Next step: Refresh Prime auth, verify pricing, then run the bounded command from this artifact.
