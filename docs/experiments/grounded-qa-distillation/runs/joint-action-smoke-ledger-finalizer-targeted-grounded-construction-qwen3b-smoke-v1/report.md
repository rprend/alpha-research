# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-29T05:09:20.644Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 29401 |
| result_json | yes | 1049 |
| report_md | yes | 440 |
| smoke_manifest_json | yes | 1329 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $11.384089 | $5.537100 | $0.040000 | $16.961189 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
