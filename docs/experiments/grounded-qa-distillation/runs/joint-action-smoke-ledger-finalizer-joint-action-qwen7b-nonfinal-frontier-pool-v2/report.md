# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T09:33:29.162Z

Status: `actual_completed_recorded`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | yes | 423633 |
| result_json | yes | 1120 |
| report_md | yes | 445 |
| smoke_manifest_json | yes | 1169 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $8.219918 | $4.679500 | $0.220000 | $13.119418 | yes |

Ledger action: `already_recorded`

## Next Steps

- Regenerate total budget with node scripts/grounded-qa-distillation-total-budget.mjs.
- Run the Qwen 3B post-smoke pipeline default mode before any paid judge.
