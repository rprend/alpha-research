import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const reportsDir = join(experimentDir, 'reports')
const processedDir = join(experimentDir, 'data/processed')
const releaseDir = join(experimentDir, 'data/release')

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function rel(path) {
  return path.replace(`${root}/`, '')
}

function main() {
  const manifest = readJson(join(releaseDir, 'manifest.json'), {})
  const readiness = readJson(join(reportsDir, 'readiness.json'), null)
  const releaseVerification = readJson(join(reportsDir, 'release-verification.json'), null)
  const scalePlan = readJson(join(reportsDir, 'scale-plan.json'), null)
  const scaleWavesReport = readJson(join(reportsDir, 'scale-waves.json'), null)
  const waveLedgerReport = readJson(join(reportsDir, 'wave-ledger.json'), null)
  const providerPreflightReport = readJson(join(reportsDir, 'provider-preflight.json'), null)
  const liveRunManifestReport = readJson(join(reportsDir, 'live-run-manifest.json'), null)
  const refreshPlan = readJson(join(reportsDir, 'refresh-plan.json'), null)
  const reviewPacketReport = readJson(join(reportsDir, 'review-packet.json'), null)
  const categoryCoverage = readJson(join(reportsDir, 'category-coverage.json'), null)
  const acquisitionBatches = readJson(join(reportsDir, 'acquisition-batches.json'), null)
  const candidateFrontierReport = readJson(join(reportsDir, 'candidate-frontier.json'), null)
  const acquisitionRun = readJson(join(reportsDir, 'acquisition-run.json'), null)
  const acquisitionImportPreview = readJson(join(reportsDir, 'acquisition-import-preview.json'), null)
  const importWaves = readJsonl(join(processedDir, 'acquisition_import_waves.jsonl'))
  const acquisitionRunHistory = readJsonl(join(processedDir, 'acquisition_run_history.jsonl'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const reviewSample = readJsonl(join(processedDir, 'review_sample.jsonl'))
  const reviewPacket = readJsonl(join(processedDir, 'review_packet_latest.jsonl'))
  const reviewPlanCategories = readJsonl(join(processedDir, 'review_plan_categories.jsonl'))
  const scaleWaves = readJsonl(join(processedDir, 'scale_waves.jsonl'))
  const waveLedger = readJsonl(join(processedDir, 'wave_ledger.jsonl'))
  const providerPreflight = readJsonl(join(processedDir, 'provider_preflight.jsonl'))
  const liveRunManifest = readJsonl(join(processedDir, 'live_run_manifest.jsonl'))
  const candidateFrontier = readJsonl(join(processedDir, 'candidate_frontier.jsonl'))
  const reviewDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))

  const counts = readiness?.counts ?? manifest.counts ?? {}
  const targetUseful = 50000
  const targetExcellent = 5000
  const targetReview = 500
  const currentUseful = counts.useful_accounts ?? manifest.counts?.useful_creators ?? 0
  const releaseUseful = counts.release_useful_creators ?? manifest.counts?.useful_creators ?? 0
  const currentExcellent = counts.excellent_accounts ?? 0
  const currentReview = counts.review_decisions ?? reviewDecisions.length
  const productionReady = Boolean(readiness?.complete && releaseVerification?.complete)
  const importedLineageRows = importWaves.reduce((sum, wave) => sum + (wave.mapped_lineage_rows ?? 0), 0)
  const untracedImportRows = importWaves.reduce((sum, wave) => sum + (wave.unmapped_lineage_rows ?? 0), 0)

  const handoff = {
    generated_at: new Date().toISOString(),
    dataset_id: 'tiktok-creative-creator-graph',
    title: 'TikTok Creative Creator Graph',
    publish_state: productionReady ? 'ready-for-control-plane-registration' : 'not-ready-production-data',
    readiness_status: readiness?.complete ? 'complete' : 'incomplete',
    format: 'creator-graph-dataset',
    objective: 'Build roughly 50,000 TikTok-visible creative creator accounts worth learning from, with graph expansion and release provenance.',
    unit_of_analysis: 'TikTok-visible creator account, with creator identity grouping when duplicate or cross-platform evidence is available.',
    scope: {
      included: [
        'filmmakers',
        'directors',
        'cinematographers',
        'editors',
        'vfx and animation creators',
        'sketch comedians',
        'standup comedians',
        'actors and performers',
        'film educators',
        'behind-the-scenes creators',
        'creative technologists',
      ],
      excluded: [
        'generic influencer accounts with little creative craft evidence',
        'repost and clip aggregation accounts',
        'brand-only or studio-only accounts',
        'spam or unsafe accounts',
        'celebrity/audience accounts without observable creative process',
      ],
    },
    current_corpus: {
      accounts: counts.accounts ?? manifest.counts?.accounts ?? 0,
      identities: counts.identities ?? manifest.counts?.identities ?? 0,
      videos: counts.videos ?? 0,
      graph_edges: counts.edges ?? 0,
      useful_creators: currentUseful,
      release_useful_creators: releaseUseful,
      excellent_creators: currentExcellent,
      rejected_creators: counts.rejected_accounts ?? manifest.counts?.rejected_creators ?? 0,
      review_queue: counts.review_queue ?? manifest.counts?.review_queue ?? 0,
      review_sample: counts.review_sample ?? reviewSample.length,
      review_packet_rows: counts.review_packet_rows ?? reviewPacket.length,
      review_decision_template_rows: counts.review_decision_template_rows ?? reviewPacketReport?.decision_template_rows ?? 0,
      review_plan_categories: counts.review_plan_categories ?? reviewPlanCategories.length,
      review_decisions: currentReview,
      source_yield_rows: counts.source_yield_rows ?? sourceYield.length,
      category_coverage: categoryCoverage ? `${categoryCoverage.covered_labels}/${categoryCoverage.labels}` : 'missing',
      acquisition_tasks: counts.acquisition_tasks ?? acquisitionBatches?.tasks ?? 0,
      candidate_frontier: counts.candidate_frontier ?? candidateFrontier.length,
      candidate_frontier_handles: counts.candidate_frontier_handles ?? candidateFrontierReport?.handle_targets ?? 0,
      candidate_frontier_queries: counts.candidate_frontier_queries ?? candidateFrontierReport?.query_targets ?? 0,
      acquisition_import_preview_accounts: counts.acquisition_import_preview_accounts ?? acquisitionImportPreview?.output_accounts ?? 0,
      acquisition_import_preview_ready: counts.acquisition_import_preview_ready ?? Boolean(acquisitionImportPreview?.quality_gate?.ready_to_import),
      acquisition_import_waves: counts.acquisition_import_waves ?? importWaves.length,
      acquisition_import_lineage_rows: importedLineageRows,
      acquisition_import_untraced_rows: untracedImportRows,
      acquisition_runner_runnable_tasks: counts.acquisition_runner_runnable_tasks ?? acquisitionRun?.runnable_tasks ?? 0,
      acquisition_runner_skipped_tasks: counts.acquisition_runner_skipped_tasks ?? acquisitionRun?.skipped_tasks ?? 0,
      acquisition_run_history: counts.acquisition_run_history ?? acquisitionRunHistory.length,
      scale_waves: counts.scale_waves ?? scaleWaves.length,
      wave_ledger_rows: counts.wave_ledger_rows ?? waveLedger.length,
      wave_ledger_planned: counts.wave_ledger_planned ?? waveLedger.filter((row) => row.status === 'planned').length,
      wave_ledger_imported: counts.wave_ledger_imported ?? waveLedger.filter((row) => row.status === 'imported').length,
      wave_ledger_imported_empty: counts.wave_ledger_imported_empty ?? waveLedger.filter((row) => row.status === 'imported_empty').length,
      wave_ledger_failed: counts.wave_ledger_failed ?? waveLedger.filter((row) => row.status === 'failed').length,
      wave_ledger_imported_output_accounts: counts.wave_ledger_imported_output_accounts ?? waveLedger.reduce((sum, row) => sum + Number(row.imported_output_accounts ?? 0), 0),
      wave_ledger_under_yield_imports: counts.wave_ledger_under_yield_imports ?? waveLedger.filter((row) => row.import_yield_status === 'under_yield').length,
      provider_preflight_tasks: counts.provider_preflight_tasks ?? providerPreflight.length,
      provider_preflight_ready_tasks: counts.provider_preflight_ready_tasks ?? providerPreflightReport?.ready_tasks ?? 0,
      provider_preflight_blocked_tasks: counts.provider_preflight_blocked_tasks ?? providerPreflightReport?.blocked_tasks ?? 0,
      provider_preflight_estimated_cost_usd: counts.provider_preflight_estimated_cost_usd ?? providerPreflightReport?.estimated_cost_usd ?? 0,
      live_run_manifest_waves: counts.live_run_manifest_waves ?? liveRunManifest.length,
      live_run_manifest_runnable_waves: counts.live_run_manifest_runnable_waves ?? liveRunManifestReport?.runnable_waves ?? 0,
      live_run_manifest_estimated_cost_usd: counts.live_run_manifest_estimated_cost_usd ?? liveRunManifestReport?.estimated_cost_usd ?? 0,
      refresh_tasks: counts.refresh_tasks ?? refreshPlan?.refresh_tasks ?? 0,
    },
    target_gaps: {
      useful_creators: Math.max(0, targetUseful - currentUseful),
      excellent_creators: Math.max(0, targetExcellent - currentExcellent),
      review_decisions: Math.max(0, targetReview - currentReview),
    },
    quality_gates: {
      release_verification_complete: Boolean(releaseVerification?.complete),
      readiness_complete: Boolean(readiness?.complete),
      review_packet_available: Boolean(reviewPacketReport?.rows > 0 && reviewPacketReport?.decision_template_rows > 0),
      provider_runner_exercised: Boolean(acquisitionRun?.selected_tasks > 0),
      acquisition_import_preview_available: Boolean(acquisitionImportPreview?.input_rows > 0),
      acquisition_run_history_available: acquisitionRunHistory.length > 0,
      scale_plan_available: Boolean(scalePlan?.estimated_work),
      scale_waves_available: Boolean(scaleWavesReport?.planned_waves > 0 || scaleWaves.length > 0),
      wave_ledger_available: Boolean(waveLedgerReport?.waves > 0 || waveLedger.length > 0),
      provider_preflight_available: Boolean(providerPreflightReport?.ready_tasks > 0 && providerPreflightReport?.blocked_tasks === 0),
      live_run_manifest_available: Boolean(liveRunManifestReport?.runnable_waves > 0 && liveRunManifestReport?.blocked_waves === 0),
      refresh_plan_available: Boolean(refreshPlan?.refresh_tasks > 0),
    },
    paths: {
      phase_plan: rel(join(experimentDir, 'PHASE_PLAN.md')),
      readme: rel(join(experimentDir, 'README.md')),
      readiness: rel(join(reportsDir, 'readiness.json')),
      full_workflow: rel(join(reportsDir, 'full-workflow.json')),
      release_manifest: rel(join(releaseDir, 'manifest.json')),
      release_data_card: rel(join(releaseDir, 'DATA_CARD.md')),
      release_verification: rel(join(reportsDir, 'release-verification.json')),
      scale_plan: rel(join(reportsDir, 'scale-plan.json')),
      scale_waves: rel(join(reportsDir, 'scale-waves.json')),
      wave_ledger: rel(join(reportsDir, 'wave-ledger.json')),
      provider_preflight: rel(join(reportsDir, 'provider-preflight.json')),
      live_run_manifest: rel(join(reportsDir, 'live-run-manifest.json')),
      live_run_manifest_queue: rel(join(processedDir, 'live_run_manifest.csv')),
      refresh_plan: rel(join(reportsDir, 'refresh-plan.json')),
      acquisition_batches: rel(join(reportsDir, 'acquisition-batches.json')),
      candidate_frontier: rel(join(reportsDir, 'candidate-frontier.json')),
      candidate_frontier_queue: rel(join(processedDir, 'candidate_frontier.csv')),
      acquisition_import: rel(join(reportsDir, 'acquisition-import.json')),
      acquisition_import_preview: rel(join(reportsDir, 'acquisition-import-preview.json')),
      acquisition_import_waves: rel(join(processedDir, 'acquisition_import_waves.jsonl')),
      acquisition_run_history: rel(join(processedDir, 'acquisition_run_history.jsonl')),
      source_yield: rel(join(reportsDir, 'source-yield.json')),
      category_coverage: rel(join(reportsDir, 'category-coverage.json')),
      review_sample: rel(join(processedDir, 'review_sample.csv')),
      review_packet: rel(join(reportsDir, 'review-packet.json')),
      review_packet_latest: rel(join(processedDir, 'review_packet_latest.csv')),
      review_plan: rel(join(reportsDir, 'review-plan.json')),
      scale_wave_queue: rel(join(processedDir, 'scale_waves.csv')),
      wave_ledger_queue: rel(join(processedDir, 'wave_ledger.csv')),
      provider_preflight_queue: rel(join(processedDir, 'provider_preflight.csv')),
      useful_creators: rel(join(releaseDir, 'useful_creators.csv')),
      benchmark_creators: rel(join(releaseDir, 'benchmark_creators.csv')),
      review_queue: rel(join(releaseDir, 'review_queue.csv')),
      all_scored_creators: rel(join(releaseDir, 'all_scored_creators.csv')),
    },
    release_files: manifest.files ?? [],
    registration_constraints: [
      'Do not register as production-complete until useful, excellent, and human-review targets pass readiness.',
      'Preserve raw-source provenance for every released creator.',
      'Use release manifest hashes as the control-plane file integrity contract.',
      'Treat the current smoke corpus as machinery validation only.',
      'Confirm source/vendor terms before promoting live provider-derived exports.',
    ],
    next_actions: [
      `Acquire and import ${Math.max(0, targetUseful - currentUseful)} more useful creators through provider/search/graph batches.`,
      `Add ${Math.max(0, targetExcellent - currentExcellent)} more excellent creators for benchmark-quality coverage.`,
      `Collect ${Math.max(0, targetReview - currentReview)} more human review decisions before production claims.`,
      'Run full workflow, release package, verification, scale plan, refresh plan, and readiness after each import wave.',
      'Register the release package in the control plane only after readiness is complete.',
    ],
  }

  writeJson(join(reportsDir, 'publication-handoff.json'), handoff)
  writeFileSync(join(reportsDir, 'publication-handoff.md'), buildMarkdown(handoff))
  console.log(JSON.stringify(handoff, null, 2))
}

function buildMarkdown(handoff) {
  return `# TikTok Creative Creator Graph Publication Handoff

Generated: ${handoff.generated_at}
Publish state: ${handoff.publish_state}
Readiness status: ${handoff.readiness_status}

## Objective

${handoff.objective}

## Current Corpus

- Accounts: ${handoff.current_corpus.accounts}
- Identities: ${handoff.current_corpus.identities}
- Videos: ${handoff.current_corpus.videos}
- Graph edges: ${handoff.current_corpus.graph_edges}
- Useful creators: ${handoff.current_corpus.useful_creators}
- Release useful creators: ${handoff.current_corpus.release_useful_creators}
- Excellent creators: ${handoff.current_corpus.excellent_creators}
- Review sample: ${handoff.current_corpus.review_sample}
- Review packet rows: ${handoff.current_corpus.review_packet_rows}
- Review decision template rows: ${handoff.current_corpus.review_decision_template_rows}
- Review plan categories: ${handoff.current_corpus.review_plan_categories}
- Review decisions: ${handoff.current_corpus.review_decisions}
- Source yield rows: ${handoff.current_corpus.source_yield_rows}
- Category coverage: ${handoff.current_corpus.category_coverage}
- Acquisition tasks: ${handoff.current_corpus.acquisition_tasks}
- Candidate frontier: ${handoff.current_corpus.candidate_frontier}
- Candidate frontier handles: ${handoff.current_corpus.candidate_frontier_handles}
- Candidate frontier queries: ${handoff.current_corpus.candidate_frontier_queries}
- Acquisition import preview accounts: ${handoff.current_corpus.acquisition_import_preview_accounts}
- Acquisition import preview ready: ${handoff.current_corpus.acquisition_import_preview_ready}
- Acquisition import waves: ${handoff.current_corpus.acquisition_import_waves}
- Acquisition import traced rows: ${handoff.current_corpus.acquisition_import_lineage_rows}
- Acquisition import untraced rows: ${handoff.current_corpus.acquisition_import_untraced_rows}
- Acquisition runner runnable tasks: ${handoff.current_corpus.acquisition_runner_runnable_tasks}
- Acquisition runner skipped tasks: ${handoff.current_corpus.acquisition_runner_skipped_tasks}
- Acquisition run history: ${handoff.current_corpus.acquisition_run_history}
- Scale waves: ${handoff.current_corpus.scale_waves}
- Wave ledger rows: ${handoff.current_corpus.wave_ledger_rows}
- Wave ledger planned: ${handoff.current_corpus.wave_ledger_planned}
- Wave ledger imported: ${handoff.current_corpus.wave_ledger_imported}
- Wave ledger imported empty: ${handoff.current_corpus.wave_ledger_imported_empty}
- Wave ledger failed: ${handoff.current_corpus.wave_ledger_failed}
- Wave ledger imported output accounts: ${handoff.current_corpus.wave_ledger_imported_output_accounts}
- Wave ledger under-yield imports: ${handoff.current_corpus.wave_ledger_under_yield_imports}
- Provider preflight tasks: ${handoff.current_corpus.provider_preflight_tasks}
- Provider preflight ready tasks: ${handoff.current_corpus.provider_preflight_ready_tasks}
- Provider preflight blocked tasks: ${handoff.current_corpus.provider_preflight_blocked_tasks}
- Provider preflight estimated cost: $${handoff.current_corpus.provider_preflight_estimated_cost_usd}
- Live run manifest waves: ${handoff.current_corpus.live_run_manifest_waves}
- Live run manifest runnable waves: ${handoff.current_corpus.live_run_manifest_runnable_waves}
- Live run manifest estimated cost: $${handoff.current_corpus.live_run_manifest_estimated_cost_usd}
- Refresh tasks: ${handoff.current_corpus.refresh_tasks}

## Remaining Production Gaps

- Useful creators: ${handoff.target_gaps.useful_creators}
- Excellent creators: ${handoff.target_gaps.excellent_creators}
- Review decisions: ${handoff.target_gaps.review_decisions}

## Key Paths

${Object.entries(handoff.paths).map(([key, value]) => `- ${key}: \`${value}\``).join('\n')}

## Quality Gates

${Object.entries(handoff.quality_gates).map(([key, value]) => `- ${key}: ${value ? 'pass' : 'incomplete'}`).join('\n')}

## Registration Constraints

${handoff.registration_constraints.map((item) => `- ${item}`).join('\n')}

## Next Actions

${handoff.next_actions.map((item) => `- ${item}`).join('\n')}
`
}

main()
