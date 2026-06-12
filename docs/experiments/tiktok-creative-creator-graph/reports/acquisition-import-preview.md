# Acquisition Import Preview

Generated: 2026-06-12T21:35:16.311Z

- Input rows: 6
- Normalized rows: 6
- Skipped rows: 0
- Duplicate normalized rows: 3
- Output accounts if imported: 3
- Ready to import: no
- Normalized rate: 100.0%
- Duplicate rate: 50.0%
- Mapped lineage rows: 0
- Unmapped lineage rows: 6

## Checks

- has_rows: pass - 6 input rows
- handle_extraction: pass - 100.0% normalized, threshold 75.0%
- duplicate_pressure: fail - 50.0% duplicate normalized rows, threshold 35.0%
- lineage_mapping: warn - no provider/wave lineage mapped; acceptable only for ad hoc search exports

## Source Files

- smoke-provider-results.jsonl: 3
- smoke-search-results.jsonl: 3
