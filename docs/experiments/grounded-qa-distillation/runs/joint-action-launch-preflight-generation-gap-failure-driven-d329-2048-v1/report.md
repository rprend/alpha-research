# Joint-Action Launch Preflight

## Scope

- Packet: `generation-gap-failure-driven-packet-d329-2026-06-28-v1`
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
| SFT full | 315 | 954 | 1424 | 1597 | 0 |
| DPO prompt | 1248 | 940 | 1285 | 1470 | 0 |
| DPO full | 2496 | 1020 | 1417 | 1614 | 0 |
| Eval prompt | 10 | 855 | 1394 | 1394 | 0 |

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
