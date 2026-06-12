import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const targetUsefulCreators = 50000
const targetExcellentCreators = 5000
const targetReviewDecisions = 500
const defaultBatchSize = 250

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function ceilDiv(a, b) {
  return Math.ceil(a / Math.max(Number.EPSILON, b))
}

function conservativeRate(observed, fallback) {
  if (!Number.isFinite(observed) || observed <= 0) return fallback
  // Small fixture samples are overconfident. Cap planning rates until production imports exist.
  return Math.max(0.02, Math.min(observed, fallback))
}

function main() {
  ensureDir(reportsDir)

  const readiness = readJson(join(reportsDir, 'readiness.json'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const acquisitionTasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl')).length
    ? readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
    : readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const reviewDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))

  const currentUseful = readiness?.counts?.release_useful_creators ?? scores.filter((row) => ['useful', 'excellent'].includes(row.reviewed_status ?? row.status)).length
  const currentExcellent = readiness?.counts?.benchmark_creators ?? scores.filter((row) => (row.reviewed_status ?? row.status) === 'excellent').length
  const currentReviewed = reviewDecisions.length
  const currentAccounts = readiness?.counts?.accounts ?? scores.length
  const usefulFromScores = scores.filter((row) => ['useful', 'excellent'].includes(row.reviewed_status ?? row.status)).length
  const excellentFromScores = scores.filter((row) => (row.reviewed_status ?? row.status) === 'excellent').length
  const observedUsefulRate = currentAccounts ? usefulFromScores / currentAccounts : 0
  const observedExcellentRate = usefulFromScores ? excellentFromScores / usefulFromScores : 0
  const planningUsefulRate = conservativeRate(observedUsefulRate, 0.2)
  const planningExcellentRate = conservativeRate(observedExcellentRate, 0.1)
  const usefulGap = Math.max(0, targetUsefulCreators - currentUseful)
  const excellentGap = Math.max(0, targetExcellentCreators - currentExcellent)
  const reviewGap = Math.max(0, targetReviewDecisions - currentReviewed)
  const candidateAccountsNeeded = ceilDiv(usefulGap, planningUsefulRate)
  const importBatchesNeeded = ceilDiv(candidateAccountsNeeded, defaultBatchSize)
  const usefulNeededForExcellent = ceilDiv(excellentGap, planningExcellentRate)
  const reviewBatchesNeeded = ceilDiv(reviewGap, 250)

  const rankedSurfaces = sourceYield
    .filter((row) => row.source_type && row.source_type !== 'search_seed')
    .sort((a, b) => Number(b.yield_score) - Number(a.yield_score))
    .slice(0, 10)
    .map((row, index) => ({
      rank: index + 1,
      source_type: row.source_type,
      source_query: row.source_query,
      yield_score: row.yield_score,
      usefulness_rate: row.usefulness_rate,
      rejected_rate: row.rejection_rate,
      recommended_batch_share: index < 3 ? 0.2 : index < 6 ? 0.1 : 0.05,
    }))

  const nextBatches = acquisitionTasks.slice(0, 25).map((task, index) => ({
    sequence: index + 1,
    batch_id: task.batch_id,
    priority: task.priority,
    acquisition_surface: task.acquisition_surface,
    query: task.query,
    expected_output: task.expected_output,
    import_target: task.import_target,
  }))

  const summary = {
    generated_at: new Date().toISOString(),
    targets: {
      useful_creators: targetUsefulCreators,
      excellent_creators: targetExcellentCreators,
      review_decisions: targetReviewDecisions,
    },
    current: {
      accounts: currentAccounts,
      useful_creators: currentUseful,
      excellent_creators: currentExcellent,
      review_decisions: currentReviewed,
    },
    gaps: {
      useful_creators: usefulGap,
      excellent_creators: excellentGap,
      review_decisions: reviewGap,
    },
    planning_assumptions: {
      observed_useful_rate: Number(observedUsefulRate.toFixed(3)),
      planning_useful_rate: Number(planningUsefulRate.toFixed(3)),
      observed_excellent_rate_among_useful: Number(observedExcellentRate.toFixed(3)),
      planning_excellent_rate_among_useful: Number(planningExcellentRate.toFixed(3)),
      import_batch_size: defaultBatchSize,
    },
    estimated_work: {
      candidate_accounts_needed: candidateAccountsNeeded,
      import_batches_needed: importBatchesNeeded,
      useful_creators_needed_for_excellent_target: usefulNeededForExcellent,
      review_batches_needed: reviewBatchesNeeded,
    },
    ranked_surfaces: rankedSurfaces,
    next_batches: nextBatches,
  }

  writeJson(join(reportsDir, 'scale-plan.json'), summary)
  writeFileSync(join(reportsDir, 'scale-plan.md'), `# Scale Plan

Generated: ${summary.generated_at}

## Targets

- Useful creators: ${targetUsefulCreators}
- Excellent creators: ${targetExcellentCreators}
- Review decisions: ${targetReviewDecisions}

## Current

- Accounts: ${summary.current.accounts}
- Useful creators: ${summary.current.useful_creators}
- Excellent creators: ${summary.current.excellent_creators}
- Review decisions: ${summary.current.review_decisions}

## Estimated Work

- Candidate accounts needed: ${summary.estimated_work.candidate_accounts_needed}
- Import batches needed at ${defaultBatchSize} candidates per batch: ${summary.estimated_work.import_batches_needed}
- Useful creators needed for excellent target: ${summary.estimated_work.useful_creators_needed_for_excellent_target}
- Review batches needed: ${summary.estimated_work.review_batches_needed}

## Planning Assumptions

- Observed useful rate: ${summary.planning_assumptions.observed_useful_rate}
- Planning useful rate: ${summary.planning_assumptions.planning_useful_rate}
- Observed excellent rate among useful: ${summary.planning_assumptions.observed_excellent_rate_among_useful}
- Planning excellent rate among useful: ${summary.planning_assumptions.planning_excellent_rate_among_useful}

## Top Surfaces

| Rank | Surface | Query | Yield | Useful rate | Rejection rate |
| ---: | --- | --- | ---: | ---: | ---: |
${rankedSurfaces.map((row) => `| ${row.rank} | ${row.source_type} | ${row.source_query || ''} | ${row.yield_score} | ${row.usefulness_rate} | ${row.rejected_rate} |`).join('\n')}

## Next Batches

| Seq | Priority | Surface | Query |
| ---: | ---: | --- | --- |
${nextBatches.map((row) => `| ${row.sequence} | ${row.priority} | ${row.acquisition_surface} | ${row.query} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
