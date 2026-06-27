# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-27T16:25:55.756Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 107525 |
| result_json | yes | 955 |
| report_md | yes | 428 |
| smoke_manifest_json | yes | 1361 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $5.896386 | $0.019200 | $0.215800 | $6.131386 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
