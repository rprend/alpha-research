# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T06:59:44.563Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 133300 |
| result_json | yes | 1004 |
| report_md | yes | 438 |
| smoke_manifest_json | yes | 1354 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $7.932706 | $4.049500 | $0.140000 | $12.122206 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
