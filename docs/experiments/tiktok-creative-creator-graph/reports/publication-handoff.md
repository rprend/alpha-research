# TikTok Creative Creator Graph Publication Handoff

Generated: 2026-06-13T00:49:47.707Z
Publish state: not-ready-production-data
Readiness status: incomplete

## Objective

Build roughly 50,000 TikTok-visible creative creator accounts worth learning from, with graph expansion and release provenance.

## Current Corpus

- Accounts: 1900
- Identities: 1870
- Videos: 20
- Graph edges: 52
- Useful creators: 7
- Release useful creators: 2
- Excellent creators: 6
- Review sample: 250
- Review packet rows: 250
- Review decision template rows: 250
- Review packet batches: 1
- Review packet batch rows: 250
- Review plan categories: 11
- Review decisions: 4
- Review blank decisions: 0
- Source yield rows: 50
- Adjacency expansion rows: 27
- Adjacency expansion added rows: 20
- Category coverage: 5/11
- Acquisition tasks: 91
- Candidate frontier: 86
- Candidate frontier handles: 7
- Candidate frontier queries: 79
- Acquisition import preview accounts: 1894
- Acquisition import preview ready: true
- Acquisition import waves: 11
- Acquisition import traced rows: 7216
- Acquisition import untraced rows: 66
- Acquisition runner runnable tasks: 2
- Acquisition runner skipped tasks: 0
- Acquisition run history: 15
- Scale waves: 10000
- Wave ledger rows: 10000
- Wave ledger planned: 10000
- Wave ledger imported: 0
- Wave ledger imported empty: 0
- Wave ledger failed: 0
- Wave ledger imported output accounts: 0
- Wave ledger under-yield imports: 0
- Provider preflight tasks: 20
- Provider preflight ready tasks: 20
- Provider preflight blocked tasks: 0
- Provider preflight estimated cost: $5
- Live run manifest waves: 10
- Live run manifest runnable waves: 10
- Live run manifest estimated cost: $5
- Live manifest runner steps: 1
- Live manifest runner selected waves: 1
- Live manifest runner mode: dry_run
- Refresh tasks: 1900

## Remaining Production Gaps

- Useful creators: 49993
- Excellent creators: 4994
- Review decisions: 496

## Key Paths

- phase_plan: `docs/experiments/tiktok-creative-creator-graph/PHASE_PLAN.md`
- readme: `docs/experiments/tiktok-creative-creator-graph/README.md`
- readiness: `docs/experiments/tiktok-creative-creator-graph/reports/readiness.json`
- full_workflow: `docs/experiments/tiktok-creative-creator-graph/reports/full-workflow.json`
- release_manifest: `docs/experiments/tiktok-creative-creator-graph/data/release/manifest.json`
- release_data_card: `docs/experiments/tiktok-creative-creator-graph/data/release/DATA_CARD.md`
- release_verification: `docs/experiments/tiktok-creative-creator-graph/reports/release-verification.json`
- scale_plan: `docs/experiments/tiktok-creative-creator-graph/reports/scale-plan.json`
- scale_waves: `docs/experiments/tiktok-creative-creator-graph/reports/scale-waves.json`
- wave_ledger: `docs/experiments/tiktok-creative-creator-graph/reports/wave-ledger.json`
- provider_preflight: `docs/experiments/tiktok-creative-creator-graph/reports/provider-preflight.json`
- live_run_manifest: `docs/experiments/tiktok-creative-creator-graph/reports/live-run-manifest.json`
- live_manifest_runner: `docs/experiments/tiktok-creative-creator-graph/reports/live-manifest-run.json`
- live_run_manifest_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/live_run_manifest.csv`
- live_manifest_runner_steps: `docs/experiments/tiktok-creative-creator-graph/data/processed/live_manifest_run_steps.jsonl`
- refresh_plan: `docs/experiments/tiktok-creative-creator-graph/reports/refresh-plan.json`
- acquisition_batches: `docs/experiments/tiktok-creative-creator-graph/reports/acquisition-batches.json`
- candidate_frontier: `docs/experiments/tiktok-creative-creator-graph/reports/candidate-frontier.json`
- candidate_frontier_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/candidate_frontier.csv`
- acquisition_import: `docs/experiments/tiktok-creative-creator-graph/reports/acquisition-import.json`
- acquisition_import_preview: `docs/experiments/tiktok-creative-creator-graph/reports/acquisition-import-preview.json`
- acquisition_import_waves: `docs/experiments/tiktok-creative-creator-graph/data/processed/acquisition_import_waves.jsonl`
- acquisition_run_history: `docs/experiments/tiktok-creative-creator-graph/data/processed/acquisition_run_history.jsonl`
- source_yield: `docs/experiments/tiktok-creative-creator-graph/reports/source-yield.json`
- adjacency_expansion: `docs/experiments/tiktok-creative-creator-graph/reports/adjacency-expansion.json`
- category_coverage: `docs/experiments/tiktok-creative-creator-graph/reports/category-coverage.json`
- review_sample: `docs/experiments/tiktok-creative-creator-graph/data/processed/review_sample.csv`
- review_packet: `docs/experiments/tiktok-creative-creator-graph/reports/review-packet.json`
- review_packet_latest: `docs/experiments/tiktok-creative-creator-graph/data/processed/review_packet_latest.csv`
- review_packet_batches: `docs/experiments/tiktok-creative-creator-graph/data/processed/review_packet_batches.csv`
- review_plan: `docs/experiments/tiktok-creative-creator-graph/reports/review-plan.json`
- scale_wave_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/scale_waves.csv`
- wave_ledger_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/wave_ledger.csv`
- provider_preflight_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/provider_preflight.csv`
- useful_creators: `docs/experiments/tiktok-creative-creator-graph/data/release/useful_creators.csv`
- benchmark_creators: `docs/experiments/tiktok-creative-creator-graph/data/release/benchmark_creators.csv`
- review_queue: `docs/experiments/tiktok-creative-creator-graph/data/release/review_queue.csv`
- all_scored_creators: `docs/experiments/tiktok-creative-creator-graph/data/release/all_scored_creators.csv`

## Quality Gates

- release_verification_complete: pass
- readiness_complete: incomplete
- review_packet_available: pass
- provider_runner_exercised: pass
- acquisition_import_preview_available: pass
- adjacency_expansion_available: pass
- acquisition_run_history_available: pass
- scale_plan_available: pass
- scale_waves_available: pass
- wave_ledger_available: pass
- provider_preflight_available: pass
- live_run_manifest_available: pass
- live_manifest_runner_exercised: pass
- refresh_plan_available: pass

## Registration Constraints

- Do not register as production-complete until useful, excellent, and human-review targets pass readiness.
- Preserve raw-source provenance for every released creator.
- Use release manifest hashes as the control-plane file integrity contract.
- Treat the current smoke corpus as machinery validation only.
- Confirm source/vendor terms before promoting live provider-derived exports.

## Next Actions

- Acquire and import 49993 more useful creators through provider/search/graph batches.
- Add 4994 more excellent creators for benchmark-quality coverage.
- Collect 496 more human review decisions before production claims.
- Run full workflow, release package, verification, scale plan, refresh plan, and readiness after each import wave.
- Register the release package in the control plane only after readiness is complete.
