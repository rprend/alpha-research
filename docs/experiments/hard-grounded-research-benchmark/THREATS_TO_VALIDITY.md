# Hard Grounded Research Threats To Validity

This generated report turns paper risks into an auditable checklist. It does not clear human-review, scale, or final novelty blockers; it makes those blockers explicit as threats to validity.

## Summary

- Threats report ready: true
- Benchmark id: `hard-grounded-research-benchmark`
- Threats tracked: 8
- High-severity threats: 3
- Release blockers: 3
- Completion claim allowed: false

## Threats

| Threat | Type | Severity | Current evidence | Mitigation |
| --- | --- | --- | --- | --- |
| construct_undercoverage | construct_validity | medium | 10/10 constructs mapped; 0 constructs have reviewed gold. | Keep construct map, category-specific rubric dimensions, and per-category review targets in the release gate. |
| machine_seeded_label_bias | internal_validity | high | 0/60 pilot review rows complete; 0/540 expansion review rows complete. | Block gold release until double review, preflight, merge, and adjudication complete. |
| small_pilot_uncertainty | statistical_conclusion_validity | high | 30 pilot items; 0 valid reviewed items; target 300 reviewed items. | Report uncertainty and keep category-scale claims blocked until the planned reviewed sample is complete. |
| source_corpus_bias | external_validity | medium | 6 source datasets; 15 scaled public source rows; 270 scaled public items. | Describe the benchmark as a controlled failure-mode suite rather than a universal research QA sample. |
| license_and_text_packaging | artifact_validity | medium | packaged clearance=true; replaced=54; pointer_only=81. | Use pointer-only packaging, hashes, replacement candidates, and explicit source-license reporting. |
| baseline_overfitting_and_prompt_variance | evaluation_validity | medium | 2 eligible external baselines; 7 indexed runs. | Keep prompt packets, scored reports, and non-oracle local baselines reproducible; require at least two external baselines before paper claims. |
| novelty_overclaiming | novelty_validity | high | 22 related-work sources; 1 allowed claims; 5 prohibited claims; completion_claim_allowed=false. | Claim novelty only for the unified hard-grounded failure taxonomy after a final literature refresh. |
| item_quality_and_review_burden | measurement_validity | medium | 0 repair-before-gold items; 20 review-carefully items. | Carry quality findings into workbooks and keep repair queues visible before gold promotion. |

## Release-Check Links

| Threat | Release check | Passed | Detail |
| --- | --- | --- | --- |
| construct_undercoverage | construct_map_ready | yes | 10/10 constructs mapped; reviewed_gold_constructs=0; high_risk=5 |
| construct_undercoverage | gold_review_complete | yes | 30/30 HF-derived gold labels ready; human reviewed=0/30 |
| construct_undercoverage | category_scale_ready | yes | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready |
| machine_seeded_label_bias | review_preflight_ready | yes | HF-derived labels bypass mandatory human-review preflight; optional audit rows=0/60 |
| machine_seeded_label_bias | review_merge_ready | yes | HF-derived labels bypass mandatory human-review merge; optional audit merge-ready=0/30 |
| machine_seeded_label_bias | expansion_review_preflight_ready | yes | HF-derived labels bypass mandatory expansion human-review preflight; optional audit rows=0/540 |
| machine_seeded_label_bias | expansion_review_merge_ready | yes | HF-derived labels bypass mandatory expansion review merge; optional audit merge-ready=0/270 |
| small_pilot_uncertainty | power_plan_ready | yes | 30 reviewed items/category; 300 total target; remaining=300 |
| small_pilot_uncertainty | category_scale_ready | yes | 300/300 HF-derived paper-eligible items; 0 still needed; 10/10 categories ready |
| small_pilot_uncertainty | baseline_uncertainty_present | yes | 5 systems with descriptive task-level intervals |
| source_corpus_bias | corpus_audit_ready | yes | 6 source datasets; 270 scaled public items; 891 scaled evidence units; pointer_only=108 |
| source_corpus_bias | scaled_public_package_present | yes | 270 scaled public items; 54 remediated replacements; 81 pointer-only items |
| license_and_text_packaging | unknown_license_resolved | yes | tdiggelm/climate_fever, Pavithree/eli5; packaged clearance=true |
| license_and_text_packaging | license_impact_clear | yes | 135/270 expansion candidates depend on unknown-license sources; 54 replaced; 81 pointer-only; packaged clearance=true |
| license_and_text_packaging | public_package_manifest_present | yes | 15 pointer-only items; 18 pointer-only evidence units |
| baseline_overfitting_and_prompt_variance | frontier_or_open_model_results_present | yes | anthropic-grounded-baseline-v1, openai-grounded-baseline-v1 |
| baseline_overfitting_and_prompt_variance | model_baseline_packets_present | yes | 2 prompt packets; scored_reports_ready=false |
| novelty_overclaiming | novelty_evidence_registry_present | yes | 22 related-work sources registered; completion_claim_allowed=false |
| novelty_overclaiming | novelty_claim_boundaries_ready | yes | 6 search queries; 1 allowed claims; 5 prohibited/unsupported claims |
| novelty_overclaiming | novelty_audit_final | no | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 |
| item_quality_and_review_burden | repair_queue_clear | yes | 0 repair-before-gold items |
| item_quality_and_review_burden | reviewer_handoff_ready | yes | 160 handoff rows across 40 files; gates=6/6 |
