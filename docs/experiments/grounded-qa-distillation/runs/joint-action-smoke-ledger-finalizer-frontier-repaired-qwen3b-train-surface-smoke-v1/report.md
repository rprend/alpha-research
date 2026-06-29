# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-29T06:37:24.094Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 689246 |
| result_json | yes | 1147 |
| report_md | yes | 448 |
| smoke_manifest_json | yes | 1351 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $11.384089 | $5.617100 | $0.200000 | $17.201189 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
