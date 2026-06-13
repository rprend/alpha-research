# TikTok Creative Creator Graph Publication Handoff

Generated: 2026-06-13T04:00:46.044Z
Publish state: not-ready-production-data
Readiness status: incomplete

## Objective

Build roughly 50,000 TikTok-visible creative creator accounts worth learning from, with graph expansion and release provenance.

## Current Corpus

- Accounts: 10591
- Identities: 10443
- Videos: 59
- Graph edges: 639
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
- Source yield rows: 886
- Adjacency expansion rows: 28
- Adjacency expansion added rows: 21
- Category coverage: 5/11
- Acquisition tasks: 92
- Candidate frontier: 87
- Candidate frontier handles: 7
- Candidate frontier queries: 80
- Acquisition import preview accounts: 10586
- Acquisition import preview ready: true
- Acquisition import waves: 32
- Acquisition import traced rows: 172981
- Acquisition import untraced rows: 162
- Acquisition runner runnable tasks: 2
- Acquisition runner skipped tasks: 0
- Acquisition run history: 17
- Latest recorded acquisition provider: public_web
- Latest recorded acquisition output rows: 0
- Zero-yield live acquisition runs: 2
- External lead packet assignments: 120
- External lead packet requested leads: 30000
- External lead packet category rows: 11
- External lead worklist items: 511
- External lead worklist lead quota: 30000
- External lead work-item template files: 511
- External lead work-item template rows: 30000
- External lead work-item merge input files: 0
- External lead work-item merge output files: 0
- External lead work-item merge unique valid rows: 0
- External lead work-item merge unknown files: 0
- External lead template files: 120
- External lead template rows: 30000
- External lead packet completed files: 0
- External lead packet import-ready assignments: 0
- External lead packet no-valid-handles assignments: 0
- External lead packet valid leads: 0
- External lead packet ready files: 0
- External lead packet pending import files: 0
- External lead packet imported files: 0
- External lead packet import failed files: 0
- External lead packet import output rows: 0
- Scale waves: 10000
- Wave ledger rows: 10000
- Wave ledger planned: 10000
- Wave ledger imported: 0
- Wave ledger imported empty: 0
- Wave ledger failed: 0
- Wave ledger imported output accounts: 0
- Wave ledger under-yield imports: 0
- Provider preflight tasks: 20
- Provider preflight ready tasks: 0
- Provider preflight blocked tasks: 20
- Provider preflight estimated cost: $0
- Live run manifest waves: 10
- Live run manifest runnable waves: 0
- Live run manifest blocked waves: 10
- Live run manifest estimated cost: $0
- Live manifest runner steps: 0
- Live manifest runner selected waves: 0
- Live manifest runner mode: dry_run
- Refresh tasks: 10591

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
- external_lead_list_readme: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/README.md`
- external_lead_list_importer: `docs/experiments/tiktok-creative-creator-graph/scripts/import-external-lead-list.mjs`
- external_lead_acquisition_packet: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-acquisition-packet.json`
- external_lead_worklist: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-worklist.json`
- external_lead_worklist_csv: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/source-worklist.csv`
- external_lead_work_item_templates: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-work-item-templates.json`
- external_lead_work_item_template_dir: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/work-item-templates`
- external_lead_work_item_merge: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-work-item-merge.json`
- external_lead_work_item_completed_dir: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/work-items-completed`
- external_lead_templates: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-templates.json`
- external_lead_template_dir: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/templates`
- external_lead_progress: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-progress.json`
- external_lead_progress_queue: `docs/experiments/tiktok-creative-creator-graph/data/processed/external_lead_packet_status.csv`
- external_lead_packet_import: `docs/experiments/tiktok-creative-creator-graph/reports/external-lead-packet-import.json`
- external_lead_packet_import_ledger: `docs/experiments/tiktok-creative-creator-graph/data/processed/external_lead_packet_imports.jsonl`
- external_lead_acquisition_packet_csv: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/acquisition-packet.csv`
- external_lead_category_targets_csv: `docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/category-targets.csv`
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
- provider_preflight_available: incomplete
- live_run_manifest_available: incomplete
- live_manifest_runner_exercised: incomplete
- latest_live_public_web_attempt_zero_yield: pass
- refresh_plan_available: pass

## Registration Constraints

- Do not register as production-complete until useful, excellent, and human-review targets pass readiness.
- Preserve raw-source provenance for every released creator.
- Use release manifest hashes as the control-plane file integrity contract.
- Treat the current smoke corpus as machinery validation only.
- Confirm source/vendor terms before promoting live provider-derived exports.

## Next Actions

- Acquire and import 49993 more useful creators through provider/search/graph batches.
- Use the external lead acquisition packet for token-free collection: 120 assignments requesting 30000 TikTok profile leads.
- Assign source-level work from data/raw/external-leads/source-worklist.csv: 511 URL work items covering 30000 requested leads.
- Use data/raw/external-leads/work-item-templates/ for fillable per-URL CSVs: 511 templates covering 30000 rows.
- Save completed source work items as data/raw/external-leads/work-items-completed/<work_item_id>.csv, then run merge-external-lead-work-items.mjs to assemble assignment-level completed files.
- Use data/raw/external-leads plus import-external-lead-list.mjs for contractor, directory, search-tool, or manually sourced TikTok profile lists.
- Do not rely on the current public Bing HTML path as a scale source until it produces nonzero handles; latest public_web run yielded 0 rows.
- Add 4994 more excellent creators for benchmark-quality coverage.
- Collect 496 more human review decisions before production claims.
- Run full workflow, release package, verification, scale plan, refresh plan, and readiness after each import wave.
- Register the release package in the control plane only after readiness is complete.
