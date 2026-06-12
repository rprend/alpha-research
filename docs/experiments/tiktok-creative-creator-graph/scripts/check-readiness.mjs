import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const targetUsefulAccounts = 50000
const targetExcellentAccounts = 5000
const targetReviewedAccounts = 500

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function main() {
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const videos = readJsonl(join(processedDir, 'creator_videos.jsonl'))
  const edges = readJsonl(join(processedDir, 'creator_edges.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const reviewQueue = readJsonl(join(processedDir, 'review_queue.jsonl'))
  const reviewDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const reviewSample = readJsonl(join(processedDir, 'review_sample.jsonl'))
  const reviewPacket = readJsonl(join(processedDir, 'review_packet_latest.jsonl'))
  const reviewPlanCategories = readJsonl(join(processedDir, 'review_plan_categories.jsonl'))
  const acceptedCreators = readJsonl(join(processedDir, 'accepted_creators.jsonl'))
  const benchmarkCreators = readJsonl(join(processedDir, 'benchmark_creators.jsonl'))
  const expansionQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const acquisitionTasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))
  const candidateFrontier = readJsonl(join(processedDir, 'candidate_frontier.jsonl'))
  const acquisitionImportWaves = readJsonl(join(processedDir, 'acquisition_import_waves.jsonl'))
  const acquisitionRunHistory = readJsonl(join(processedDir, 'acquisition_run_history.jsonl'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const identities = readJsonl(join(processedDir, 'creator_identities.jsonl'))
  const scaleWaves = readJsonl(join(processedDir, 'scale_waves.jsonl'))
  const waveLedger = readJsonl(join(processedDir, 'wave_ledger.jsonl'))
  const providerPreflight = readJsonl(join(processedDir, 'provider_preflight.jsonl'))
  const liveRunManifest = readJsonl(join(processedDir, 'live_run_manifest.jsonl'))
  const providerPreflightReport = (() => {
    const path = join(reportsDir, 'provider-preflight.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const liveRunManifestReport = (() => {
    const path = join(reportsDir, 'live-run-manifest.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const reviewPacketReport = (() => {
    const path = join(reportsDir, 'review-packet.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const categoryCoverage = (() => {
    const path = join(reportsDir, 'category-coverage.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const releaseUseful = readJsonl(join(experimentDir, 'data/release/useful_creators.jsonl'))
  const releaseVerification = (() => {
    const path = join(reportsDir, 'release-verification.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const scalePlan = (() => {
    const path = join(reportsDir, 'scale-plan.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const refreshTasks = readJsonl(join(processedDir, 'refresh_tasks.jsonl'))
  const publicationHandoff = (() => {
    const path = join(reportsDir, 'publication-handoff.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()
  const acquisitionRun = (() => {
    const path = join(reportsDir, 'acquisition-run.json')
    if (!existsSync(path)) return null
    return JSON.parse(readFileSync(path, 'utf8'))
  })()

  const usefulAccounts = scores.filter((row) => ['useful', 'excellent'].includes(row.status)).length
  const excellentAccounts = scores.filter((row) => row.status === 'excellent').length
  const rejectedAccounts = scores.filter((row) => row.status === 'reject').length
  const scoredAccounts = new Set(scores.map((row) => row.creator_id)).size

  const checks = [
    {
      id: 'seed_intake',
      status: accounts.length > 0 ? 'pass' : 'fail',
      evidence: `${accounts.length} accounts ingested`,
    },
    {
      id: 'video_metadata',
      status: videos.length > 0 ? 'pass' : 'fail',
      evidence: `${videos.length} videos ingested`,
    },
    {
      id: 'graph_edges',
      status: edges.length > 0 ? 'pass' : 'fail',
      evidence: `${edges.length} graph edges generated`,
    },
    {
      id: 'scoring_coverage',
      status: scoredAccounts === accounts.length && accounts.length > 0 ? 'pass' : 'fail',
      evidence: `${scoredAccounts}/${accounts.length} accounts scored`,
    },
    {
      id: 'review_queue',
      status: reviewQueue.length > 0 ? 'pass' : 'fail',
      evidence: `${reviewQueue.length} accounts queued for review`,
    },
    {
      id: 'review_sample',
      status: reviewSample.length > 0 ? 'pass' : 'fail',
      evidence: `${reviewSample.length} sampled accounts ready for review`,
    },
    {
      id: 'review_packet',
      status: reviewPacket.length > 0 && reviewPacketReport?.decision_template_rows > 0 ? 'pass' : 'fail',
      evidence: reviewPacketReport ? `${reviewPacketReport.rows} review packet rows and ${reviewPacketReport.decision_template_rows} decision template rows` : 'review packet missing',
    },
    {
      id: 'review_plan',
      status: reviewPlanCategories.length > 0 ? 'pass' : 'fail',
      evidence: `${reviewPlanCategories.length} category review plan rows generated`,
    },
    {
      id: 'expansion_queue',
      status: expansionQueue.length > 0 ? 'pass' : 'fail',
      evidence: `${expansionQueue.length} expansion targets queued`,
    },
    {
      id: 'acquisition_batches',
      status: acquisitionTasks.length > 0 ? 'pass' : 'fail',
      evidence: `${acquisitionTasks.length} acquisition tasks generated`,
    },
    {
      id: 'candidate_frontier',
      status: candidateFrontier.length > 0 ? 'pass' : 'fail',
      evidence: `${candidateFrontier.length} ranked acquisition candidates generated`,
    },
    {
      id: 'acquisition_import_waves',
      status: acquisitionImportWaves.length > 0 ? 'pass' : 'fail',
      evidence: `${acquisitionImportWaves.length} acquisition import waves tracked`,
    },
    {
      id: 'acquisition_runner',
      status: acquisitionRun?.selected_tasks > 0 ? 'pass' : 'fail',
      evidence: acquisitionRun ? `${acquisitionRun.runnable_tasks ?? acquisitionRun.selected_tasks} runnable of ${acquisitionRun.selected_tasks} selected provider tasks (${acquisitionRun.dry_run ? 'dry run' : 'live'})` : 'acquisition runner has not been exercised',
    },
    {
      id: 'acquisition_run_history',
      status: acquisitionRunHistory.length > 0 ? 'pass' : 'fail',
      evidence: `${acquisitionRunHistory.length} acquisition run history rows persisted`,
    },
    {
      id: 'source_yield',
      status: sourceYield.length > 0 ? 'pass' : 'fail',
      evidence: `${sourceYield.length} source/query yield rows generated`,
    },
    {
      id: 'identity_resolution',
      status: identities.length > 0 ? 'pass' : 'fail',
      evidence: `${identities.length} creator identities resolved`,
    },
    {
      id: 'category_coverage',
      status: categoryCoverage?.labels > 0 ? 'pass' : 'fail',
      evidence: categoryCoverage ? `${categoryCoverage.covered_labels}/${categoryCoverage.labels} target labels covered` : 'category coverage missing',
    },
    {
      id: 'release_package',
      status: releaseUseful.length > 0 ? 'pass' : 'fail',
      evidence: `${releaseUseful.length} useful creators exported for release`,
    },
    {
      id: 'release_verification',
      status: releaseVerification?.complete ? 'pass' : 'fail',
      evidence: releaseVerification ? `${releaseVerification.checks?.length ?? 0} release checks evaluated` : 'release verification missing',
    },
    {
      id: 'scale_plan',
      status: scalePlan?.estimated_work?.candidate_accounts_needed >= 0 ? 'pass' : 'fail',
      evidence: scalePlan ? `${scalePlan.estimated_work.import_batches_needed} estimated import batches` : 'scale plan missing',
    },
    {
      id: 'scale_waves',
      status: scaleWaves.length > 0 ? 'pass' : 'fail',
      evidence: `${scaleWaves.length} executable acquisition waves planned`,
    },
    {
      id: 'wave_ledger',
      status: waveLedger.length > 0 ? 'pass' : 'fail',
      evidence: `${waveLedger.length} wave execution ledger rows generated`,
    },
    {
      id: 'provider_preflight',
      status: providerPreflight.length > 0 && providerPreflightReport?.blocked_tasks === 0 && providerPreflightReport?.within_budget ? 'pass' : 'fail',
      evidence: providerPreflightReport ? `${providerPreflightReport.ready_tasks}/${providerPreflightReport.task_rows} ready provider tasks, budget ${providerPreflightReport.within_budget ? 'ok' : 'exceeded'}` : 'provider preflight missing',
    },
    {
      id: 'live_run_manifest',
      status: liveRunManifest.length > 0 && liveRunManifestReport?.within_budget && liveRunManifestReport?.blocked_waves === 0 ? 'pass' : 'fail',
      evidence: liveRunManifestReport ? `${liveRunManifestReport.runnable_waves}/${liveRunManifestReport.manifest_waves} runnable live waves, estimated cost $${liveRunManifestReport.estimated_cost_usd}` : 'live run manifest missing',
    },
    {
      id: 'refresh_plan',
      status: refreshTasks.length > 0 ? 'pass' : 'fail',
      evidence: `${refreshTasks.length} account refresh tasks generated`,
    },
    {
      id: 'publication_handoff',
      status: publicationHandoff?.dataset_id === 'tiktok-creative-creator-graph' ? 'pass' : 'fail',
      evidence: publicationHandoff ? `${publicationHandoff.publish_state} handoff generated` : 'publication handoff missing',
    },
    {
      id: 'useful_account_target',
      status: usefulAccounts >= targetUsefulAccounts ? 'pass' : 'incomplete',
      evidence: `${usefulAccounts}/${targetUsefulAccounts} useful accounts`,
    },
    {
      id: 'excellent_account_target',
      status: excellentAccounts >= targetExcellentAccounts ? 'pass' : 'incomplete',
      evidence: `${excellentAccounts}/${targetExcellentAccounts} excellent accounts`,
    },
    {
      id: 'human_review_target',
      status: reviewDecisions.length >= targetReviewedAccounts ? 'pass' : 'incomplete',
      evidence: `${reviewDecisions.length}/${targetReviewedAccounts} review decisions applied`,
    },
  ]

  const complete = checks.every((check) => check.status === 'pass')
  const summary = {
    generated_at: new Date().toISOString(),
    complete,
    counts: {
      accounts: accounts.length,
      videos: videos.length,
      edges: edges.length,
      useful_accounts: usefulAccounts,
      excellent_accounts: excellentAccounts,
      rejected_accounts: rejectedAccounts,
      review_queue: reviewQueue.length,
      review_sample: reviewSample.length,
      review_packet_rows: reviewPacket.length,
      review_decision_template_rows: reviewPacketReport?.decision_template_rows ?? 0,
      review_plan_categories: reviewPlanCategories.length,
      review_decisions: reviewDecisions.length,
      accepted_creators: acceptedCreators.length,
      benchmark_creators: benchmarkCreators.length,
      expansion_queue: expansionQueue.length,
      acquisition_tasks: acquisitionTasks.length,
      candidate_frontier: candidateFrontier.length,
      candidate_frontier_handles: candidateFrontier.filter((row) => row.target_kind === 'handle').length,
      candidate_frontier_queries: candidateFrontier.filter((row) => ['query', 'search_query', 'hashtag'].includes(row.target_kind)).length,
      acquisition_import_waves: acquisitionImportWaves.length,
      acquisition_runner_tasks: acquisitionRun?.selected_tasks ?? 0,
      acquisition_runner_runnable_tasks: acquisitionRun?.runnable_tasks ?? acquisitionRun?.selected_tasks ?? 0,
      acquisition_runner_skipped_tasks: acquisitionRun?.skipped_tasks ?? 0,
      acquisition_run_history: acquisitionRunHistory.length,
      source_yield_rows: sourceYield.length,
      identities: identities.length,
      category_coverage_labels: categoryCoverage?.labels ?? 0,
      category_coverage_covered_labels: categoryCoverage?.covered_labels ?? 0,
      release_useful_creators: releaseUseful.length,
      release_verification_checks: releaseVerification?.checks?.length ?? 0,
      scale_plan_import_batches: scalePlan?.estimated_work?.import_batches_needed ?? 0,
      scale_waves: scaleWaves.length,
      wave_ledger_rows: waveLedger.length,
      wave_ledger_planned: waveLedger.filter((row) => row.status === 'planned').length,
      wave_ledger_imported: waveLedger.filter((row) => row.status === 'imported').length,
      wave_ledger_failed: waveLedger.filter((row) => row.status === 'failed').length,
      provider_preflight_tasks: providerPreflight.length,
      provider_preflight_ready_tasks: providerPreflightReport?.ready_tasks ?? 0,
      provider_preflight_blocked_tasks: providerPreflightReport?.blocked_tasks ?? 0,
      provider_preflight_estimated_cost_usd: providerPreflightReport?.estimated_cost_usd ?? 0,
      live_run_manifest_waves: liveRunManifest.length,
      live_run_manifest_runnable_waves: liveRunManifestReport?.runnable_waves ?? 0,
      live_run_manifest_estimated_cost_usd: liveRunManifestReport?.estimated_cost_usd ?? 0,
      refresh_tasks: refreshTasks.length,
      publication_handoff: publicationHandoff ? 1 : 0,
    },
    checks,
    remaining: {
      useful_accounts: Math.max(0, targetUsefulAccounts - usefulAccounts),
      excellent_accounts: Math.max(0, targetExcellentAccounts - excellentAccounts),
      reviewed_accounts: Math.max(0, targetReviewedAccounts - reviewDecisions.length),
    },
  }

  writeJson(join(reportsDir, 'readiness.json'), summary)
  writeFileSync(join(reportsDir, 'readiness.md'), `# Readiness

Generated: ${summary.generated_at}

Complete: ${summary.complete}

## Counts

- Accounts: ${summary.counts.accounts}
- Videos: ${summary.counts.videos}
- Graph edges: ${summary.counts.edges}
- Useful accounts: ${summary.counts.useful_accounts}
- Excellent accounts: ${summary.counts.excellent_accounts}
- Rejected accounts: ${summary.counts.rejected_accounts}
- Review queue: ${summary.counts.review_queue}
- Review sample: ${summary.counts.review_sample}
- Review packet rows: ${summary.counts.review_packet_rows}
- Review decision template rows: ${summary.counts.review_decision_template_rows}
- Review plan categories: ${summary.counts.review_plan_categories}
- Review decisions: ${summary.counts.review_decisions}
- Accepted creators: ${summary.counts.accepted_creators}
- Benchmark creators: ${summary.counts.benchmark_creators}
- Expansion queue: ${summary.counts.expansion_queue}
- Acquisition tasks: ${summary.counts.acquisition_tasks}
- Candidate frontier: ${summary.counts.candidate_frontier}
- Candidate frontier handles: ${summary.counts.candidate_frontier_handles}
- Candidate frontier queries: ${summary.counts.candidate_frontier_queries}
- Acquisition import waves: ${summary.counts.acquisition_import_waves}
- Acquisition runner tasks: ${summary.counts.acquisition_runner_tasks}
- Acquisition runner runnable tasks: ${summary.counts.acquisition_runner_runnable_tasks}
- Acquisition runner skipped tasks: ${summary.counts.acquisition_runner_skipped_tasks}
- Acquisition run history: ${summary.counts.acquisition_run_history}
- Source yield rows: ${summary.counts.source_yield_rows}
- Identities: ${summary.counts.identities}
- Category coverage labels: ${summary.counts.category_coverage_covered_labels}/${summary.counts.category_coverage_labels}
- Release useful creators: ${summary.counts.release_useful_creators}
- Release verification checks: ${summary.counts.release_verification_checks}
- Scale plan import batches: ${summary.counts.scale_plan_import_batches}
- Scale waves: ${summary.counts.scale_waves}
- Wave ledger rows: ${summary.counts.wave_ledger_rows}
- Wave ledger planned: ${summary.counts.wave_ledger_planned}
- Wave ledger imported: ${summary.counts.wave_ledger_imported}
- Wave ledger failed: ${summary.counts.wave_ledger_failed}
- Provider preflight tasks: ${summary.counts.provider_preflight_tasks}
- Provider preflight ready tasks: ${summary.counts.provider_preflight_ready_tasks}
- Provider preflight blocked tasks: ${summary.counts.provider_preflight_blocked_tasks}
- Provider preflight estimated cost: $${summary.counts.provider_preflight_estimated_cost_usd}
- Live run manifest waves: ${summary.counts.live_run_manifest_waves}
- Live run manifest runnable waves: ${summary.counts.live_run_manifest_runnable_waves}
- Live run manifest estimated cost: $${summary.counts.live_run_manifest_estimated_cost_usd}
- Refresh tasks: ${summary.counts.refresh_tasks}
- Publication handoff: ${summary.counts.publication_handoff}

## Checks

${summary.checks.map((check) => `- ${check.id}: ${check.status} (${check.evidence})`).join('\n')}

## Remaining To Full Goal

- Useful accounts: ${summary.remaining.useful_accounts}
- Excellent accounts: ${summary.remaining.excellent_accounts}
- Reviewable accounts: ${summary.remaining.reviewed_accounts}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
