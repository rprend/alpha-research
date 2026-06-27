# Joint-Action Launch Plan

## Scope

- Provider: `prime_intellect`
- Packet: `joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6`
- Preflight: `joint-action-launch-preflight-qwen7b-answerability-gated-v6`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated smoke cost: $1.00
- Planned ledger action: `recorded`

## Budget Gate

| Item | USD |
| --- | ---: |
| OpenAI actual | $6.62764060 |
| External compute actual | $0.87700000 |
| Total actual before plan | $7.50464060 |
| Remaining before plan | $92.49535940 |
| Estimated total if launched | $8.50464060 |

Launch within budget: `true`

## Preflight Gate

| Check | Result |
| --- | --- |
| Dataset validation | passed |
| Train script compile | passed |
| Launch safety | passed |
| Prompt rows over limit | 126 |

## Commands

```bash
uv run docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6/validate_joint_action_dataset_uv.py
BASE_MODEL=Qwen/Qwen2.5-7B-Instruct RUN_ID=joint-action-qwen7b-v6-answerability-gated-smoke-eval-v1 MAX_SFT_STEPS=20 MAX_DPO_STEPS=10 PUSH_TO_HUB=false REPORT_TO=none docs/experiments/grounded-qa-distillation/runs/joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6/run_joint_action_smoke.sh
```

## Conclusion

Status: `ready_for_backend_auth_then_launch`

Next step: Refresh Prime auth, verify pricing, then run the bounded command from this artifact.
