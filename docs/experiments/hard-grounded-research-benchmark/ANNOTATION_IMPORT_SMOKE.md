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
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | 5 | 3d1682b1473499d4 | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | 5 | 89d29881770430db | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | 5 | 720b7fc1a95baf40 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | 5 | 2d72744694e3acfa | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | 5 | b6f77596e39219c0 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | 5 | 24385e0a7a56eec2 | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | 5 | 572455cdaccb3e2c | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | 5 | cf5f7b34d9707c91 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | 5 | 12851dfe00ce2d31 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | 5 | eaa4178c5f0389b0 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | 5 | 56f1c6fba6ccbf5f | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | 5 | 634b1cb77ee0feb7 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | 5 | 9ed63f221deac999 | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | 5 | 07049f9711f043f5 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | 5 | b73a9a4502abeefd | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | 5 | cf5b4d796cd19a2d | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | 5 | a440d97d198292cd | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | 5 | 30f4cb2107f10ea6 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | 5 | 6c6a8997d2dd361f | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | 5 | c8a7f75b7555d3f5 | 0 |
