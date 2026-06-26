# Hard Grounded Research Analysis Plan

This generated plan pre-specifies how the benchmark should answer the paper question: what makes grounded research hard beyond simple fact lookup? It is a pilot analysis plan, not final statistical evidence.

## Summary

- Analysis plan ready: true
- Categories: 10
- Constructs mapped: 10
- Scored systems: 5
- Challenge types: 8
- Response metrics: 5
- Hypotheses: 4
- Model families: 4
- Covariates: 7
- Claim gates: 3
- Reviewed items: 0/300
- Completion claim allowed: false

## Response Metrics

- `answer_correct`
- `evidence_recall`
- `citation_faithfulness`
- `conclusion_support`
- `abstention_quality`

## Challenge Types

- `as_of_date_constraint`
- `authority_conflict`
- `citation_overreach_probe`
- `cross_document_contradiction`
- `document_lifecycle_appendix`
- `insufficiency_probe`
- `native_row`
- `stale_current_conflict`

## Hypotheses

| ID | Claim | Primary metrics | Primary contrasts | Minimum evidence |
| --- | --- | --- | --- | --- |
| h1_non_lookup_tasks_reduce_grounded_accuracy | Hard-grounded challenge types reduce answer correctness and citation faithfulness relative to native-row lookup-style tasks. | answer_correct<br>citation_faithfulness | native_row_vs_challenge_type<br>native_row_vs_category | At least 30 HF-derived paper-eligible items per category and two eligible model baselines over the same derived source. |
| h2_support_is_not_equivalent_to_citation_overlap | Citation overlap is insufficient: systems can cite relevant facts while failing conclusion support. | conclusion_support<br>citation_precision<br>citation_faithfulness | citation_overreach_probe_vs_native_row<br>conclusion_support_delta_by_system | HF-derived citation-overreach items with deterministic premise/conclusion separation and optional audit review. |
| h3_temporal_authority_and_contradiction_failures_are_distinct | Temporal, source-authority, and contradiction tasks produce separable failure signatures rather than one generic retrieval failure. | answer_correct<br>abstention_quality<br>conclusion_support | as_of_date_vs_authority_conflict<br>authority_conflict_vs_cross_document_contradiction | Reviewed items in all three constructs plus per-system challenge-type diagnostics. |
| h4_verification_trades_answer_coverage_for_groundedness | Citation-aware verification improves conclusion support or citation faithfulness while reducing answer coverage on some challenge types. | answer_correct<br>citation_faithfulness<br>conclusion_support<br>abstention_quality | citation_aware_verifier_vs_lexical_baseline<br>external_model_vs_verifier_by_challenge | Paired system outputs on identical reviewed tasks with uncertainty intervals. |

## Model Families

| ID | Purpose | Unit | Outputs | Current status |
| --- | --- | --- | --- | --- |
| paired_task_bootstrap | Estimate paired deltas between systems and challenge types without assuming normal task-level errors. | task | mean_delta<br>ci95_low<br>ci95_high | pilot_available |
| category_level_descriptive_intervals | Report category means and conservative intervals once each category reaches the reviewed item target. | category | category_mean<br>worst_case_half_width<br>reviewed_n | blocked_on_human_review |
| mixed_effects_logistic_or_beta_model | Separate effects of system, challenge type, category, and item source when reviewed scale is available. | task_system_score | system_effect<br>challenge_effect<br>category_effect<br>source_dataset_effect | specified_not_estimable_yet |
| failure_mode_enrichment | Test whether observed failure modes concentrate in the intended constructs. | failure_case | failure_mode_rate<br>category_enrichment<br>challenge_enrichment | pilot_available |

## Covariates

| Covariate | Source | Required |
| --- | --- | --- |
| category | construct_map | yes |
| challenge_type | baseline_analysis.by_challenge_type | yes |
| source_dataset | benchmark_spec.datasets | yes |
| system_id | baseline_analysis.systems | yes |
| evidence_unit_count | pilot_or_gold_suite | yes |
| required_citation_count | pilot_or_gold_suite | yes |
| review_status | release_gate_and_review_reports | yes |

## Claim Gates

| Claim scope | Allowed now | Requirements | Current evidence |
| --- | --- | --- | --- |
| pilot diagnostics | yes | scored pilot systems<br>failure atlas<br>paper tables | 5 systems; 116 failure cases; 6 tables |
| category-level benchmark conclusions | yes | 30 HF-derived paper-eligible items per category<br>category scale ready<br>novelty audit final before completion claims | 300/300 HF-derived target items |
| final novelty claim | no | final June 2026 literature refresh<br>novelty audit final | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 |
