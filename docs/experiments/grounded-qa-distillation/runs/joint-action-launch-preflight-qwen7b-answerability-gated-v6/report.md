# Joint-Action Launch Preflight

## Scope

- Packet: `joint-action-gpu-prep-qwen7b-answerability-gated-coverage-curriculum-v6`
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
| SFT full | 303 | 1057 | 1476 | 1801 | 13 |
| DPO prompt | 829 | 947 | 1296 | 1481 | 58 |
| DPO full | 1658 | 1051 | 1475 | 1851 | 55 |
| Eval prompt | 69 | 856 | 1282 | 1405 | 4 |

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
