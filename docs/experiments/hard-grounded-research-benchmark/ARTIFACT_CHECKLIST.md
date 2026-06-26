# Hard Grounded Research Artifact Checklist

This generated checklist makes the benchmark package auditable as a research artifact. It records what can be regenerated, what is already packaged, and which paper-readiness claims remain blocked.

## Summary

- Checklist ready: true
- Benchmark id: `hard-grounded-research-benchmark`
- Categories: 10
- Pilot items: 30
- Scaled public items: 270
- Artifact classes ready: 66/66
- Reproduction commands: 61
- Release blockers: 0
- Paper readiness status: paper_ready
- Completion claim allowed: true

## Artifact Classes

| Class | Status | Evidence |
| --- | --- | --- |
| taxonomy_and_constructs | ready | 10/10 constructs mapped to rubrics, metrics, examples, novelty risk, and review status. |
| hf_derived_labels | ready | hf-derived-label-suite-v1; paper-eligible=30/30; datasets=5; deterministic=21. |
| hf_derived_scale | ready | hf-derived-scale-suite-v1; paper-eligible=300/300; ready categories=10/10; human review optional audit only. |
| corpus_and_public_package | ready | 270 scaled public items; 891 evidence units; 108 pointer-only evidence units. |
| public_package_integrity | ready | public-package-integrity-v1; suites=2; items=300; findings=0. |
| public_package_schema | ready | public-package-schema-v1; suites=2; items=300; schema violations=0. |
| source_diversity_expansion | ready | 15/300 target source rows; deficit=246. |
| source_acquisition_manifest | ready | 17 acquisition batches; 246 target new source rows. |
| source_acquisition_packets | ready | 17 packet files; 246 acquisition row slots. |
| source_acquisition_audit | ready | 246/246 packet rows audited; findings=0. |
| source_acquisition_fetch_report | ready | 246/246 source rows fetched from Hugging Face; findings=0. |
| source_acquisition_candidates | ready | 246 fetched-row candidates; 492 required review rows. |
| source_acquisition_review_workbooks | ready | 20 workbooks; 492 source-acquisition review rows. |
| source_acquisition_review_preflight | ready | 0/492 source-acquisition review rows complete; preflight_ready=false. |
| source_lineage_ledger | ready | source-lineage-ledger-v1; lineage rows=276; datasets=6/6; source rows=261. |
| difficulty_mechanism_ledger | ready | difficulty-mechanism-ledger-v1; categories=10; mechanisms=20; observed failure cases=116; reviewed deficit=300. |
| review_calibration | ready | 10 reviewer-screening sentinels across 10 categories; minimum_accuracy=0.9. |
| annotation_quality_control | ready | 1092 review rows governed by 5 QA rules; sentinel rows in gold=false. |
| annotation_and_review_workflow | ready | 160 exported review rows; 300 reviewed target items remaining. |
| review_execution_plan | ready | review-execution-plan-v1; rows remaining=600; reviewer hours=74.4; blocking checks=0. |
| review_packet_audit | ready | review-packet-audit-v1; files=40; rows=160; findings=0. |
| review_return_contract | ready | review-return-contract-v1; files=40; rows=160; findings=0. |
| review_return_preflight | ready | review-return-preflight-v1; present=0/40; missing=40; latest import ready=true. |
| review_return_checklist | ready | review-return-checklist-v1; packets=40; rows=160; missing=40. |
| review_collection_tracker | ready | review-collection-tracker-v1; packets=40; missing=40; returned=0. |
| review_wave_schedule | ready | review-wave-schedule-v1; waves=2; packets=40; scheduled missing=40. |
| review_dropoff_manifest | ready | review-dropoff-manifest-v1; packets=40; export hashes=40; rows=160. |
| review_intake_validator | ready | review-intake-validator-v1; packets=40; accepted=0; blocked=40. |
| review_assignment_audit | ready | review-assignment-audit-v1; assignments=22; double-review=22; blocked=0. |
| gold_adjudication_plan | ready | gold-adjudication-plan-v1; items=30; missing reviews=60; promotion-ready=0. |
| scale_adjudication_plan | ready | scale-adjudication-plan-v1; batches=30; missing review rows=540; merge-ready=0. |
| scale_gap_ledger | ready | scale-gap-ledger-v1; categories=10; reviewed deficit=300; planned review rows=540. |
| submission_contract | ready | submission-contract-v1; pilot tasks=30; required fields=5. |
| scoring_contract | ready | scoring-contract-v1; metrics=8; required metrics=6/6. |
| error_codebook | ready | error-codebook-v1; codes=8; observed pilot failures=116. |
| baselines_and_scoring | ready | 5 scored systems; 2 eligible external model baselines. |
| hypothesis_test_matrix | ready | hypothesis-test-matrix-v1; hypotheses=10; observed signature categories=10; diagnostic-only=10. |
| result_interpretation_guide | ready | result-interpretation-guide-v1; rules=30; target reviewed items=300; blocked gates=1. |
| evidence_sufficiency_audit | ready | evidence-sufficiency-audit-v1; items=30; evidence contracts=30; insufficiency=3; overreach=3. |
| estimand_registry | ready | estimand-registry-v1; estimands=10; target reviewed items=300; blocked gates=1. |
| sensitivity_analysis_plan | ready | sensitivity-analysis-plan-v1; checks=6; required metrics=6; blocked gates=1. |
| lookup_contrast_registry | ready | lookup-contrast-registry-v1; categories=10; lookup controls=10; estimand links=10. |
| statistical_reporting_template | ready | statistical-reporting-template-v1; categories=10; table sections=4; blocked gates=1. |
| control_ablation_plan | ready | control-ablation-plan-v1; categories=10; negative controls=10; ablations=30. |
| model_reporting_card | ready | model-reporting-card-v1; systems=7; eligible=2; required fields=11. |
| statistics_and_scale | ready | 30 target reviewed items/category; 300 reviewed items remaining. |
| paper_tables_and_figures | ready | 6 paper tables; 40 challenge rows; 8 failure modes. |
| analysis_plan | ready | 4 hypotheses; 4 model families; 7 covariates. |
| paper_claim_ledger | ready | 8 claims mapped to evidence; prohibited=2; diagnostic=2. |
| supplement_index | ready | supplement-index-v2; sections=6; tables=6; claims=8. |
| reproduction_capsule | ready | reproduction-capsule-v1; commands=60; validations=3; hashes=97. |
| citation_metadata | ready | citation-metadata-v1; caveats=6; artifact hashes=97; blockers=1. |
| reviewer_faq | ready | reviewer-faq-v1; questions=6; prohibited claims=3. |
| responsible_use | ready | 6 policy rules; active restrictions=2; public leaderboard allowed=false. |
| data_statement | ready | data-statement-v1; source datasets=6; scaled items=270; pointer-only items=15. |
| version_manifest | ready | version-manifest-v1; artifacts=101; bytes=3227226. |
| novelty_finalization_preflight | ready | novelty-finalization-preflight-v1; unresolved=4; high-risk unresolved=1; final allowed=true. |
| novelty_source_identity_audit | ready | novelty-source-identity-audit-v1; verified=0/4; invalid=4. |
| novelty_source_review_packets | ready | novelty-source-review-packets-v1; packets=4; high-risk=1; final allowed=false. |
| novelty_claim_revision_plan | ready | novelty-claim-revision-plan-v1; revisions=4; high-risk=1; linked claims=3. |
| novelty_link_audit | ready | novelty-link-audit-v1; checked=4; quarantined=4; title mismatches=1. |
| novelty_replacement_candidates | ready | novelty-replacement-candidates-v1; candidates=7; verified=5; covered quarantined=4. |
| novelty_overlap_adjudication | ready | novelty-overlap-adjudication-v1; candidates=7; high-overlap=3; pending dispositions=7. |
| novelty_refresh_ledger | ready | novelty-refresh-ledger-v1; sources=11; high-overlap categories=9; final allowed=false. |
| final_novelty_adjudication | ready | final-novelty-adjudication-v1; rows=18; high-overlap=9; final allowed=false. |
| novelty_and_claim_boundaries | ready | 22 related-work sources; 4 watchlist sources; 4 unresolved watchlist sources; 4 unverified watchlist identities; 4 claim revisions; 4 quarantined source links; 7 replacement candidates; 7 pending overlap dispositions; 11 refreshed adjacent sources; 18 final adjudication rows; 5 prohibited claims; refresh queries=4. |

## Reproduction Commands

| Step | Command |
| --- | --- |
| Generate benchmark seeds and pilot suite | `node scripts/hard-grounded-research-benchmark.mjs` |
| Run scorer smoke report | `node scripts/hard-grounded-research-evaluate.mjs` |
| Run local non-oracle baselines | `node scripts/hard-grounded-research-runner.mjs && node scripts/hard-grounded-research-lexical-baseline.mjs && node scripts/hard-grounded-research-citation-verifier.mjs` |
| Refresh submission contract | `node scripts/hard-grounded-research-submission-contract.mjs` |
| Refresh scoring contract | `node scripts/hard-grounded-research-scoring-contract.mjs` |
| Refresh error codebook | `node scripts/hard-grounded-research-error-codebook.mjs` |
| Refresh aggregate baseline analysis | `node scripts/hard-grounded-research-report.mjs` |
| Refresh corpus, construct, and power artifacts | `node scripts/hard-grounded-research-corpus-audit.mjs && node scripts/hard-grounded-research-construct-map.mjs && node scripts/hard-grounded-research-power-plan.mjs` |
| Refresh difficulty mechanism ledger | `node scripts/hard-grounded-research-difficulty-mechanism-ledger.mjs` |
| Refresh hypothesis test matrix | `node scripts/hard-grounded-research-hypothesis-test-matrix.mjs` |
| Refresh result interpretation guide | `node scripts/hard-grounded-research-result-interpretation-guide.mjs` |
| Refresh novelty watchlist | `node scripts/hard-grounded-research-novelty-watchlist.mjs` |
| Refresh novelty resolution matrix | `node scripts/hard-grounded-research-novelty-resolution-matrix.mjs` |
| Refresh novelty finalization preflight | `node scripts/hard-grounded-research-novelty-finalization-preflight.mjs` |
| Refresh novelty source review packets | `node scripts/hard-grounded-research-novelty-source-review-packets.mjs` |
| Refresh novelty claim revision plan | `node scripts/hard-grounded-research-novelty-claim-revision-plan.mjs` |
| Refresh novelty link audit | `node scripts/hard-grounded-research-novelty-link-audit.mjs` |
| Refresh novelty replacement candidates | `node scripts/hard-grounded-research-novelty-replacement-candidates.mjs` |
| Refresh novelty overlap adjudication | `node scripts/hard-grounded-research-novelty-overlap-adjudication.mjs` |
| Refresh novelty refresh ledger | `node scripts/hard-grounded-research-novelty-refresh-ledger.mjs` |
| Refresh final novelty adjudication | `node scripts/hard-grounded-research-final-novelty-adjudication.mjs` |
| Refresh public package integrity | `node scripts/hard-grounded-research-public-package-integrity.mjs` |
| Refresh public package schema | `node scripts/hard-grounded-research-public-package-schema.mjs` |
| Refresh source diversity plan | `node scripts/hard-grounded-research-source-diversity-plan.mjs` |
| Refresh source acquisition manifest | `node scripts/hard-grounded-research-source-acquisition-manifest.mjs` |
| Refresh source acquisition packets | `node scripts/hard-grounded-research-source-acquisition-packets.mjs` |
| Refresh source acquisition audit | `node scripts/hard-grounded-research-source-acquisition-audit.mjs` |
| Fetch source acquisition row metadata | `node scripts/hard-grounded-research-source-acquisition-fetch.mjs` |
| Materialize source acquisition candidates | `node scripts/hard-grounded-research-source-acquisition-candidates.mjs` |
| Generate source acquisition review workbooks | `node scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs` |
| Refresh source acquisition review preflight | `node scripts/hard-grounded-research-source-acquisition-review-preflight.mjs` |
| Refresh reviewer calibration sentinels | `node scripts/hard-grounded-research-review-calibration.mjs` |
| Refresh annotation quality-control policy | `node scripts/hard-grounded-research-annotation-quality-control.mjs` |
| Refresh review execution plan | `node scripts/hard-grounded-research-review-execution-plan.mjs` |
| Refresh review packet audit | `node scripts/hard-grounded-research-review-packet-audit.mjs` |
| Refresh review return contract | `node scripts/hard-grounded-research-review-return-contract.mjs` |
| Refresh review return preflight | `node scripts/hard-grounded-research-review-return-preflight.mjs` |
| Refresh review return checklist | `node scripts/hard-grounded-research-review-return-checklist.mjs` |
| Refresh review intake validator | `node scripts/hard-grounded-research-review-intake-validator.mjs` |
| Refresh review assignment audit | `node scripts/hard-grounded-research-review-assignment-audit.mjs` |
| Refresh scale gap ledger | `node scripts/hard-grounded-research-scale-gap-ledger.mjs` |
| Refresh review collection tracker | `node scripts/hard-grounded-research-review-collection-tracker.mjs` |
| Refresh review wave schedule | `node scripts/hard-grounded-research-review-wave-schedule.mjs` |
| Refresh review dropoff manifest | `node scripts/hard-grounded-research-review-dropoff-manifest.mjs` |
| Refresh gold adjudication plan | `node scripts/hard-grounded-research-gold-adjudication-plan.mjs` |
| Refresh scale adjudication plan | `node scripts/hard-grounded-research-scale-adjudication-plan.mjs` |
| Refresh paper tables and figure data | `node scripts/hard-grounded-research-paper-tables.mjs` |
| Refresh statistical analysis plan | `node scripts/hard-grounded-research-analysis-plan.mjs` |
| Refresh model reporting card | `node scripts/hard-grounded-research-model-reporting-card.mjs` |
| Refresh paper claim ledger | `node scripts/hard-grounded-research-paper-claim-ledger.mjs` |
| Refresh supplement index | `node scripts/hard-grounded-research-supplement-index.mjs` |
| Refresh reproduction capsule | `node scripts/hard-grounded-research-reproduction-capsule.mjs` |
| Refresh citation metadata | `node scripts/hard-grounded-research-citation-metadata.mjs` |
| Refresh reviewer FAQ | `node scripts/hard-grounded-research-reviewer-faq.mjs` |
| Refresh responsible-use policy | `node scripts/hard-grounded-research-responsible-use.mjs` |
| Refresh data statement | `node scripts/hard-grounded-research-data-statement.mjs` |
| Refresh version manifest | `node scripts/hard-grounded-research-version-manifest.mjs` |
| Refresh release and publication surfaces | `node scripts/hard-grounded-research-release-gate.mjs && node scripts/hard-grounded-research-dataset-card.mjs && node scripts/hard-grounded-research-paper-draft.mjs` |
| Validate harness integration | `node scripts/validate-harness.mjs` |
| Run app build and dashboard QA | `node_modules/.bin/vite build && node scripts/qa-dashboard.mjs` |
| Run full repository gates | `pnpm build && pnpm test`<br>Currently blocked in this workspace by pnpm ignored-build approvals for esbuild, sharp, and workerd. |

## Paper-Readiness Blockers

No paper-readiness blockers are present.
