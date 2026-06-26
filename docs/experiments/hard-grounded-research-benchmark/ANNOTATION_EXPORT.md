# Hard Grounded Research Annotation Export

This generated packet exports the first review wave from the current pilot and expansion workbooks. It does not complete review, adjudicate labels, or promote gold; it gives reviewers stable JSONL files and checksums that can be imported back through the existing preflight and merge gates.

## Summary

| Field | Value |
| --- | --- |
| Export id | annotation-export-2026-06-26-wave-1 |
| Files | 30 |
| Rows | 124 |
| Pilot rows | 24 |
| Expansion rows | 100 |
| Reviewer fields only | true |
| Return readiness | true |
| Expected returned files | 30 |
| Expected returned rows | 124 |

## Import Contract

- Reviewers may edit only the `reviewer_fields` object.
- Required reviewer fields: final_label, final_answer, required_citation_ids, insufficient_or_conflicting_evidence, notes, reviewer_confidence
- Do not edit item metadata, evidence units, rubrics, quality findings, or challenge payloads.
- Gold promotion remains blocked until double-review preflight and merge gates pass.

## Return Readiness Checklist

| Step | Requirement |
| --- | --- |
| 1 | Return one JSONL file for each exported JSONL file. |
| 2 | Preserve item_id, source_workbook_id, export_scope, evidence_units, rubric, and quality_findings exactly. |
| 3 | Fill every required reviewer field on every row. |
| 4 | Use category_fit and generation_defect only for expansion_review packets. |
| 5 | Run the annotation import dry-run before applying returned packets. |

Dry-run command: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir>`

Apply command: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir> --apply`

## Export Files

| File | Scope | Category | Reviewer | Rows exported/expected return | SHA-256 prefix |
| --- | --- | --- | --- | --- | --- |
| generated/annotation-export/hgr_review_batch_10.reviewer_a.export.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3/3 | 9ca68c932c0f1cdd |
| generated/annotation-export/hgr_review_batch_10.reviewer_b.export.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3/3 | 1b0d805d2876695c |
| generated/annotation-export/hgr_review_batch_06.reviewer_a.export.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 2/2 | f49d88d562ff021e |
| generated/annotation-export/hgr_review_batch_06.reviewer_b.export.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 2/2 | dccb48ca6d498adf |
| generated/annotation-export/hgr_review_batch_09.reviewer_a.export.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3/3 | a3f4a88de959776b |
| generated/annotation-export/hgr_review_batch_09.reviewer_b.export.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3/3 | 604f923fd042461f |
| generated/annotation-export/hgr_review_batch_02.reviewer_a.export.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 2/2 | b01aa22592bea0f9 |
| generated/annotation-export/hgr_review_batch_02.reviewer_b.export.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 2/2 | e0a535be0943a491 |
| generated/annotation-export/hgr_review_batch_05.reviewer_a.export.jsonl | pilot_review | source authority conflicts | reviewer_a | 2/2 | 0c99b3a78a477fd5 |
| generated/annotation-export/hgr_review_batch_05.reviewer_b.export.jsonl | pilot_review | source authority conflicts | reviewer_b | 2/2 | 7c896303b7610d50 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5/5 | ffcc319492340730 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5/5 | 136a885e81dca3f9 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5/5 | 2a050625001b6ec7 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5/5 | 0a9d4aeb76472c3c |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5/5 | ffb87dc00692652b |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5/5 | feaa35bc61794984 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | entity disambiguation | reviewer_a | 5/5 | b55f2c7938e28ac5 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | entity disambiguation | reviewer_b | 5/5 | 054d2ca973106155 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5/5 | b94d613d8e7cc13b |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5/5 | 2d827fe30f5cb40f |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5/5 | 9036cf0b806689e2 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5/5 | 7116e99a99e88e02 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | source authority conflicts | reviewer_a | 5/5 | 49e9ba9c2c943925 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | source authority conflicts | reviewer_b | 5/5 | a2e0a99721f46849 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5/5 | ea4a84a761d88b58 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5/5 | de2e601c92d95bdf |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | table + text reasoning | reviewer_a | 5/5 | 2719d4081cff184e |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | table + text reasoning | reviewer_b | 5/5 | 6e8e1a7f45fdb863 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5/5 | 47d8c71c3e07f658 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5/5 | 99388512bd81ecd8 |
