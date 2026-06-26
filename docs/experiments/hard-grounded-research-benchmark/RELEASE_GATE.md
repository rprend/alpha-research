# Hard Grounded Research Release Gate

This generated gate is intentionally conservative. It prevents the pilot benchmark from being treated as paper-ready or public-release-ready until review, licensing, model baselines, and novelty evidence are complete.

## Summary

- Status: blocked
- Pilot items: 30
- Scored systems in baseline analysis: 5
- Blockers: 7

## Checks

| Check | Passed | Detail | Blocker if failed |
| --- | --- | --- | --- |
| gold_review_complete | no | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| annotation_protocol_present | yes | 60 pilot review rows; 540 expansion review rows |  |
| review_preflight_ready | no | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| review_operations_ready | yes | 60 pilot incomplete rows; 540 expansion incomplete rows |  |
| review_triage_present | yes | 23 urgent/high pilot items ranked from 2 model baselines |  |
| annotation_assignment_plan_present | yes | 12 pilot assignments; 10 expansion assignments; first-wave expansion rows=100 |  |
| reviewer_handoff_ready | yes | 124 handoff rows across 30 files; gates=6/6 |  |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |  |
| review_execution_plan_ready | yes | review-execution-plan-v1; rows_remaining=600; reviewer_hours=74.4; blocking_review_checks=6 |  |
| review_packet_audit_ready | yes | review-packet-audit-v1; files=30; rows=124; findings=0 |  |
| review_return_contract_ready | yes | review-return-contract-v1; files=30; rows=124; findings=0 |  |
| review_return_preflight_ready | yes | review-return-preflight-v1; present=0/30; missing=30; latest_import_ready=true |  |
| review_return_checklist_ready | yes | review-return-checklist-v1; packets=30; rows=124; missing=30 |  |
| review_collection_tracker_ready | yes | review-collection-tracker-v1; packets=30; missing=30; returned=0 |  |
| adjudication_readiness_ready | yes | pilot_queue=0; expansion_queue=0; gold_ready=false; promotion_allowed=false |  |
| annotator_agreement_ready | yes | completed_metric_pairs=0; agreement_claim_allowed=false |  |
| annotation_export_ready | yes | 124 exported rows across 30 files; pilot=24; expansion=100 |  |
| annotation_return_readiness_ready | yes | 30 expected returned files; 124 expected returned rows |  |
| annotation_import_smoke_ready | yes | 124 returned fixture rows checked across 30 files; findings=0 |  |
| annotation_import_path_ready | yes | 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false |  |
| review_calibration_ready | yes | 10 calibration sentinels; minimum_accuracy=0.9; gold_promotion_allowed=false |  |
| annotation_quality_control_ready | yes | 1092 review rows governed; calibration_sentinels=10; completion_claim_allowed=false |  |
| gold_promotion_smoke_ready | yes | 30/30 fixture gold items; release_eligible=false |  |
| expansion_promotion_smoke_ready | yes | 270/270 fixture expansion items merge-ready; release_eligible=false |  |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | no | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
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
| error_codebook_ready | yes | error-codebook-v1; codes=8; categories=10; observed_cases=116 |  |
| paper_tables_ready | yes | 6 paper tables; systems=5; blockers=7 |  |
| analysis_plan_ready | yes | 4 hypotheses; 4 model families; reviewed=0/300 |  |
| paper_claim_ledger_ready | yes | 8 claims; allowed=3; diagnostic=2; prohibited=3 |  |
| supplement_index_ready | yes | supplement-index-v2; sections=6; tables=6; claims=8 |  |
| reproduction_capsule_ready | yes | reproduction-capsule-v1; commands=44; hashes=47; blockers=7 |  |
| citation_metadata_ready | yes | citation-metadata-v1; artifact_hashes=47; caveats=5; release_blockers=7 |  |
| reviewer_faq_ready | yes | reviewer-faq-v1; questions=6; blockers=7; prohibited_claims=3 |  |
| responsible_use_ready | yes | 6 policy rules; active_restrictions=2; public_leaderboard_allowed=false |  |
| data_statement_ready | yes | data-statement-v1; source_datasets=6; scaled_items=270; pointer_only_items=15 |  |
| model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |  |
| model_reporting_card_ready | yes | model-reporting-card-v1; systems=7; eligible=2; leaderboard_allowed=false |  |
| submission_contract_ready | yes | submission-contract-v1; pilot_tasks=30; leaderboard_allowed=false |  |
| scoring_contract_ready | yes | scoring-contract-v1; metrics=8; required=6/6; leaderboard_allowed=false |  |
| novelty_audit_final | no | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
| novelty_refresh_ledger_ready | yes | 4 refresh queries; 10 related sources; completion_claim_allowed=false |  |
| novelty_evidence_registry_present | yes | 22 related-work sources registered; completion_claim_allowed=false |  |
| novelty_claim_boundaries_ready | yes | 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims |  |
| novelty_watchlist_ready | yes | novelty-watchlist-v1; sources=4; high_risk=1; completion_claim_allowed=false |  |
| novelty_resolution_matrix_ready | yes | novelty-resolution-matrix-v1; sources=4; unresolved=4; high_risk=1 |  |
| novelty_finalization_preflight_ready | yes | novelty-finalization-preflight-v1; unresolved=4; high_risk_unresolved=1; final_allowed=false |  |
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
| construct_map_ready | yes | 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5 |  |
| artifact_checklist_ready | yes | 39/39 artifact classes ready; reproduction_commands=44; release_blockers=7 |  |
| version_manifest_ready | yes | version-manifest-v1; artifacts=47; blockers=7; bytes=608717 |  |
| threats_validity_ready | yes | 8 threats tracked; high_severity=3; completion_claim_allowed=false |  |

## Current Blockers

- gold_review_complete: Complete double review, resolve disagreements, and promote reviewed gold. (0/30 valid reviewed items)
- review_preflight_ready: Complete all reviewer workbook fields until strict review preflight succeeds. (0/60 complete review rows)
- expansion_review_preflight_ready: Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. (0/540 complete expansion review rows)
- expansion_review_merge_ready: Resolve expansion reviewer disagreement before using scaled candidates for paper claims. (0/270 expansion merge-ready items)
- review_merge_ready: Fill reviewer workbooks until strict review merge succeeds. (0/30 merge-ready items)
- category_scale_ready: Scale each category to the target reviewed item count before paper release. (0/300 valid reviewed target items; 300 reviewed items still needed)
- novelty_audit_final: Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. (checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5)
