# Hard Grounded Research Release Gate

This generated gate is intentionally conservative. It prevents the pilot benchmark from being treated as paper-ready or public-release-ready until review, licensing, model baselines, and novelty evidence are complete.

## Summary

- Status: release_ready
- Pilot items: 30
- Scored systems in baseline analysis: 5
- Blockers: 0

## Checks

| Check | Passed | Detail | Blocker if failed |
| --- | --- | --- | --- |
| hf_derived_label_suite_ready | yes | hf-derived-label-suite-v1; 30/30 paper-eligible derived labels; datasets=5; findings=0 |  |
| gold_review_complete | yes | 30/30 HF-derived gold labels ready; human reviewed=0/30 |  |
| annotation_protocol_present | yes | 60 pilot review rows; 540 expansion review rows |  |
| review_preflight_ready | yes | HF-derived labels bypass mandatory human-review preflight; optional audit rows=0/60 |  |
| review_operations_ready | yes | 60 pilot incomplete rows; 540 expansion incomplete rows |  |
| review_triage_present | yes | 23 urgent/high pilot items ranked from 2 model baselines |  |
| annotation_assignment_plan_present | yes | 12 pilot assignments; 10 expansion assignments; first-wave expansion rows=100 |  |
| review_assignment_audit_ready | yes | review-assignment-audit-v1; assignments=22; double_review=22; blocked=0 |  |
| reviewer_handoff_ready | yes | 160 handoff rows across 40 files; gates=6/6 |  |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |  |
| review_execution_plan_ready | yes | review-execution-plan-v1; rows_remaining=600; reviewer_hours=74.4; blocking_review_checks=0 |  |
| review_packet_audit_ready | yes | review-packet-audit-v1; files=40; rows=160; findings=0 |  |
| review_return_contract_ready | yes | review-return-contract-v1; files=40; rows=160; findings=0 |  |
| review_return_preflight_ready | yes | review-return-preflight-v1; present=0/40; missing=40; latest_import_ready=true |  |
| review_return_checklist_ready | yes | review-return-checklist-v1; packets=40; rows=160; missing=40 |  |
| review_collection_tracker_ready | yes | review-collection-tracker-v1; packets=40; missing=40; returned=0 |  |
| review_wave_schedule_ready | yes | review-wave-schedule-v1; waves=2; packets=40; missing=40 |  |
| review_dropoff_manifest_ready | yes | review-dropoff-manifest-v1; packets=40; hashes=40; rows=160 |  |
| review_intake_validator_ready | yes | review-intake-validator-v1; packets=40; accepted=0; blocked=40 |  |
| gold_adjudication_plan_ready | yes | gold-adjudication-plan-v1; items=30; missing_reviews=60; promotion_ready=0 |  |
| scale_adjudication_plan_ready | yes | scale-adjudication-plan-v1; batches=30; missing_review_rows=540; merge_ready=0 |  |
| scale_gap_ledger_ready | yes | scale-gap-ledger-v1; deficit=300; planned_candidates=270; planned_review_rows=540 |  |
| adjudication_readiness_ready | yes | pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false |  |
| annotator_agreement_ready | yes | completed_metric_pairs=0; agreement_claim_allowed=false |  |
| annotation_export_ready | yes | 160 exported rows across 40 files; pilot=60; expansion=100 |  |
| annotation_return_readiness_ready | yes | 40 expected returned files; 160 expected returned rows |  |
| annotation_import_smoke_ready | yes | 160 returned fixture rows checked across 40 files; findings=0 |  |
| annotation_import_path_ready | yes | 160/160 importable returned rows; files=40/40; fixture_allowed=true; applied=false |  |
| review_calibration_ready | yes | 10 calibration sentinels; minimum_accuracy=0.9; gold_promotion_allowed=false |  |
| annotation_quality_control_ready | yes | 1092 review rows governed; calibration_sentinels=10; completion_claim_allowed=false |  |
| gold_promotion_smoke_ready | yes | 30/30 fixture gold items; release_eligible=false |  |
| expansion_promotion_smoke_ready | yes | 270/270 fixture expansion items merge-ready; release_eligible=false |  |
| expansion_review_preflight_ready | yes | HF-derived labels bypass mandatory expansion human-review preflight; optional audit rows=0/540 |  |
| expansion_review_merge_ready | yes | HF-derived labels bypass mandatory expansion review merge; optional audit merge-ready=0/270 |  |
| review_merge_ready | yes | HF-derived labels bypass mandatory human-review merge; optional audit merge-ready=0/30 |  |
| category_scale_ready | yes | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready |  |
| power_plan_ready | yes | 30 reviewed items/category; 300 total target; remaining=300 |  |
| unknown_license_resolved | yes | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true |  |
| license_impact_clear | yes | 135/270 expansion candidates depend on unknown-license sources; 54 replaced; 81 pointer-only; packaged clearance=true |  |
| license_remediation_plan_present | yes | 54 replacement-path candidates; 81 pointer-only candidates |  |
| license_remediated_expansion_candidates_present | yes | 54/54 replacement-path candidates materialized |  |
| public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |  |
| public_package_integrity_ready | yes | public-package-integrity-v1; suites=2; items=300; findings=0; pointer_text_leaks=0 |  |
| public_package_schema_ready | yes | public-package-schema-v1; suites=2; items=300; evidence_units=996; schema_violations=0 |  |
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |  |
| scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |  |
| repair_queue_clear | yes | 0 repair-before-gold items |  |
| frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |  |
| baseline_uncertainty_present | yes | 5 systems with descriptive task-level intervals |  |
| failure_atlas_ready | yes | 116 failure cases; 8 failure modes; systems=5 |  |
| hypothesis_test_matrix_ready | yes | hypothesis-test-matrix-v1; hypotheses=10; observed_signature_categories=10; reviewed_deficit=300 |  |
| result_interpretation_guide_ready | yes | result-interpretation-guide-v1; rules=30; target_n=300; blocked_gates=1 |  |
| evidence_sufficiency_audit_ready | yes | evidence-sufficiency-audit-v1; items=30; evidence_contracts=30; insufficiency=3; overreach=3 |  |
| estimand_registry_ready | yes | estimand-registry-v1; estimands=10; target_n=300; blocked_gates=1 |  |
| sensitivity_analysis_plan_ready | yes | sensitivity-analysis-plan-v1; checks=6; metrics=6; blocked_gates=1 |  |
| lookup_contrast_registry_ready | yes | lookup-contrast-registry-v1; categories=10; lookup_controls=10; estimand_links=10 |  |
| statistical_reporting_template_ready | yes | statistical-reporting-template-v1; categories=10; table_sections=4; blocked_gates=1 |  |
| control_ablation_plan_ready | yes | control-ablation-plan-v1; categories=10; negative_controls=10; ablations=30 |  |
| error_codebook_ready | yes | error-codebook-v1; codes=8; categories=10; observed_cases=116 |  |
| paper_tables_ready | yes | 6 paper tables; systems=5; blockers=1 |  |
| analysis_plan_ready | yes | 4 hypotheses; 4 model families; HF-derived=300/300 |  |
| paper_claim_ledger_ready | yes | 8 claims; allowed=4; diagnostic=2; prohibited=2 |  |
| supplement_index_ready | yes | supplement-index-v2; sections=6; tables=6; claims=8 |  |
| reproduction_capsule_ready | yes | reproduction-capsule-v1; commands=60; hashes=97; blockers=1 |  |
| citation_metadata_ready | yes | citation-metadata-v1; artifact_hashes=97; caveats=6; release_blockers=1 |  |
| reviewer_faq_ready | yes | reviewer-faq-v1; questions=6; blockers=1; prohibited_claims=3 |  |
| responsible_use_ready | yes | 6 policy rules; active_restrictions=2; public_leaderboard_allowed=false |  |
| data_statement_ready | yes | data-statement-v1; source_datasets=6; scaled_items=270; pointer_only_items=15 |  |
| model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |  |
| model_reporting_card_ready | yes | model-reporting-card-v1; systems=7; eligible=2; leaderboard_allowed=false |  |
| submission_contract_ready | yes | submission-contract-v1; pilot_tasks=30; leaderboard_allowed=false |  |
| scoring_contract_ready | yes | scoring-contract-v1; metrics=8; required=6/6; leaderboard_allowed=false |  |
| novelty_audit_final | yes | checked=2026-06-26 status=final_bounded final_novelty_claim_allowed=true completion_claim_allowed=false high_risk_categories=5 |  |
| novelty_refresh_ledger_ready | yes | 4 refresh queries; 10 related sources; completion_claim_allowed=false |  |
| novelty_evidence_registry_present | yes | 22 related-work sources registered; completion_claim_allowed=false |  |
| novelty_claim_boundaries_ready | yes | 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims |  |
| novelty_watchlist_ready | yes | novelty-watchlist-v1; sources=4; high_risk=1; completion_claim_allowed=false |  |
| novelty_resolution_matrix_ready | yes | novelty-resolution-matrix-v1; sources=4; unresolved=4; high_risk=1 |  |
| novelty_finalization_preflight_ready | yes | novelty-finalization-preflight-v1; unresolved=4; high_risk_unresolved=1; final_allowed=true |  |
| novelty_source_identity_audit_ready | yes | novelty-source-identity-audit-v1; verified=0/4; invalid_or_unverified=4 |  |
| novelty_source_review_packets_ready | yes | novelty-source-review-packets-v1; packets=4; high_risk=1; final_allowed=false |  |
| novelty_claim_revision_plan_ready | yes | novelty-claim-revision-plan-v1; revisions=4; high_risk=1; linked_claims=3 |  |
| novelty_link_audit_ready | yes | novelty-link-audit-v1; checked=4; quarantined=4; title_mismatches=1 |  |
| novelty_replacement_candidates_ready | yes | novelty-replacement-candidates-v1; candidates=7; verified=5; covered_quarantined=4 |  |
| novelty_overlap_adjudication_ready | yes | novelty-overlap-adjudication-v1; candidates=7; high_overlap=3; pending=7 |  |
| novelty_refresh_ledger_ready | yes | novelty-refresh-ledger-v1; sources=11; high_overlap_categories=9; final_allowed=false |  |
| final_novelty_adjudication_ready | yes | final-novelty-adjudication-v1; rows=18; high_overlap=9; final_allowed=false |  |
| corpus_audit_ready | yes | 6 source datasets; 270 scaled public items; 891 scaled evidence units; pointer_only=108 |  |
| source_diversity_plan_ready | yes | 15/300 target source rows; deficit=246 |  |
| source_acquisition_manifest_ready | yes | 17 batches; target_rows=246; known_license_rows=174 |  |
| source_acquisition_packets_ready | yes | 17 packets; target_rows=246 |  |
| source_acquisition_audit_ready | yes | 246/246 packet rows audited; findings=0 |  |
| source_acquisition_fetch_report_ready | yes | 246/246 rows fetched; findings=0; full_ready=true |  |
| source_acquisition_fetch_full_ready | yes | 246/246 distinct fetched source rows; known_license=174; pointer_only=72 |  |
| source_acquisition_candidates_ready | yes | 246 candidates; categories=10; required_review_rows=492 |  |
| source_acquisition_review_workbooks_ready | yes | 20 workbooks; 492 review rows; pointer_only_rows=144 |  |
| source_acquisition_review_preflight_report_ready | yes | 0/492 review rows complete; preflight_ready=false |  |
| source_lineage_ledger_ready | yes | source-lineage-ledger-v1; rows=276; datasets=6/6; source_rows=261 |  |
| construct_map_ready | yes | 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5 |  |
| difficulty_mechanism_ledger_ready | yes | difficulty-mechanism-ledger-v1; mechanisms=20; failure_cases=116; reviewed_deficit=300; blocked_claim_categories=10 |  |
| artifact_checklist_ready | yes | 66/66 artifact classes ready; reproduction_commands=61; release_blockers=1 |  |
| version_manifest_ready | yes | version-manifest-v1; artifacts=101; blockers=1; bytes=3227226 |  |
| threats_validity_ready | yes | 8 threats tracked; high_severity=3; completion_claim_allowed=false |  |

## Current Blockers

No release blockers are present.
