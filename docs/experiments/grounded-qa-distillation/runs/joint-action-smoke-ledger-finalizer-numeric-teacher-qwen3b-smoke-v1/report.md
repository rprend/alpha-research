# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-29T08:23:03.827Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 26133 |
| result_json | yes | 1039 |
| report_md | yes | 440 |
| smoke_manifest_json | yes | 2076 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $11.637106 | $5.857100 | $0.090000 | $17.584206 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
