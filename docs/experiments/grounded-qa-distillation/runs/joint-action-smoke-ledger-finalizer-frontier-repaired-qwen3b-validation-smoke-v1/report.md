# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-29T02:52:17.356Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 219814 |
| result_json | yes | 1119 |
| report_md | yes | 445 |
| smoke_manifest_json | yes | 1296 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $11.384089 | $5.397100 | $0.140000 | $16.921189 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
