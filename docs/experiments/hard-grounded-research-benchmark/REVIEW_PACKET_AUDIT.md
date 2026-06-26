# Hard Grounded Research Review Packet Audit

This generated audit verifies that the first-wave reviewer packet is internally consistent, returnable through the annotation import path, and covered by the current review execution plan. It does not complete human review or clear gold, merge, scale, or novelty blockers.

## Summary

- Review packet audit ready: true
- Version: review-packet-audit-v1
- Files checked: 30
- Rows checked: 124
- Unique items checked: 62
- Pilot files/rows: 10/24
- Expansion files/rows: 20/100
- Expansion categories covered in first wave: 10
- Required reviewer fields: 6
- Findings: 0
- Completion claim allowed: false

## Packet Contract

- Editable path: `reviewer_fields`
- Required reviewer fields: final_label, final_answer, required_citation_ids, insufficient_or_conflicting_evidence, notes, reviewer_confidence
- Expected return files/rows: 30/124

## Scope Coverage

| Scope | Category | Files |
| --- | --- | --- |
| pilot_review | cross-document contradiction | 2 |
| pilot_review | evidence insufficiency / abstention | 2 |
| pilot_review | temporal questions: as of date X | 2 |
| pilot_review | stale-vs-current document conflicts | 2 |
| pilot_review | source authority conflicts | 2 |
| expansion_review | appended document lifecycle changes | 2 |
| expansion_review | citation supports fact but not conclusion | 2 |
| expansion_review | cross-document contradiction | 2 |
| expansion_review | entity disambiguation | 2 |
| expansion_review | evidence insufficiency / abstention | 2 |
| expansion_review | multi-hop synthesis | 2 |
| expansion_review | source authority conflicts | 2 |
| expansion_review | stale-vs-current document conflicts | 2 |
| expansion_review | table + text reasoning | 2 |
| expansion_review | temporal questions: as of date X | 2 |

## Export Files

| File | Scope | Category | Reviewer | Rows | Findings |
| --- | --- | --- | --- | --- | --- |
| generated/annotation-export/hgr_review_batch_10.reviewer_a.export.jsonl | pilot_review | cross-document contradiction | reviewer_a | 3 | 0 |
| generated/annotation-export/hgr_review_batch_10.reviewer_b.export.jsonl | pilot_review | cross-document contradiction | reviewer_b | 3 | 0 |
| generated/annotation-export/hgr_review_batch_06.reviewer_a.export.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_a | 2 | 0 |
| generated/annotation-export/hgr_review_batch_06.reviewer_b.export.jsonl | pilot_review | evidence insufficiency / abstention | reviewer_b | 2 | 0 |
| generated/annotation-export/hgr_review_batch_09.reviewer_a.export.jsonl | pilot_review | temporal questions: as of date X | reviewer_a | 3 | 0 |
| generated/annotation-export/hgr_review_batch_09.reviewer_b.export.jsonl | pilot_review | temporal questions: as of date X | reviewer_b | 3 | 0 |
| generated/annotation-export/hgr_review_batch_02.reviewer_a.export.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_a | 2 | 0 |
| generated/annotation-export/hgr_review_batch_02.reviewer_b.export.jsonl | pilot_review | stale-vs-current document conflicts | reviewer_b | 2 | 0 |
| generated/annotation-export/hgr_review_batch_05.reviewer_a.export.jsonl | pilot_review | source authority conflicts | reviewer_a | 2 | 0 |
| generated/annotation-export/hgr_review_batch_05.reviewer_b.export.jsonl | pilot_review | source authority conflicts | reviewer_b | 2 | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | appended document lifecycle changes | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | appended document lifecycle changes | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | citation supports fact but not conclusion | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | cross-document contradiction | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | cross-document contradiction | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | entity disambiguation | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | entity disambiguation | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | evidence insufficiency / abstention | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | multi-hop synthesis | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | multi-hop synthesis | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | source authority conflicts | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | source authority conflicts | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | stale-vs-current document conflicts | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | table + text reasoning | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | table + text reasoning | reviewer_b | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | temporal questions: as of date X | reviewer_a | 5 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | temporal questions: as of date X | reviewer_b | 5 | 0 |

## Findings

No review packet audit findings.
