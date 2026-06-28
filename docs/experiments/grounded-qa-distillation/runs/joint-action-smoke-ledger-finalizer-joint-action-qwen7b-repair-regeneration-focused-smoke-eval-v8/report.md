# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-27T23:59:29.529Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 100957 |
| result_json | yes | 921 |
| report_md | yes | 421 |
| smoke_manifest_json | yes | 1483 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $6.912478 | $1.203900 | $1.780200 | $9.896578 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
