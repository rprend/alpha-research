# Hard Grounded Research Annotation Import Smoke

This generated smoke test proves the exported annotation packet can be returned with only `reviewer_fields` changed. It writes fixture returned rows for contract testing only; these rows are not human review and must not count toward gold promotion.

## Summary

| Field | Value |
| --- | --- |
| Smoke ready | true |
| Fixture not human review | true |
| Files checked | 30 |
| Rows checked | 124 |
| Findings | 0 |
| Reviewer fields only enforced | true |

## Contract

- Source export checksums must match the export manifest before fixture rows are generated.
- Immutable benchmark fields must remain byte-stable after a returned review packet is parsed.
- Every returned row must contain the required reviewer fields.
- Fixture rows are explicitly non-human annotations.

## Files

| Source file | Scope | Rows | Returned SHA-256 prefix | Findings |
| --- | --- | --- | --- | --- |
| generated/annotation-export/hgr_review_batch_10.reviewer_a.export.jsonl | pilot_review | 3 | 9f00496385e50d5e | 0 |
| generated/annotation-export/hgr_review_batch_10.reviewer_b.export.jsonl | pilot_review | 3 | 4d881131e0591c03 | 0 |
| generated/annotation-export/hgr_review_batch_06.reviewer_a.export.jsonl | pilot_review | 2 | aadcf14f22df6502 | 0 |
| generated/annotation-export/hgr_review_batch_06.reviewer_b.export.jsonl | pilot_review | 2 | 6ac9557d0cd4b928 | 0 |
| generated/annotation-export/hgr_review_batch_09.reviewer_a.export.jsonl | pilot_review | 3 | 5e2b969cc358d0c0 | 0 |
| generated/annotation-export/hgr_review_batch_09.reviewer_b.export.jsonl | pilot_review | 3 | bf61145d0e650bd9 | 0 |
| generated/annotation-export/hgr_review_batch_02.reviewer_a.export.jsonl | pilot_review | 2 | 6e2d1caf11ee686a | 0 |
| generated/annotation-export/hgr_review_batch_02.reviewer_b.export.jsonl | pilot_review | 2 | ea362482f8cf532a | 0 |
| generated/annotation-export/hgr_review_batch_05.reviewer_a.export.jsonl | pilot_review | 2 | 9305318fb24122c9 | 0 |
| generated/annotation-export/hgr_review_batch_05.reviewer_b.export.jsonl | pilot_review | 2 | 8fe356c4ca7af4d4 | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | 5 | e39b2d284fa3255c | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | 5 | ef5fa6c353da06f7 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | 5 | 72ae9e38e995f8c9 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | 5 | d6ced7d38b9c6d05 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | 5 | 2dcfeb7efe5356b8 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | 5 | b8cada570157ee5c | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | 5 | 036d8a13e13acbae | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | 5 | 0db0212cbea7bd96 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | 5 | aea0b8df47f7be02 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | 5 | 3d02e89f5df92682 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | 5 | 00e15aba8f672805 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | 5 | 5e9b87f7bd2cc779 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | 5 | 2c72d707f5e2f809 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | 5 | 8c3d5d7220d63258 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | 5 | 80402c28b4c9ba56 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | 5 | d041820cac25c2c8 | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | 5 | 96ec734eded36ad5 | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | 5 | dab23d4d97f8897a | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | 5 | 416a663c52879b27 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | 5 | f5d56deca822d96a | 0 |
