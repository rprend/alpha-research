# Joint-Action Smoke Ledger Finalizer

Generated: 2026-06-28T06:04:10.958Z

Status: `waiting_for_smoke_artifacts`

## Artifact Gate

| Artifact | Exists | Bytes |
| --- | --- | ---: |
| predictions_jsonl | no | 0 |
| result_json | no | 0 |
| report_md | no | 0 |
| smoke_manifest_json | no | 0 |

## Budget Gate

| Current OpenAI | Current external | Actual cost to record | Total if recorded | Within $100 |
| ---: | ---: | ---: | ---: | --- |
| $7.797961 | $3.871400 | $0.178100 | $11.847461 | yes |

Ledger action: `recorded`

## Next Steps

- Run the bounded Qwen 3B smoke command on a GPU backend.
- Rerun this finalizer after predictions, result, report, and smoke manifest exist.
