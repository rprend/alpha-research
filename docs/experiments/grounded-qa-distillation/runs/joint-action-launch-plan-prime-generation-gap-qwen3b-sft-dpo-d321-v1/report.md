# Joint-Action Launch Plan

## Scope

- Provider: `prime_intellect`
- Packet: `generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1`
- Preflight: `joint-action-launch-preflight-generation-gap-qwen3b-sft-dpo-d321-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated smoke cost: $1.00
- Planned ledger action: `recorded`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $8.86582835 |
| External compute actual | $4.67950000 |
| Total actual before plan | $13.54532835 |
| Remaining before plan | $86.45467165 |
| Estimated total if launched | $14.54532835 |

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
uv run docs/experiments/grounded-qa-distillation/runs/generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-3B-Instruct RUN_ID=generation-gap-qwen3b-sft-dpo-smoke-d321-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1/run_joint_action_smoke.sh
```

## Conclusion

Status: `ready_for_backend_auth_then_launch`

Next step: Refresh Prime auth, verify pricing, then run the bounded command from this artifact.
