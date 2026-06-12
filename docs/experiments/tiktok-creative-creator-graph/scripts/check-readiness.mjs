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
  const expansionQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const acquisitionTasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))

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
      status: reviewQueue.length >= targetReviewedAccounts ? 'pass' : 'incomplete',
      evidence: `${reviewQueue.length}/${targetReviewedAccounts} accounts available for review`,
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
      expansion_queue: expansionQueue.length,
      acquisition_tasks: acquisitionTasks.length,
    },
    checks,
    remaining: {
      useful_accounts: Math.max(0, targetUsefulAccounts - usefulAccounts),
      excellent_accounts: Math.max(0, targetExcellentAccounts - excellentAccounts),
      reviewed_accounts: Math.max(0, targetReviewedAccounts - reviewQueue.length),
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
- Expansion queue: ${summary.counts.expansion_queue}
- Acquisition tasks: ${summary.counts.acquisition_tasks}

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
