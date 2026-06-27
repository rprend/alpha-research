# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-27T17:10:38.829Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 125993 |
| result_json | yes | 956 |
| report_md | yes | 427 |
| smoke_manifest_json | yes | 1380 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $6.031246 | $0.235000 | $0.159900 | $6.426146 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
