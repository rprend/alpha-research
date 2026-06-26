# Hard Grounded Research Control And Ablation Plan

This generated plan defines negative controls and ablations for each hard-grounded category. It is designed to test whether measured failures come from the intended hard-grounding mechanism rather than source count, prompt length, dataset identity, citation count, or surface-form retrieval.

## Summary

- Plan ready: true
- Version: control-ablation-plan-v1
- Categories: 10
- Negative controls: 10
- Ablation conditions: 30
- Lineage rows linked: 276
- Blocked claim gates: 4
- Completion claim allowed: false

## Readiness Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_negative_controls | true | 10/10 categories have negative controls and at least three ablations |
| controls_link_lookup_and_reporting_contracts | true | 10 controls link lookup contrast and reporting columns |
| controls_have_source_lineage_support | true | 276 lineage rows across control categories |
| claims_remain_diagnostic | true | 4/4 confirmatory gates blocked; release status=blocked |

## Category Controls

| Category | Negative control | Ablations | Diagnostic question | Primary metrics | Claim status |
| --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | single-hop variant containing one required entity fact and no bridge requirement | remove_second_hop_evidence<br>replace_distractor_with_same_entity_page<br>balance_source_count_to_two_documents | Does performance drop only when the answer requires composing both hops rather than retrieving either fact? | answer_correct<br>evidence_recall<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | current-only variant with stale snapshot removed | remove_document_dates<br>swap_stale_and_current_order<br>balance_snapshot_count | Does performance depend on temporal/source-state control rather than claim-text retrieval? | answer_correct<br>citation_faithfulness<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | original-body-only variant where no appendix or lifecycle update changes the answer | remove_appendix_update<br>hide_appendix_label<br>append_update_as_unlabeled_evidence | Does performance drop when appended material supersedes or qualifies the original body? | answer_correct<br>evidence_recall<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | table-cell lookup variant whose answer is entailed by the cell alone | remove_surrounding_text<br>remove_table_caption<br>shuffle_nonanswer_rows | Does performance depend on integrating table denotation with surrounding text? | answer_correct<br>citation_precision<br>conclusion_support | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | single-authority variant where all cited sources agree and have equal authority | remove_authority_metadata<br>reverse_source_order<br>balance_authority_source_count | Does performance depend on authority ranking rather than selecting the clearest prose? | answer_correct<br>citation_faithfulness<br>abstention_quality | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | sufficient-evidence variant with explicit entailment for the answer | add_related_but_nonentailed_premise<br>remove_insufficiency_label<br>balance_candidate_evidence_count | Does performance distinguish related evidence from evidence that entails the conclusion? | abstention_quality<br>conclusion_support<br>citation_faithfulness | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | premise-and-conclusion variant where the citation entails both fact and conclusion | remove_conclusion_support_sentence<br>keep_true_premise_only<br>balance_citation_count | Does performance separate premise support from conclusion support? | conclusion_support<br>citation_faithfulness<br>answer_correct | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | unambiguous entity variant with no same-name distractor | remove_disambiguating_context<br>add_same_surface_form_distractor<br>balance_entity_mention_count | Does performance depend on resolving the intended entity rather than matching surface form? | answer_correct<br>evidence_recall<br>citation_precision | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | timeless variant where the same answer is valid before and after the as-of date | remove_as_of_date<br>add_future_evidence<br>balance_pre_and_post_date_evidence | Does performance depend on applying the as-of date rather than retrieving the newest evidence? | answer_correct<br>citation_faithfulness<br>abstention_quality | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | consensus variant where all documents support the same conclusion | remove_conflicting_document<br>hide_conflict_marker<br>balance_support_and_refute_source_count | Does performance identify contradiction instead of smoothing evidence into consensus? | abstention_quality<br>conclusion_support<br>citation_faithfulness | diagnostic_only_until_review_scale_and_novelty_clear |

## Claim Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| gold_review_complete | false | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_merge_ready | false | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | false | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
