# Hard Grounded Research Review Return Contract

This generated contract defines the required shape of real returned reviewer packets before they can be imported into pilot or expansion review workbooks. It does not contain returned human labels and does not clear review, merge, gold, scale, or novelty blockers.

## Summary

- Review return contract ready: true
- Version: review-return-contract-v1
- Expected return files: 30
- Expected return rows: 124
- Pilot return files/rows: 10/24
- Expansion return files/rows: 20/100
- Rejection rules: 6
- Findings: 0
- Completion claim allowed: false

## Commands

- Dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns`
- Apply after clean dry run: `node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-returns --apply`

## Field Contract

- Editable path: `reviewer_fields`
- Required reviewer fields: final_label, final_answer, required_citation_ids, insufficient_or_conflicting_evidence, notes, reviewer_confidence
- Reviewers must not edit: item_id, category, challenge_type, question, candidate_answer, evidence_units, required_dimensions, rubric, quality_findings

## Expected Return Files

| Return file | Scope | Category | Reviewer | Rows | Expansion-only fields |
| --- | --- | --- | --- | --- | --- |
| hgr_review_batch_10.reviewer_a.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3 | n/a |
| hgr_review_batch_10.reviewer_b.export.returned.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3 | n/a |
| hgr_review_batch_06.reviewer_a.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 2 | n/a |
| hgr_review_batch_06.reviewer_b.export.returned.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 2 | n/a |
| hgr_review_batch_09.reviewer_a.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3 | n/a |
| hgr_review_batch_09.reviewer_b.export.returned.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3 | n/a |
| hgr_review_batch_02.reviewer_a.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 2 | n/a |
| hgr_review_batch_02.reviewer_b.export.returned.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 2 | n/a |
| hgr_review_batch_05.reviewer_a.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_a | 2 | n/a |
| hgr_review_batch_05.reviewer_b.export.returned.jsonl | pilot_review | source authority conflicts | reviewer_b | 2 | n/a |
| hgr_scale_batch_07.reviewer_a.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_07.reviewer_b.export.returned.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_19.reviewer_a.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_19.reviewer_b.export.returned.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_28.reviewer_a.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_28.reviewer_b.export.returned.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_22.reviewer_a.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_22.reviewer_b.export.returned.jsonl | expansion_review | entity disambiguation | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_16.reviewer_a.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_16.reviewer_b.export.returned.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_01.reviewer_a.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_01.reviewer_b.export.returned.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_13.reviewer_a.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_13.reviewer_b.export.returned.jsonl | expansion_review | source authority conflicts | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_04.reviewer_a.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_04.reviewer_b.export.returned.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_10.reviewer_a.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_10.reviewer_b.export.returned.jsonl | expansion_review | table + text reasoning | reviewer_b | 5 | category_fit, generation_defect |
| hgr_scale_batch_25.reviewer_a.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5 | category_fit, generation_defect |
| hgr_scale_batch_25.reviewer_b.export.returned.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5 | category_fit, generation_defect |

## Rejection Rules

| Rule | Rejects |
| --- | --- |
| missing_or_extra_return_file | Any missing expected returned file, unexpected filename, or changed row count. |
| immutable_field_changed | Any change outside reviewer_fields, including item metadata, evidence units, rubric, quality findings, or source workbook identity. |
| missing_required_reviewer_field | Any row missing one of: final_label, final_answer, required_citation_ids, insufficient_or_conflicting_evidence, notes, reviewer_confidence. |
| invalid_label_or_citation_policy | Unsupported final_label values, unsupported citations, missing citations for supported/refuted/conflict labels, or citations on insufficient/invalid labels. |
| fixture_annotation_rejected | Fixture rows in real returned packets; fixtures require --allow-fixture and must never be applied. |
| expansion_field_missing | Expansion rows missing category_fit or generation_defect. |

## Findings

No review return contract findings.
