# Hard Grounded Research Review Return Preflight

This generated preflight records whether real reviewer-return packets are present before import or apply. It is an operational readiness report, not evidence that human review, merge, gold promotion, scale, or novelty gates are complete.

## Summary

- Review return preflight ready: true
- Version: review-return-preflight-v1
- Input directory: `docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Expected return files: 40
- Present return files: 0
- Missing return files: 40
- Unexpected return files: 0
- Expected return rows: 160
- Present return rows: 0
- Latest import ready: true
- Latest import findings: 0
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| return_directory_present | false | missing docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns |
| expected_return_files_present | false | 0/40 expected returned files present |
| no_unexpected_return_files | true | no unexpected JSONL files |
| import_report_matches_current_returns | false | 40/40 files in latest import report; 0/40 files on disk |

## Expected Return Files

| Return file | Scope | Category | Reviewer | Rows | Present | Status |
| --- | --- | --- | --- | --- | --- | --- |
| hgr_review_batch_01.reviewer_a.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_01.reviewer_b.export.returned.jsonl | pilot_review | multi-hop synthesis | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_03.reviewer_a.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_03.reviewer_b.export.returned.jsonl | pilot_review | appended document lifecycle changes | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_04.reviewer_a.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_04.reviewer_b.export.returned.jsonl | pilot_review | table + text reasoning | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_07.reviewer_a.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_07.reviewer_b.export.returned.jsonl | pilot_review | citation supports fact but not conclusion | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_08.reviewer_a.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_08.reviewer_b.export.returned.jsonl | pilot_review | entity disambiguation | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3 | false | missing_return |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3 | false | missing_return |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3 | false | missing_return |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_b | 5 | false | missing_return |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5 | false | missing_return |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5 | false | missing_return |
