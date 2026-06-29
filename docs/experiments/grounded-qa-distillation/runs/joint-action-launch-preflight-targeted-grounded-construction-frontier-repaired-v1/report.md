# Joint-Action Launch Preflight

## Scope

- Packet: `targeted-grounded-construction-packet-frontier-repaired-v1`
- Base model: `Qwen/Qwen2.5-3B-Instruct`
- Estimated full GPU run: $4.00
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
| SFT full | 293 | 1225 | 1772 | 2130 | 3 |
| DPO prompt | 524 | 1070 | 1421 | 1618 | 5 |
| DPO full | 1048 | 1300 | 1781 | 2144 | 18 |
| Eval prompt | 10 | 993 | 1534 | 1534 | 0 |

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
