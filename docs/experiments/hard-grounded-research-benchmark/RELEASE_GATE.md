# Hard Grounded Research Release Gate

This generated gate is intentionally conservative. It prevents the pilot benchmark from being treated as paper-ready or public-release-ready until review, licensing, model baselines, and novelty evidence are complete.

## Summary

- Status: blocked
- Pilot items: 30
- Scored systems in baseline analysis: 3
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
| reviewer_handoff_ready | yes | 124 handoff rows across 30 files; gates=5/5 |  |
| review_progress_ready | yes | 0/60 pilot rows and 0/540 expansion rows complete; target_remaining=300 |  |
| annotation_export_ready | yes | 124 exported rows across 30 files; pilot=24; expansion=100 |  |
| annotation_import_smoke_ready | yes | 124 returned fixture rows checked across 30 files; findings=0 |  |
| annotation_import_path_ready | yes | 124/124 importable returned rows; files=30/30; fixture_allowed=true; applied=false |  |
| gold_promotion_smoke_ready | yes | 30/30 fixture gold items; release_eligible=false |  |
| expansion_promotion_smoke_ready | yes | 270/270 fixture expansion items merge-ready; release_eligible=false |  |
| expansion_review_preflight_ready | no | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | no | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | no | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| unknown_license_resolved | yes | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true |  |
| license_impact_clear | yes | 135/270 expansion candidates depend on unknown-license sources; 54 replaced; 81 pointer-only; packaged clearance=true |  |
| license_remediation_plan_present | yes | 54 replacement-path candidates; 81 pointer-only candidates |  |
| license_remediated_expansion_candidates_present | yes | 54/54 replacement-path candidates materialized |  |
| public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |  |
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |  |
| scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |  |
| repair_queue_clear | yes | 0 repair-before-gold items |  |
| frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |  |
| baseline_uncertainty_present | yes | 3 systems with descriptive task-level intervals |  |
| model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |  |
| novelty_audit_final | no | checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
| novelty_evidence_registry_present | yes | 18 related-work sources registered; completion_claim_allowed=false |  |

## Current Blockers

- gold_review_complete: Complete double review, resolve disagreements, and promote reviewed gold. (0/30 valid reviewed items)
- review_preflight_ready: Complete all reviewer workbook fields until strict review preflight succeeds. (0/60 complete review rows)
- expansion_review_preflight_ready: Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. (0/540 complete expansion review rows)
- expansion_review_merge_ready: Resolve expansion reviewer disagreement before using scaled candidates for paper claims. (0/270 expansion merge-ready items)
- review_merge_ready: Fill reviewer workbooks until strict review merge succeeds. (0/30 merge-ready items)
- category_scale_ready: Scale each category to the target reviewed item count before paper release. (0/300 valid reviewed target items; 300 reviewed items still needed)
- novelty_audit_final: Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. (checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5)
