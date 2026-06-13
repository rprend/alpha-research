# Acquisition Import Preview

Generated: 2026-06-13T02:52:13.524Z

- Input rows: 5027
- Normalized rows: 5027
- Skipped rows: 0
- Duplicate normalized rows: 3103
- Output accounts if imported: 1924
- Ready to import: no
- Normalized rate: 100.0%
- Duplicate rate: 61.7%
- Mapped lineage rows: 5021
- Unmapped lineage rows: 6

## Checks

- has_rows: pass - 5027 input rows
- handle_extraction: pass - 100.0% normalized, threshold 75.0%
- duplicate_pressure: fail - 61.7% duplicate normalized rows, threshold 55.0% (metadata overlay)
- lineage_mapping: pass - 5021/5027 rows mapped to provider/wave lineage

## Source Files

- 2026-06-12T22-10-19-433Z-editorial-list-import.jsonl: 499
- 2026-06-13T00-11-50-106Z-editorial-list-import.jsonl: 1662
- 2026-06-13T00-39-23-080Z-editorial-list-import.jsonl: 209
- 2026-06-13T01-25-37-893Z-public-profile-enrichment.jsonl: 85
- 2026-06-13T01-31-21-859Z-public-profile-enrichment.jsonl: 185
- 2026-06-13T01-35-53-442Z-public-profile-enrichment.jsonl: 252
- 2026-06-13T01-42-59-960Z-editorial-list-import.jsonl: 209
- 2026-06-13T02-49-45-736Z-editorial-list-import.jsonl: 1870
- 2026-06-13T02-51-58-774Z-brightdata-profile-sample.jsonl: 29
- editorial-list-seeds-2026-06-12.jsonl: 21
- smoke-provider-results.jsonl: 3
- smoke-search-results.jsonl: 3
