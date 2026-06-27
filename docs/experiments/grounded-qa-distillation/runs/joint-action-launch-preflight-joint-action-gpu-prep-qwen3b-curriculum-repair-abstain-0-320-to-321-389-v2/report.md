# Joint-Action Launch Preflight

## Scope

- Packet: `joint-action-gpu-prep-qwen3b-curriculum-repair-abstain-0-320-to-321-389-v2`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated full GPU run: $12.00
- OpenAI calls: 0
- External compute cost: $0.00

## Checks

| Check | Result |
| --- | --- |
| Dataset validator | passed |
| Training script compile | passed |
| Supports SFT step cap | yes |
| Supports DPO step cap | yes |
| Push-to-hub default | off |
| Tracking default | off |

## Prompt Profile

| Surface | Rows | p50 approx tok. | p95 approx tok. | Max approx tok. | Rows over configured limit |
| --- | ---: | ---: | ---: | ---: | ---: |
| SFT full | 303 | 789 | 1208 | 1533 | 0 |
| DPO prompt | 139 | 650 | 1026 | 1116 | 0 |
| DPO full | 278 | 763 | 1178 | 1519 | 0 |
| Eval prompt | 69 | 589 | 1014 | 1138 | 0 |

Approximate token counts use `ceil(characters / 4)`, so they are conservative enough for launch-risk triage but not a tokenizer substitute.

## Local Dependencies

| Module | State |
| --- | --- |
| torch | present |
| transformers | missing |
| datasets | missing |
| accelerate | missing |
| peft | missing |
| trl | missing |
| bitsandbytes | missing |
| trackio | missing |

## Conclusion

Status: `remote_training_ready_local_runtime_incomplete`

Next step: Use a remote GPU environment with the missing TRL/PEFT stack, or install dependencies locally for a dry run.
