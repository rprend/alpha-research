# Hard Grounded Research Reproduction Capsule

This generated capsule is the reviewer start-here artifact for reproducing the current benchmark package state. It records the expected commands, hashes, package counts, and known blockers without implying that paper-release gates are complete.

## Summary

- Capsule ready: true
- Version: reproduction-capsule-v1
- Benchmark id: `hard-grounded-research-benchmark`
- Release status: blocked
- Release checks: 78/85
- Artifact hashes: 63
- Reproduction commands: 52
- Validation commands: 3
- Completion claim allowed: false

## Package Contents

- Public package items: 30
- Public pointer-only evidence units: 18
- Scaled public items: 270
- Scaled pointer-only evidence units: 108
- Source datasets: 6

## Reproduction Commands

| # | Step | Command |
| --- | --- | --- |
| 1 | Generate benchmark seeds and pilot suite | node scripts/hard-grounded-research-benchmark.mjs |
| 2 | Run scorer smoke report | node scripts/hard-grounded-research-evaluate.mjs |
| 3 | Run local non-oracle baselines | node scripts/hard-grounded-research-runner.mjs && node scripts/hard-grounded-research-lexical-baseline.mjs && node scripts/hard-grounded-research-citation-verifier.mjs |
| 4 | Refresh submission contract | node scripts/hard-grounded-research-submission-contract.mjs |
| 5 | Refresh scoring contract | node scripts/hard-grounded-research-scoring-contract.mjs |
| 6 | Refresh error codebook | node scripts/hard-grounded-research-error-codebook.mjs |
| 7 | Refresh aggregate baseline analysis | node scripts/hard-grounded-research-report.mjs |
| 8 | Refresh corpus, construct, and power artifacts | node scripts/hard-grounded-research-corpus-audit.mjs && node scripts/hard-grounded-research-construct-map.mjs && node scripts/hard-grounded-research-power-plan.mjs |
| 9 | Refresh novelty watchlist | node scripts/hard-grounded-research-novelty-watchlist.mjs |
| 10 | Refresh novelty resolution matrix | node scripts/hard-grounded-research-novelty-resolution-matrix.mjs |
| 11 | Refresh novelty finalization preflight | node scripts/hard-grounded-research-novelty-finalization-preflight.mjs |
| 12 | Refresh novelty source review packets | node scripts/hard-grounded-research-novelty-source-review-packets.mjs |
| 13 | Refresh novelty claim revision plan | node scripts/hard-grounded-research-novelty-claim-revision-plan.mjs |
| 14 | Refresh novelty link audit | node scripts/hard-grounded-research-novelty-link-audit.mjs |
| 15 | Refresh novelty replacement candidates | node scripts/hard-grounded-research-novelty-replacement-candidates.mjs |
| 16 | Refresh novelty overlap adjudication | node scripts/hard-grounded-research-novelty-overlap-adjudication.mjs |
| 17 | Refresh public package integrity | node scripts/hard-grounded-research-public-package-integrity.mjs |
| 18 | Refresh public package schema | node scripts/hard-grounded-research-public-package-schema.mjs |
| 19 | Refresh source diversity plan | node scripts/hard-grounded-research-source-diversity-plan.mjs |
| 20 | Refresh source acquisition manifest | node scripts/hard-grounded-research-source-acquisition-manifest.mjs |
| 21 | Refresh source acquisition packets | node scripts/hard-grounded-research-source-acquisition-packets.mjs |
| 22 | Refresh source acquisition audit | node scripts/hard-grounded-research-source-acquisition-audit.mjs |
| 23 | Fetch source acquisition row metadata | node scripts/hard-grounded-research-source-acquisition-fetch.mjs |
| 24 | Materialize source acquisition candidates | node scripts/hard-grounded-research-source-acquisition-candidates.mjs |
| 25 | Generate source acquisition review workbooks | node scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs |
| 26 | Refresh source acquisition review preflight | node scripts/hard-grounded-research-source-acquisition-review-preflight.mjs |
| 27 | Refresh reviewer calibration sentinels | node scripts/hard-grounded-research-review-calibration.mjs |
| 28 | Refresh annotation quality-control policy | node scripts/hard-grounded-research-annotation-quality-control.mjs |
| 29 | Refresh review execution plan | node scripts/hard-grounded-research-review-execution-plan.mjs |
| 30 | Refresh review packet audit | node scripts/hard-grounded-research-review-packet-audit.mjs |
| 31 | Refresh review return contract | node scripts/hard-grounded-research-review-return-contract.mjs |
| 32 | Refresh review return preflight | node scripts/hard-grounded-research-review-return-preflight.mjs |
| 33 | Refresh review return checklist | node scripts/hard-grounded-research-review-return-checklist.mjs |
| 34 | Refresh review collection tracker | node scripts/hard-grounded-research-review-collection-tracker.mjs |
| 35 | Refresh review wave schedule | node scripts/hard-grounded-research-review-wave-schedule.mjs |
| 36 | Refresh gold adjudication plan | node scripts/hard-grounded-research-gold-adjudication-plan.mjs |
| 37 | Refresh scale adjudication plan | node scripts/hard-grounded-research-scale-adjudication-plan.mjs |
| 38 | Refresh paper tables and figure data | node scripts/hard-grounded-research-paper-tables.mjs |
| 39 | Refresh statistical analysis plan | node scripts/hard-grounded-research-analysis-plan.mjs |
| 40 | Refresh model reporting card | node scripts/hard-grounded-research-model-reporting-card.mjs |
| 41 | Refresh paper claim ledger | node scripts/hard-grounded-research-paper-claim-ledger.mjs |
| 42 | Refresh supplement index | node scripts/hard-grounded-research-supplement-index.mjs |
| 43 | Refresh reproduction capsule | node scripts/hard-grounded-research-reproduction-capsule.mjs |
| 44 | Refresh citation metadata | node scripts/hard-grounded-research-citation-metadata.mjs |
| 45 | Refresh reviewer FAQ | node scripts/hard-grounded-research-reviewer-faq.mjs |
| 46 | Refresh responsible-use policy | node scripts/hard-grounded-research-responsible-use.mjs |
| 47 | Refresh data statement | node scripts/hard-grounded-research-data-statement.mjs |
| 48 | Refresh version manifest | node scripts/hard-grounded-research-version-manifest.mjs |
| 49 | Refresh release and publication surfaces | node scripts/hard-grounded-research-release-gate.mjs && node scripts/hard-grounded-research-dataset-card.mjs && node scripts/hard-grounded-research-paper-draft.mjs |
| 50 | Validate harness integration | node scripts/validate-harness.mjs |
| 51 | Run app build and dashboard QA | node_modules/.bin/vite build && node scripts/qa-dashboard.mjs |
| 52 | Run full repository gates | pnpm build && pnpm test<br>Currently blocked in this workspace by pnpm ignored-build approvals for esbuild, sharp, and workerd. |

## Expected Blockers

| Check | Detail | Required action |
| --- | --- | --- |
| gold_review_complete | 0/30 valid reviewed items | Complete double review, resolve disagreements, and promote reviewed gold. |
| review_preflight_ready | 0/60 complete review rows | Complete all reviewer workbook fields until strict review preflight succeeds. |
| expansion_review_preflight_ready | 0/540 complete expansion review rows | Complete all expansion reviewer workbook fields before using scaled candidates for paper claims. |
| expansion_review_merge_ready | 0/270 expansion merge-ready items | Resolve expansion reviewer disagreement before using scaled candidates for paper claims. |
| review_merge_ready | 0/30 merge-ready items | Fill reviewer workbooks until strict review merge succeeds. |
| category_scale_ready | 0/300 valid reviewed target items; 300 reviewed items still needed | Scale each category to the target reviewed item count before paper release. |
| novelty_audit_final | checked=2026-06-26 status=refreshed_preliminary completion_claim_allowed=false high_risk_categories=5 | Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion. |
