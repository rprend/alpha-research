# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-27T17:35:56.016Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 127511 |
| result_json | yes | 970 |
| report_md | yes | 427 |
| smoke_manifest_json | yes | 1379 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $6.188961 | $0.394900 | $0.159100 | $6.742961 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
