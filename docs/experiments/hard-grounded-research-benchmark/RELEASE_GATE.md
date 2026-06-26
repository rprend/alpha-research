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
| review_preflight_ready | no | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| review_merge_ready | no | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | no | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| unknown_license_resolved | no | tdiggelm/climate_fever, Pavithree/eli5 | Resolve, replace, or pointer-only package unknown-license sources before public redistribution. |
| public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |  |
| sanitized_public_suite_present | yes | 30 sanitized items; 18 pointer-only evidence units |  |
| repair_queue_clear | yes | 0 repair-before-gold items |  |
| frontier_or_open_model_results_present | no | no scored model reports present | Run and score at least two frontier or open model baselines over the release scoring source. |
| novelty_audit_final | no | checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |

## Current Blockers

- gold_review_complete: Complete double review, resolve disagreements, and promote reviewed gold. (0/30 valid reviewed items)
- review_preflight_ready: Complete all reviewer workbook fields until strict review preflight succeeds. (0/60 complete review rows)
- review_merge_ready: Fill reviewer workbooks until strict review merge succeeds. (0/30 merge-ready items)
- category_scale_ready: Scale each category to the target reviewed item count before paper release. (0/300 valid reviewed target items; 300 reviewed items still needed)
- unknown_license_resolved: Resolve, replace, or pointer-only package unknown-license sources before public redistribution. (tdiggelm/climate_fever, Pavithree/eli5)
- frontier_or_open_model_results_present: Run and score at least two frontier or open model baselines over the release scoring source. (no scored model reports present)
- novelty_audit_final: Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. (checked=2026-06-26 status=preliminary completion_claim_allowed=false high_risk_categories=5)
