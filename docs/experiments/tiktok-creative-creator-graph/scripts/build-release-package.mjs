import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const releaseDir = join(experimentDir, 'data/release')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function readJson(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function writeCsv(path, rows) {
  if (!rows.length) {
    writeFileSync(path, '')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function sha256(path) {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function firstSource(sources) {
  return sources.find((source) => source.source_type !== 'import') ?? sources[0] ?? {}
}

function main() {
  ensureDir(releaseDir)
  ensureDir(reportsDir)

  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const videos = readJsonl(join(processedDir, 'creator_videos.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl')).length
    ? readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
    : readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const identities = readJsonl(join(processedDir, 'creator_identities.jsonl'))
  const membership = readJsonl(join(processedDir, 'creator_identity_membership.jsonl'))
  const sources = readJsonl(join(processedDir, 'creator_sources.jsonl'))
  const reviews = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const readiness = readJson(join(reportsDir, 'readiness.json'))

  const byAccount = new Map(accounts.map((row) => [row.id, row]))
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const byScore = new Map(scores.map((row) => [row.creator_id, row]))
  const byMembership = new Map(membership.map((row) => [row.creator_id, row]))
  const identityById = new Map(identities.map((row) => [row.identity_id, row]))
  const sourcesByCreator = Map.groupBy(sources, (row) => row.creator_id)
  const reviewByCreator = new Map(reviews.map((row) => [row.creator_id, row]))
  const videoCounts = videos.reduce((acc, row) => {
    acc[row.creator_id] = (acc[row.creator_id] ?? 0) + 1
    return acc
  }, {})

  const releaseRows = accounts.map((account) => {
    const score = byScore.get(account.id) ?? {}
    const classification = byClass.get(account.id) ?? {}
    const member = byMembership.get(account.id) ?? {}
    const identity = identityById.get(member.identity_id) ?? {}
    const source = firstSource(sourcesByCreator.get(account.id) ?? [])
    const review = reviewByCreator.get(account.id) ?? {}
    const reviewedStatus = score.reviewed_status || score.status || 'unknown'
    return {
      identity_id: member.identity_id ?? '',
      creator_id: account.id,
      handle: account.handle,
      display_name: account.display_name,
      profile_url: account.profile_url,
      primary_label: classification.primary_label ?? '',
      secondary_labels: Array.isArray(classification.secondary_labels) ? classification.secondary_labels.join('; ') : '',
      reviewed_status: reviewedStatus,
      overall_usefulness: score.overall_usefulness ?? '',
      creative_signal: score.creative_signal ?? '',
      category_fit: score.category_fit ?? '',
      originality: score.originality ?? '',
      graph_value: score.graph_value ?? '',
      repost_risk: score.repost_risk ?? '',
      follower_count: account.follower_count ?? '',
      likes_count: account.likes_count ?? '',
      last_post_at: account.last_post_at ?? '',
      video_count: videoCounts[account.id] ?? 0,
      external_links: (account.bio_links ?? []).join('; '),
      source_type: source.source_type ?? '',
      source_query: source.source_query ?? '',
      review_decision: review.decision ?? score.review_decision ?? '',
      duplicate_risk: identity.duplicate_risk ?? '',
      is_canonical_identity: member.is_canonical ?? true,
    }
  }).sort((a, b) => Number(b.overall_usefulness || 0) - Number(a.overall_usefulness || 0) || a.handle.localeCompare(b.handle))

  const usefulRows = releaseRows.filter((row) => ['useful', 'excellent'].includes(row.reviewed_status))
  const benchmarkRows = releaseRows.filter((row) => row.reviewed_status === 'excellent' || row.review_decision === 'excellent_benchmark')
  const rejectedRows = releaseRows.filter((row) => row.reviewed_status === 'reject' || ['repost_or_aggregator', 'brand_or_studio'].includes(row.review_decision))
  const reviewRows = releaseRows.filter((row) => !row.review_decision || row.reviewed_status === 'needs_review')

  const outputs = [
    ['useful_creators.jsonl', usefulRows, writeJsonl],
    ['useful_creators.csv', usefulRows, writeCsv],
    ['benchmark_creators.jsonl', benchmarkRows, writeJsonl],
    ['benchmark_creators.csv', benchmarkRows, writeCsv],
    ['rejected_creators.jsonl', rejectedRows, writeJsonl],
    ['rejected_creators.csv', rejectedRows, writeCsv],
    ['review_queue.csv', reviewRows, writeCsv],
    ['all_scored_creators.csv', releaseRows, writeCsv],
  ]
  for (const [file, rows, writer] of outputs) writer(join(releaseDir, file), rows)

  const manifest = {
    generated_at: new Date().toISOString(),
    objective: 'TikTok creative creator graph release package',
    counts: {
      accounts: accounts.length,
      identities: identities.length,
      useful_creators: usefulRows.length,
      benchmark_creators: benchmarkRows.length,
      rejected_creators: rejectedRows.length,
      review_queue: reviewRows.length,
    },
    readiness,
    files: outputs.map(([file, rows]) => ({
      path: `data/release/${file}`,
      rows: rows.length,
      sha256: sha256(join(releaseDir, file)),
    })),
  }
  writeJson(join(releaseDir, 'manifest.json'), manifest)
  writeFileSync(join(releaseDir, 'DATA_CARD.md'), `# TikTok Creative Creator Graph Data Card

Generated: ${manifest.generated_at}

## Purpose

This release package contains TikTok-visible creative creator records for discovery, review, graph expansion, and benchmark selection. It is optimized for creative usefulness, not influencer marketing audience analysis.

## Counts

- Accounts: ${manifest.counts.accounts}
- Identities: ${manifest.counts.identities}
- Useful creators: ${manifest.counts.useful_creators}
- Benchmark creators: ${manifest.counts.benchmark_creators}
- Rejected creators: ${manifest.counts.rejected_creators}
- Review queue: ${manifest.counts.review_queue}

## Files

${manifest.files.map((file) => `- \`${file.path}\`: ${file.rows} rows, sha256 \`${file.sha256}\``).join('\n')}

## Limits

The current fixture release proves the export contract. The full target is 50,000 useful creators, and readiness remains incomplete until production-scale public metadata imports satisfy that target.
`)

  writeJson(join(reportsDir, 'release-package.json'), manifest)
  writeFileSync(join(reportsDir, 'release-package.md'), `# Release Package

Generated: ${manifest.generated_at}

- Useful creators: ${manifest.counts.useful_creators}
- Benchmark creators: ${manifest.counts.benchmark_creators}
- Rejected creators: ${manifest.counts.rejected_creators}
- Review queue: ${manifest.counts.review_queue}

Manifest: \`data/release/manifest.json\`
Data card: \`data/release/DATA_CARD.md\`
`)

  console.log(JSON.stringify(manifest, null, 2))
}

main()
