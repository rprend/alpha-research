# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T03:11:41.312Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 128162 |
| result_json | yes | 984 |
| report_md | yes | 438 |
| smoke_manifest_json | yes | 1410 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $7.522108 | $3.371700 | $0.184100 | $11.077908 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
