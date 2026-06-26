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
| generated/annotation-export/hgr_scale_batch_07.reviewer_a.export.jsonl | expansion_review | 5 | e84c8e4f59b71817 | 0 |
| generated/annotation-export/hgr_scale_batch_07.reviewer_b.export.jsonl | expansion_review | 5 | ee7508acea1d65e1 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_a.export.jsonl | expansion_review | 5 | e6b7265084e862f7 | 0 |
| generated/annotation-export/hgr_scale_batch_19.reviewer_b.export.jsonl | expansion_review | 5 | 49e20f8e9d63850e | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_a.export.jsonl | expansion_review | 5 | 6987c3a4ef153bb7 | 0 |
| generated/annotation-export/hgr_scale_batch_28.reviewer_b.export.jsonl | expansion_review | 5 | d91be376614ba834 | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_a.export.jsonl | expansion_review | 5 | 0fb3b9243f098e10 | 0 |
| generated/annotation-export/hgr_scale_batch_22.reviewer_b.export.jsonl | expansion_review | 5 | c0d081c0dd8b2d73 | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_a.export.jsonl | expansion_review | 5 | 09565f2612408e7f | 0 |
| generated/annotation-export/hgr_scale_batch_16.reviewer_b.export.jsonl | expansion_review | 5 | d5fd314cdf170d84 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_a.export.jsonl | expansion_review | 5 | 336573943e0accd1 | 0 |
| generated/annotation-export/hgr_scale_batch_01.reviewer_b.export.jsonl | expansion_review | 5 | 4aced230b70576ce | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_a.export.jsonl | expansion_review | 5 | 0e28375c8c4e4a0f | 0 |
| generated/annotation-export/hgr_scale_batch_13.reviewer_b.export.jsonl | expansion_review | 5 | 72579b4dff7cb4cf | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_a.export.jsonl | expansion_review | 5 | 6fda1b75c32cd163 | 0 |
| generated/annotation-export/hgr_scale_batch_04.reviewer_b.export.jsonl | expansion_review | 5 | d9b44570a8777b40 | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_a.export.jsonl | expansion_review | 5 | ab2598e0ce3ed7aa | 0 |
| generated/annotation-export/hgr_scale_batch_10.reviewer_b.export.jsonl | expansion_review | 5 | 6264487cbbbf82a4 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_a.export.jsonl | expansion_review | 5 | 9474c55657998db0 | 0 |
| generated/annotation-export/hgr_scale_batch_25.reviewer_b.export.jsonl | expansion_review | 5 | a095b69a92d13dea | 0 |
