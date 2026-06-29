# Joint-Action Launch Preflight

## Scope

- Packet: `numeric-teacher-candidate-packet-frontier-repaired-v1`
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
| SFT full | 313 | 1161 | 1699 | 2062 | 39 |
| DPO prompt | 313 | 940 | 1323 | 1554 | 20 |
| DPO full | 626 | 1115 | 1574 | 2062 | 46 |
| Eval prompt | 10 | 929 | 1465 | 1465 | 2 |

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
