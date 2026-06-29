# Joint-Action Launch Preflight

## Scope

- Packet: `support-boundary-schema-packet-frontier-repaired-length-reduced-v1`
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
| SFT full | 293 | 865 | 1368 | 1684 | 6 |
| DPO prompt | 979 | 698 | 1005 | 1160 | 0 |
| DPO full | 1958 | 902 | 1368 | 1684 | 44 |
| Eval prompt | 10 | 615 | 820 | 820 | 0 |

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

Status: `ready_for_bounded_gpu_smoke_with_length_truncation_risk`

Next step: A bounded smoke can test whether the coverage-aware objective moves support/coverage; reduce evidence pack or raise max length before a full run.
