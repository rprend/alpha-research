# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T02:26:06.962Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 114812 |
| result_json | yes | 1010 |
| report_md | yes | 438 |
| smoke_manifest_json | yes | 1445 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $7.366608 | $3.218000 | $0.153700 | $10.738308 | yes |

Ledger action: `recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
