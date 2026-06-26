# Hard Grounded Research Artifact Checklist

This generated checklist makes the benchmark package auditable as a research artifact. It records what can be regenerated, what is already packaged, and which paper-readiness claims remain blocked.

## Summary

- Checklist ready: true
- Benchmark id: `hard-grounded-research-benchmark`
- Categories: 10
- Pilot items: 30
- Scaled public items: 270
- Artifact classes ready: 41/41
- Reproduction commands: 46
- Release blockers: 7
- Paper readiness status: blocked
- Completion claim allowed: false

## Artifact Classes

| Class | Status | Evidence |
| --- | --- | --- |
| taxonomy_and_constructs | ready | 10/10 constructs mapped to rubrics, metrics, examples, novelty risk, and review status. |
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
| review_calibration | ready | 10 reviewer-screening sentinels across 10 categories; minimum_accuracy=0.9. |
| annotation_quality_control | ready | 1092 review rows governed by 5 QA rules; sentinel rows in gold=false. |
| annotation_and_review_workflow | ready | 124 exported review rows; 300 reviewed target items remaining. |
| review_execution_plan | ready | review-execution-plan-v1; rows remaining=600; reviewer hours=74.4; blocking checks=6. |
| review_packet_audit | ready | review-packet-audit-v1; files=30; rows=124; findings=0. |
| review_return_contract | ready | review-return-contract-v1; files=30; rows=124; findings=0. |
| review_return_preflight | ready | review-return-preflight-v1; present=0/30; missing=30; latest import ready=true. |
| review_return_checklist | ready | review-return-checklist-v1; packets=30; rows=124; missing=30. |
| review_collection_tracker | ready | review-collection-tracker-v1; packets=30; missing=30; returned=0. |
| gold_adjudication_plan | ready | gold-adjudication-plan-v1; items=30; missing reviews=60; promotion-ready=0. |
| scale_adjudication_plan | ready | scale-adjudication-plan-v1; batches=30; missing review rows=540; merge-ready=0. |
| submission_contract | ready | submission-contract-v1; pilot tasks=30; required fields=5. |
| scoring_contract | ready | scoring-contract-v1; metrics=8; required metrics=6/6. |
| error_codebook | ready | error-codebook-v1; codes=8; observed pilot failures=116. |
| baselines_and_scoring | ready | 5 scored systems; 2 eligible external model baselines. |
| model_reporting_card | ready | model-reporting-card-v1; systems=7; eligible=2; required fields=11. |
| statistics_and_scale | ready | 30 target reviewed items/category; 300 reviewed items remaining. |
| paper_tables_and_figures | ready | 6 paper tables; 40 challenge rows; 8 failure modes. |
| analysis_plan | ready | 4 hypotheses; 4 model families; 7 covariates. |
| paper_claim_ledger | ready | 8 claims mapped to evidence; prohibited=3; diagnostic=2. |
| supplement_index | ready | supplement-index-v2; sections=6; tables=6; claims=8. |
| reproduction_capsule | ready | reproduction-capsule-v1; commands=46; validations=3; hashes=51. |
| citation_metadata | ready | citation-metadata-v1; caveats=5; artifact hashes=51; blockers=7. |
| reviewer_faq | ready | reviewer-faq-v1; questions=6; prohibited claims=3. |
| responsible_use | ready | 6 policy rules; active restrictions=2; public leaderboard allowed=false. |
| data_statement | ready | data-statement-v1; source datasets=6; scaled items=270; pointer-only items=15. |
| version_manifest | ready | version-manifest-v1; artifacts=51; bytes=687039. |
| novelty_finalization_preflight | ready | novelty-finalization-preflight-v1; unresolved=4; high-risk unresolved=1; final allowed=false. |
| novelty_and_claim_boundaries | ready | 22 related-work sources; 4 watchlist sources; 4 unresolved watchlist sources; 5 prohibited claims; refresh queries=4. |

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
| Refresh novelty watchlist | `node scripts/hard-grounded-research-novelty-watchlist.mjs` |
| Refresh novelty resolution matrix | `node scripts/hard-grounded-research-novelty-resolution-matrix.mjs` |
| Refresh novelty finalization preflight | `node scripts/hard-grounded-research-novelty-finalization-preflight.mjs` |
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
| Refresh review collection tracker | `node scripts/hard-grounded-research-review-collection-tracker.mjs` |
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

| Check | Detail | Required action |
| --- | --- | --- |
| gold_review_complete | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_preflight_ready | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| expansion_review_preflight_ready | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
