# Hard Grounded Research Item Quality Audit

This audit is generated from `generated/pilot-suite.json`. It is a pre-adjudication repair queue, not a gold-data verdict.

## Summary

- Items: 30
- Repair before gold: 3
- Review carefully: 20
- Standard review: 7

## Category Summary

| Category | Items | Repair before gold | Review carefully | Standard review |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | 3 | 0 | 1 | 2 |
| stale-vs-current document conflicts | 3 | 0 | 3 | 0 |
| appended document lifecycle changes | 3 | 3 | 0 | 0 |
| table + text reasoning | 3 | 0 | 3 | 0 |
| source authority conflicts | 3 | 0 | 3 | 0 |
| evidence insufficiency / abstention | 3 | 0 | 0 | 3 |
| citation supports fact but not conclusion | 3 | 0 | 1 | 2 |
| entity disambiguation | 3 | 0 | 3 | 0 |
| temporal questions: as of date X | 3 | 0 | 3 | 0 |
| cross-document contradiction | 3 | 0 | 3 | 0 |

## Repair Queue

| Item | Category | Priority | Findings |
| --- | --- | --- | --- |
| hgr_multi_hop_001_pilot_001 | multi-hop synthesis | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_stale_current_001_pilot_001 | stale-vs-current document conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_stale_current_001_pilot_002 | stale-vs-current document conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_stale_current_001_pilot_003 | stale-vs-current document conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_appendix_lifecycle_001_pilot_001 | appended document lifecycle changes | repair_before_gold | high:lifecycle_without_appendix_evidence |
| hgr_appendix_lifecycle_001_pilot_002 | appended document lifecycle changes | repair_before_gold | high:lifecycle_without_appendix_evidence |
| hgr_appendix_lifecycle_001_pilot_003 | appended document lifecycle changes | repair_before_gold | high:lifecycle_without_appendix_evidence |
| hgr_table_text_001_pilot_001 | table + text reasoning | review_carefully | medium:native_row_with_mixed_sources<br>medium:expected_answer_not_lexically_visible |
| hgr_table_text_001_pilot_002 | table + text reasoning | review_carefully | medium:native_row_with_mixed_sources |
| hgr_table_text_001_pilot_003 | table + text reasoning | review_carefully | medium:native_row_with_mixed_sources<br>medium:expected_answer_not_lexically_visible |
| hgr_authority_conflict_001_pilot_001 | source authority conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_authority_conflict_001_pilot_002 | source authority conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_authority_conflict_001_pilot_003 | source authority conflicts | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_citation_overreach_001_pilot_001 | citation supports fact but not conclusion | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_entity_disambiguation_001_pilot_001 | entity disambiguation | review_carefully | medium:native_row_with_mixed_sources<br>medium:expected_answer_not_lexically_visible |
| hgr_entity_disambiguation_001_pilot_002 | entity disambiguation | review_carefully | medium:native_row_with_mixed_sources |
| hgr_entity_disambiguation_001_pilot_003 | entity disambiguation | review_carefully | medium:native_row_with_mixed_sources |
| hgr_as_of_date_001_pilot_001 | temporal questions: as of date X | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_as_of_date_001_pilot_002 | temporal questions: as of date X | review_carefully | medium:expected_answer_not_lexically_visible |
| hgr_as_of_date_001_pilot_003 | temporal questions: as of date X | review_carefully | medium:expected_answer_not_lexically_visible |

## Interpretation

Items marked `repair_before_gold` should not be promoted to gold labels until the cited issue is fixed or explicitly waived in reviewer notes. Items marked `review_carefully` can still become gold, but the reviewer should verify that the evidence really tests the intended hard-grounded category.
