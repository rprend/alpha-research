# Hard Grounded Research Statistical Reporting Template

This generated template defines the minimum result-reporting surface for a paper submission. It prevents reviewed results from being reported as broad benchmark claims unless each category table includes the estimand, lookup contrast, denominator, uncertainty method, sensitivity status, and active claim gates.

## Summary

- Template ready: true
- Version: statistical-reporting-template-v1
- Categories: 10
- Required table sections: 4
- Required metrics: 6
- Sensitivity checks: 6
- Blocked claim gates: 4
- Completion claim allowed: false

## Readiness Checks

| Check | Passed | Detail |
| --- | --- | --- |
| all_categories_have_reporting_rows | true | 10 reporting rows for 10 estimands and 10 lookup contrasts |
| primary_metrics_have_definitions_and_columns | true | 6 required metrics; 30 category primary-metric slots |
| uncertainty_and_denominator_rules_present | true | minimum reviewed items/category=30; rows with uncertainty=10 |
| claims_remain_gated_until_review_scale_and_novelty | true | 4/4 confirmatory gates blocked; completion_claim_allowed=false |

## Required Table Sections

| Section | Purpose | Required columns |
| --- | --- | --- |
| headline_macro_table | Report macro results over merge-ready reviewed items only, with eligible model baselines separated from diagnostic systems. | system_id<br>eligible_model_baseline<br>reviewed_item_count<br>answer_correctness<br>evidence_recall<br>citation_precision<br>citation_faithfulness<br>conclusion_support<br>abstention_quality |
| category_mechanism_table | Report one row per category and system with the category estimand, lookup control contrast, primary metrics, uncertainty, and claim status. | category<br>system_id<br>estimand_id<br>lookup_control_comparison<br>primary_metrics<br>uncertainty_method<br>claim_status |
| sensitivity_summary_table | Report whether each proposed conclusion survives every pre-registered sensitivity check. | claim_id<br>primary_result<br>sensitivity_check_id<br>decision_rule<br>sensitivity_status |
| claim_gate_table | Report which paper claims are allowed, diagnostic-only, or prohibited under current review, scale, and novelty gates. | claim_id<br>claim_status<br>supporting_artifact<br>blocking_gate |

## Category Reporting Rows

| Category | Estimand | Simple lookup control | Hard grounding operation | Primary metrics | Uncertainty | Claim status |
| --- | --- | --- | --- | --- | --- | --- |
| multi-hop synthesis | estimand_multi_hop_synthesis | Retrieve one page or one sentence containing a relevant entity fact. | Compose two or more required hops and reject a topically relevant but nonessential page. | answer_correct<br>evidence_recall<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| stale-vs-current document conflicts | estimand_stale_vs_current_document_conflicts | Find a document that contains the requested claim text. | Select the controlling current snapshot and mark stale evidence as non-controlling. | answer_correct<br>citation_faithfulness<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| appended document lifecycle changes | estimand_appended_document_lifecycle_changes | Find the original paper body passage that states a relevant claim. | Detect appended or lifecycle material that narrows, qualifies, or supersedes the original body. | answer_correct<br>evidence_recall<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| table + text reasoning | estimand_table_text_reasoning | Extract a table cell or caption fact. | Combine table denotation with surrounding text before drawing the conclusion. | answer_correct<br>citation_precision<br>conclusion_support | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| source authority conflicts | estimand_source_authority_conflicts | Find a clear source that says a plausible answer. | Rank sources by authority and explain why lower-authority evidence is rejected. | answer_correct<br>citation_faithfulness<br>abstention_quality | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| evidence insufficiency / abstention | estimand_evidence_insufficiency_abstention | Find a related fact or candidate evidence passage. | Decide whether the evidence entails the requested conclusion and abstain when it does not. | abstention_quality<br>conclusion_support<br>citation_faithfulness | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| citation supports fact but not conclusion | estimand_citation_supports_fact_but_not_conclusion | Find a citation that supports a true premise. | Separate premise support from conclusion support and reject unsupported inference. | conclusion_support<br>citation_faithfulness<br>answer_correct | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| entity disambiguation | estimand_entity_disambiguation | Find a fact about a name, title, place, or abbreviation. | Resolve the intended entity and reject same-name or same-title distractors. | answer_correct<br>evidence_recall<br>citation_precision | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| temporal questions: as of date X | estimand_temporal_questions_as_of_date_x | Find the most salient or newest relevant evidence. | Filter evidence by the requested as-of date and exclude future or stale evidence. | answer_correct<br>citation_faithfulness<br>abstention_quality | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |
| cross-document contradiction | estimand_cross_document_contradiction | Find documents that mention the topic. | Partition incompatible evidence and report conflict or apply the stated control rule. | abstention_quality<br>conclusion_support<br>citation_faithfulness | Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05. | diagnostic_only_until_review_scale_and_novelty_clear |

## Claim Gates

| Gate | Passed | Detail | Blocker |
| --- | --- | --- | --- |
| gold_review_complete | false | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_merge_ready | false | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | false | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | false | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
