# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-27T20:04:10.499Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 122144 |
| result_json | yes | 990 |
| report_md | yes | 428 |
| smoke_manifest_json | yes | 1427 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $6.774261 | $1.012700 | $0.191200 | $7.978161 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
