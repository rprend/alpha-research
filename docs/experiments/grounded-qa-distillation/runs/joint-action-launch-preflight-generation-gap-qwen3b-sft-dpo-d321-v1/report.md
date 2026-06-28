# Joint-Action Launch Preflight

## Scope

- Packet: `generation-gap-qwen3b-sft-dpo-launch-packet-d321-2026-06-28-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated full GPU run: $1.00
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
| SFT full | 315 | 731 | 1199 | 1373 | 0 |
| DPO prompt | 521 | 709 | 1059 | 1245 | 0 |
| DPO full | 1042 | 795 | 1189 | 1389 | 0 |
| Eval prompt | 10 | 631 | 1169 | 1169 | 0 |

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
