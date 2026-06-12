# Full Workflow

Generated: 2026-06-12T21:51:57.768Z

Complete: true

## Steps

- preview_acquisition_import: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs --preview`)
- import_acquisition_results: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs`)
- run_pipeline: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/run-pipeline.mjs`)
- apply_review_decisions: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs`)
- analyze_source_yield: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/analyze-source-yield.mjs`)
- build_adjacency_expansion: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-adjacency-expansion.mjs`)
- resolve_identities: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/resolve-identities.mjs`)
- build_category_coverage: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-category-coverage.mjs`)
- build_review_sample: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-sample.mjs`)
- build_review_packet: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-packet.mjs`)
- build_review_plan: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-review-plan.mjs`)
- build_acquisition_batches: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-acquisition-batches.mjs`)
- build_candidate_frontier: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-candidate-frontier.mjs`)
- build_release_package: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-release-package.mjs`)
- verify_release_package: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/verify-release-package.mjs`)
- build_scale_plan: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-plan.mjs`)
- build_scale_waves: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-scale-waves.mjs`)
- build_wave_ledger: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-wave-ledger.mjs`)
- build_provider_preflight: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-provider-preflight.mjs`)
- build_live_run_manifest: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-live-run-manifest.mjs`)
- run_live_manifest_dry_run: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/run-live-manifest.mjs --max-waves=1 --max-cost-usd=1 --skip-import --skip-rebuild`)
- build_refresh_plan: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-refresh-plan.mjs`)
- build_publication_handoff: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/build-publication-handoff.mjs`)
- check_readiness: pass (`node docs/experiments/tiktok-creative-creator-graph/scripts/check-readiness.mjs`)
