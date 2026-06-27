# Rich Source Acquisition

This acquisition pass fetches richer public rows from Hugging Face Dataset Viewer for the next hard-grounded benchmark candidate.

## Result

- Rows: 479
- Qasper full-paper QA rows: 260
- HotpotQA multi-document rows: 219
- Output: `generated/rich-source-acquisition-rows.json`

## Why This Exists

The v4-v7 candidates were rejected because compact previews made the tasks recoverable by generic extraction scripts. This source file preserves paper sections, QA evidence snippets, and multi-document contexts so the next generator can build tasks from evidence content instead of public fields such as `Locator hint`, `Native response`, or `short result`.
