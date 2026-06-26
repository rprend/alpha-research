# Hard Grounded Research Review Preflight

This generated report checks reviewer workbooks before merge. It is a work queue for completing independent human review; it does not promote machine labels to gold.

## Summary

- Workbooks: 20
- Review rows: 60
- Complete review rows: 0
- Incomplete review rows: 60
- Preflight ready: false

## Workbook Status

| Workbook | Category | Reviewer | Complete | Incomplete | High-attention |
| --- | --- | --- | --- | --- | --- |
| hgr_review_batch_01.reviewer_a | multi-hop synthesis | reviewer_a | 0/3 | 3 | 1 |
| hgr_review_batch_01.reviewer_b | multi-hop synthesis | reviewer_b | 0/3 | 3 | 1 |
| hgr_review_batch_02.reviewer_a | stale-vs-current document conflicts | reviewer_a | 0/3 | 3 | 3 |
| hgr_review_batch_02.reviewer_b | stale-vs-current document conflicts | reviewer_b | 0/3 | 3 | 3 |
| hgr_review_batch_03.reviewer_a | appended document lifecycle changes | reviewer_a | 0/3 | 3 | 0 |
| hgr_review_batch_03.reviewer_b | appended document lifecycle changes | reviewer_b | 0/3 | 3 | 0 |
| hgr_review_batch_04.reviewer_a | table + text reasoning | reviewer_a | 0/3 | 3 | 2 |
| hgr_review_batch_04.reviewer_b | table + text reasoning | reviewer_b | 0/3 | 3 | 2 |
| hgr_review_batch_05.reviewer_a | source authority conflicts | reviewer_a | 0/3 | 3 | 3 |
| hgr_review_batch_05.reviewer_b | source authority conflicts | reviewer_b | 0/3 | 3 | 3 |
| hgr_review_batch_06.reviewer_a | evidence insufficiency / abstention | reviewer_a | 0/3 | 3 | 0 |
| hgr_review_batch_06.reviewer_b | evidence insufficiency / abstention | reviewer_b | 0/3 | 3 | 0 |
| hgr_review_batch_07.reviewer_a | citation supports fact but not conclusion | reviewer_a | 0/3 | 3 | 1 |
| hgr_review_batch_07.reviewer_b | citation supports fact but not conclusion | reviewer_b | 0/3 | 3 | 1 |
| hgr_review_batch_08.reviewer_a | entity disambiguation | reviewer_a | 0/3 | 3 | 1 |
| hgr_review_batch_08.reviewer_b | entity disambiguation | reviewer_b | 0/3 | 3 | 1 |
| hgr_review_batch_09.reviewer_a | temporal questions: as of date X | reviewer_a | 0/3 | 3 | 3 |
| hgr_review_batch_09.reviewer_b | temporal questions: as of date X | reviewer_b | 0/3 | 3 | 3 |
| hgr_review_batch_10.reviewer_a | cross-document contradiction | reviewer_a | 0/3 | 3 | 3 |
| hgr_review_batch_10.reviewer_b | cross-document contradiction | reviewer_b | 0/3 | 3 | 3 |

## Next Incomplete Rows

| Workbook | Item | Priority | Missing fields | Quality findings |
| --- | --- | --- | --- | --- |
| hgr_review_batch_01.reviewer_a | hgr_multi_hop_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_01.reviewer_a | hgr_multi_hop_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_01.reviewer_a | hgr_multi_hop_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_01.reviewer_b | hgr_multi_hop_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_01.reviewer_b | hgr_multi_hop_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_01.reviewer_b | hgr_multi_hop_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_02.reviewer_a | hgr_stale_current_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_02.reviewer_a | hgr_stale_current_001_pilot_002 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_02.reviewer_a | hgr_stale_current_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_02.reviewer_b | hgr_stale_current_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_02.reviewer_b | hgr_stale_current_001_pilot_002 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_02.reviewer_b | hgr_stale_current_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_03.reviewer_a | hgr_appendix_lifecycle_001_pilot_001 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_03.reviewer_a | hgr_appendix_lifecycle_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_03.reviewer_a | hgr_appendix_lifecycle_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_03.reviewer_b | hgr_appendix_lifecycle_001_pilot_001 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_03.reviewer_b | hgr_appendix_lifecycle_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_03.reviewer_b | hgr_appendix_lifecycle_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_04.reviewer_a | hgr_table_text_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_04.reviewer_a | hgr_table_text_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_04.reviewer_a | hgr_table_text_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_04.reviewer_b | hgr_table_text_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_04.reviewer_b | hgr_table_text_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_04.reviewer_b | hgr_table_text_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_05.reviewer_a | hgr_authority_conflict_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_05.reviewer_a | hgr_authority_conflict_001_pilot_002 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_05.reviewer_a | hgr_authority_conflict_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_05.reviewer_b | hgr_authority_conflict_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_05.reviewer_b | hgr_authority_conflict_001_pilot_002 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_05.reviewer_b | hgr_authority_conflict_001_pilot_003 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_06.reviewer_a | hgr_abstain_001_pilot_001 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_06.reviewer_a | hgr_abstain_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_06.reviewer_a | hgr_abstain_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_06.reviewer_b | hgr_abstain_001_pilot_001 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_06.reviewer_b | hgr_abstain_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_06.reviewer_b | hgr_abstain_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_07.reviewer_a | hgr_citation_overreach_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
| hgr_review_batch_07.reviewer_a | hgr_citation_overreach_001_pilot_002 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_07.reviewer_a | hgr_citation_overreach_001_pilot_003 | standard_review | final_label<br>final_answer<br>notes<br>reviewer_confidence | none |
| hgr_review_batch_07.reviewer_b | hgr_citation_overreach_001_pilot_001 | review_carefully | final_label<br>final_answer<br>notes<br>reviewer_confidence | candidate_answer_not_lexically_visible |
