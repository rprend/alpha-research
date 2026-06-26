# Hard Grounded Research Gold Adjudication Plan

This generated plan turns the pilot gold blocker into item-level adjudication work. It does not synthesize labels, adjudicate empty reviews, promote gold, or clear the release gate.

## Summary

- Plan ready: true
- Version: gold-adjudication-plan-v1
- Pilot items: 30
- Categories: 10
- Completed reviews: 0
- Missing reviews: 60
- Promotion-ready items: 0
- Pilot return packets: 10
- Pilot missing packets: 10
- Completion claim allowed: false

## Checks

| Check | Passed | Detail |
| --- | --- | --- |
| pilot_items_loaded | true | 30/30 pilot items planned |
| all_categories_covered | true | 10 categories; 3/3/3/3/3/3/3/3/3/3 items per category |
| review_collection_linked | true | 10 pilot return packets; 10 missing |
| quality_controls_linked | true | 2 required reviews per item |
| gold_promotion_still_blocked | true | 0/30 valid reviewed items |

## Blocking Gates

| Gate | Passed | Detail | Required action |
| --- | --- | --- | --- |
| review_preflight_ready | no | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| review_merge_ready | no | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| gold_review_complete | no | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |

## Category Coverage

| Category | Items | Completed reviews | Missing reviews | Promotion-ready items |
| --- | --- | --- | --- | --- |
| multi-hop synthesis | 3 | 0 | 6 | 0 |
| stale-vs-current document conflicts | 3 | 0 | 6 | 0 |
| appended document lifecycle changes | 3 | 0 | 6 | 0 |
| table + text reasoning | 3 | 0 | 6 | 0 |
| source authority conflicts | 3 | 0 | 6 | 0 |
| evidence insufficiency / abstention | 3 | 0 | 6 | 0 |
| citation supports fact but not conclusion | 3 | 0 | 6 | 0 |
| entity disambiguation | 3 | 0 | 6 | 0 |
| temporal questions: as of date X | 3 | 0 | 6 | 0 |
| cross-document contradiction | 3 | 0 | 6 | 0 |

## Adjudication Steps

| # | Step |
| --- | --- |
| 1 | Collect both reviewer returns for every pilot item using REVIEW_COLLECTION_TRACKER.md. |
| 2 | Run annotation import dry-run and apply only after immutable fields and reviewer fields validate. |
| 3 | Regenerate pilot review preflight and review merge. |
| 4 | For every disagreement or invalid merge, fill required adjudicator fields before promotion. |
| 5 | Regenerate gold summary and release gate; only promote when all 30 pilot items are valid reviewed items. |

## Item Plan

| Item | Category | Completed reviews | Missing reviews | Adjudication status | Scoring focus |
| --- | --- | --- | --- | --- | --- |
| hgr_multi_hop_001_pilot_001 | multi-hop synthesis | 0 | 2 | awaiting_reviewer_returns | answer_exactness<br>required_hop_coverage<br>citation_minimality |
| hgr_multi_hop_001_pilot_002 | multi-hop synthesis | 0 | 2 | awaiting_reviewer_returns | answer_exactness<br>required_hop_coverage<br>citation_minimality |
| hgr_multi_hop_001_pilot_003 | multi-hop synthesis | 0 | 2 | awaiting_reviewer_returns | answer_exactness<br>required_hop_coverage<br>citation_minimality |
| hgr_stale_current_001_pilot_001 | stale-vs-current document conflicts | 0 | 2 | awaiting_reviewer_returns | temporal_grounding<br>stale_evidence_rejection<br>citation_date_use |
| hgr_stale_current_001_pilot_002 | stale-vs-current document conflicts | 0 | 2 | awaiting_reviewer_returns | temporal_grounding<br>stale_evidence_rejection<br>citation_date_use |
| hgr_stale_current_001_pilot_003 | stale-vs-current document conflicts | 0 | 2 | awaiting_reviewer_returns | temporal_grounding<br>stale_evidence_rejection<br>citation_date_use |
| hgr_appendix_lifecycle_001_pilot_001 | appended document lifecycle changes | 0 | 2 | awaiting_reviewer_returns | document_lifecycle_awareness<br>supersession_handling<br>section_provenance |
| hgr_appendix_lifecycle_001_pilot_002 | appended document lifecycle changes | 0 | 2 | awaiting_reviewer_returns | document_lifecycle_awareness<br>supersession_handling<br>section_provenance |
| hgr_appendix_lifecycle_001_pilot_003 | appended document lifecycle changes | 0 | 2 | awaiting_reviewer_returns | document_lifecycle_awareness<br>supersession_handling<br>section_provenance |
| hgr_table_text_001_pilot_001 | table + text reasoning | 0 | 2 | awaiting_reviewer_returns | table_denotation<br>textual_support<br>calculation_trace |
| hgr_table_text_001_pilot_002 | table + text reasoning | 0 | 2 | awaiting_reviewer_returns | table_denotation<br>textual_support<br>calculation_trace |
| hgr_table_text_001_pilot_003 | table + text reasoning | 0 | 2 | awaiting_reviewer_returns | table_denotation<br>textual_support<br>calculation_trace |
| hgr_authority_conflict_001_pilot_001 | source authority conflicts | 0 | 2 | awaiting_reviewer_returns | authority_ranking<br>conflict_resolution<br>source_type_transparency |
| hgr_authority_conflict_001_pilot_002 | source authority conflicts | 0 | 2 | awaiting_reviewer_returns | authority_ranking<br>conflict_resolution<br>source_type_transparency |
| hgr_authority_conflict_001_pilot_003 | source authority conflicts | 0 | 2 | awaiting_reviewer_returns | authority_ranking<br>conflict_resolution<br>source_type_transparency |
| hgr_abstain_001_pilot_001 | evidence insufficiency / abstention | 0 | 2 | awaiting_reviewer_returns | abstention_precision<br>missing_evidence_identification<br>hallucination_avoidance |
| hgr_abstain_001_pilot_002 | evidence insufficiency / abstention | 0 | 2 | awaiting_reviewer_returns | abstention_precision<br>missing_evidence_identification<br>hallucination_avoidance |
| hgr_abstain_001_pilot_003 | evidence insufficiency / abstention | 0 | 2 | awaiting_reviewer_returns | abstention_precision<br>missing_evidence_identification<br>hallucination_avoidance |
| hgr_citation_overreach_001_pilot_001 | citation supports fact but not conclusion | 0 | 2 | awaiting_reviewer_returns | claim_citation_alignment<br>unsupported_inference_detection<br>sentence_level_support |
| hgr_citation_overreach_001_pilot_002 | citation supports fact but not conclusion | 0 | 2 | awaiting_reviewer_returns | claim_citation_alignment<br>unsupported_inference_detection<br>sentence_level_support |
| hgr_citation_overreach_001_pilot_003 | citation supports fact but not conclusion | 0 | 2 | awaiting_reviewer_returns | claim_citation_alignment<br>unsupported_inference_detection<br>sentence_level_support |
| hgr_entity_disambiguation_001_pilot_001 | entity disambiguation | 0 | 2 | awaiting_reviewer_returns | entity_resolution<br>distractor_rejection<br>citation_entity_match |
| hgr_entity_disambiguation_001_pilot_002 | entity disambiguation | 0 | 2 | awaiting_reviewer_returns | entity_resolution<br>distractor_rejection<br>citation_entity_match |
| hgr_entity_disambiguation_001_pilot_003 | entity disambiguation | 0 | 2 | awaiting_reviewer_returns | entity_resolution<br>distractor_rejection<br>citation_entity_match |
| hgr_as_of_date_001_pilot_001 | temporal questions: as of date X | 0 | 2 | awaiting_reviewer_returns | as_of_filtering<br>time_bounded_citations<br>answer_date_qualification |
| hgr_as_of_date_001_pilot_002 | temporal questions: as of date X | 0 | 2 | awaiting_reviewer_returns | as_of_filtering<br>time_bounded_citations<br>answer_date_qualification |
| hgr_as_of_date_001_pilot_003 | temporal questions: as of date X | 0 | 2 | awaiting_reviewer_returns | as_of_filtering<br>time_bounded_citations<br>answer_date_qualification |
| hgr_contradiction_001_pilot_001 | cross-document contradiction | 0 | 2 | awaiting_reviewer_returns | contradiction_detection<br>evidence_set_partitioning<br>uncertainty_calibration |
| hgr_contradiction_001_pilot_002 | cross-document contradiction | 0 | 2 | awaiting_reviewer_returns | contradiction_detection<br>evidence_set_partitioning<br>uncertainty_calibration |
| hgr_contradiction_001_pilot_003 | cross-document contradiction | 0 | 2 | awaiting_reviewer_returns | contradiction_detection<br>evidence_set_partitioning<br>uncertainty_calibration |
