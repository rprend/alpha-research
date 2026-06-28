# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T08:21:02.553Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 113481 |
| result_json | yes | 946 |
| report_md | yes | 438 |
| smoke_manifest_json | yes | 1347 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $8.071813 | $4.189500 | $0.270000 | $12.531313 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
