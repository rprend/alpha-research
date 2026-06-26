# Hard Grounded Research Annotation Import

This generated report validates returned reviewer JSONL files against the annotation export manifest. The importer defaults to dry-run validation; it updates reviewer workbooks only when invoked with `--apply` and fixture rows are not allowed.

## Summary

| Field | Value |
| --- | --- |
| Import ready | true |
| Apply requested | false |
| Applied to workbooks | false |
| Allow fixture | true |
| Returned files found | 30/30 |
| Rows checked | 124 |
| Rows importable | 124 |
| Findings | 0 |

## Import Rules

- Returned files must preserve every immutable benchmark field from the exported packet.
- Reviewers may change only `reviewer_fields`.
- Fixture rows are rejected unless `--allow-fixture` is passed, and fixture rows are never applied to workbooks.
- Expansion review rows must include `category_fit` and `generation_defect` before import can pass.

## Files

| Source file | Returned file | Scope | Rows | Importable rows | Findings | Applied |
| --- | --- | --- | --- | --- | --- | --- |
| generated/annotation-export/hgr_review_batch_10.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_10.reviewer_a.export.returned-fixture.jsonl | pilot_review | 3 | 3 | 0 | false |
| generated/annotation-export/hgr_review_batch_10.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_10.reviewer_b.export.returned-fixture.jsonl | pilot_review | 3 | 3 | 0 | false |
| generated/annotation-export/hgr_review_batch_06.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_06.reviewer_a.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_review_batch_06.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_06.reviewer_b.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_review_batch_09.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_09.reviewer_a.export.returned-fixture.jsonl | pilot_review | 3 | 3 | 0 | false |
| generated/annotation-export/hgr_review_batch_09.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_09.reviewer_b.export.returned-fixture.jsonl | pilot_review | 3 | 3 | 0 | false |
| generated/annotation-export/hgr_review_batch_02.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_02.reviewer_a.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_review_batch_02.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_02.reviewer_b.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_review_batch_05.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_05.reviewer_a.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_review_batch_05.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_review_batch_05.reviewer_b.export.returned-fixture.jsonl | pilot_review | 2 | 2 | 0 | false |
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_07.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_07.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_19.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_19.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_28.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_28.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_22.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_22.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_16.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_16.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_01.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_01.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_13.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_13.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_04.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_04.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_10.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_10.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_25.reviewer_a.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke/hgr_scale_batch_25.reviewer_b.export.returned-fixture.jsonl | expansion_review | 5 | 5 | 0 | false |
