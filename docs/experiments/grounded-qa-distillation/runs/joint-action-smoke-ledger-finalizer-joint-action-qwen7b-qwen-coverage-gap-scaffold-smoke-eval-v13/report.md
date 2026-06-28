# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T06:04:10.939Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 140651 |
| result_json | yes | 1024 |
| report_md | yes | 438 |
| smoke_manifest_json | yes | 1459 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $7.797961 | $3.727600 | $0.143800 | $11.669361 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
