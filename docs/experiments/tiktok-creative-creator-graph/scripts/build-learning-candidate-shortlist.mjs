import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRows = Number(args.get('--max-rows') ?? 5000)

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Could not parse ${path}:${index + 1}: ${error.message}`)
    }
  })
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

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '')
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return [trimmed]
      }
    }
    return trimmed.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
  }
  return [value]
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function candidateTier(score) {
  if (score >= 220) return 'review_first'
  if (score >= 190) return 'strong_candidate'
  if (score >= 170) return 'medium_candidate'
  return 'long_tail_candidate'
}

function shortlistScore(account, classification, score, reviewedIds) {
  const sourceCount = asArray(account.source_names).length
  const sourceLabelCount = asArray(account.source_labels).length
  const sourceFileCount = asArray(account.source_files).length
  const sourceQueries = asArray(account.source_queries).join(' ').toLowerCase()
  const publicProfileVideos = toNumber(account.video_count)
  const reviewedPenalty = reviewedIds.has(account.id) ? 40 : 0
  const explicitCreativeTermBoost = /film|director|cinema|camera|edit|vfx|animation|sketch|standup|comedian|actor|performer|tutorial|breakdown|behind|creator|artist|designer|video|stream|youtube|tiktok/.test(sourceQueries) ? 12 : 0
  const categoryPenalty = ['reject', 'unclear'].includes(classification?.primary_label) ? 80 : 0
  return Math.round(
    toNumber(score.overall_usefulness) * 1.3
    + toNumber(score.public_source_evidence) * 0.9
    + toNumber(score.category_fit) * 0.55
    + toNumber(score.creative_signal) * 0.45
    + Math.min(20, sourceCount * 4)
    + Math.min(14, sourceLabelCount * 3)
    + Math.min(12, sourceFileCount * 4)
    + Math.min(18, publicProfileVideos / 75)
    + explicitCreativeTermBoost
    - reviewedPenalty
    - categoryPenalty
  )
}

function main() {
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const decisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const accepted = readJsonl(join(processedDir, 'accepted_creators.jsonl'))
  const benchmark = readJsonl(join(processedDir, 'benchmark_creators.jsonl'))
  const rejectedIds = new Set([
    ...scores.filter((row) => row.status === 'reject').map((row) => row.creator_id),
    ...decisions.filter((row) => ['reject', 'rejected'].includes(String(row.decision ?? row.status ?? '').toLowerCase())).map((row) => row.creator_id),
  ])
  const reviewedIds = new Set(decisions.map((row) => row.creator_id))
  const acceptedIds = new Set(accepted.map((row) => row.creator_id))
  const benchmarkIds = new Set(benchmark.map((row) => row.creator_id))
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const byScore = new Map(scores.map((row) => [row.creator_id, row]))

  const rows = accounts
    .filter((account) => !rejectedIds.has(account.id))
    .map((account) => {
      const classification = byClass.get(account.id) ?? {}
      const score = byScore.get(account.id) ?? {}
      const learningCandidateScore = shortlistScore(account, classification, score, reviewedIds)
      return {
        creator_id: account.id,
        handle: account.handle,
        display_name: account.display_name,
        primary_label: classification.primary_label ?? 'unclear',
        secondary_labels: asArray(classification.secondary_labels).join('|'),
        candidate_tier: candidateTier(learningCandidateScore),
        learning_candidate_score: learningCandidateScore,
        review_status: reviewedIds.has(account.id) ? 'reviewed' : 'unreviewed',
        release_status: acceptedIds.has(account.id) ? 'accepted' : benchmarkIds.has(account.id) ? 'benchmark' : score.status ?? 'needs_review',
        overall_usefulness: score.overall_usefulness ?? '',
        category_fit: score.category_fit ?? '',
        creative_signal: score.creative_signal ?? '',
        public_source_evidence: score.public_source_evidence ?? '',
        public_profile_video_count: account.video_count ?? 0,
        source_count: asArray(account.source_names).length,
        source_labels: asArray(account.source_labels).join('|'),
        source_names: asArray(account.source_names).slice(0, 8).join('|'),
        source_queries: asArray(account.source_queries).slice(0, 8).join('|'),
        profile_url: account.profile_url,
      }
    })
    .filter((row) => !['reject', 'unclear'].includes(row.primary_label))
    .sort((a, b) => b.learning_candidate_score - a.learning_candidate_score || String(a.handle).localeCompare(String(b.handle)))
    .slice(0, maxRows)
    .map((row, index) => ({
      shortlist_rank: index + 1,
      ...row,
    }))

  writeJsonl(join(processedDir, 'learning_candidate_shortlist.jsonl'), rows)
  writeCsv(join(processedDir, 'learning_candidate_shortlist.csv'), rows)

  const summary = {
    generated_at: new Date().toISOString(),
    requested_rows: maxRows,
    output_rows: rows.length,
    reviewed_rows: rows.filter((row) => row.review_status === 'reviewed').length,
    unreviewed_rows: rows.filter((row) => row.review_status === 'unreviewed').length,
    tier_counts: rows.reduce((acc, row) => {
      acc[row.candidate_tier] = (acc[row.candidate_tier] ?? 0) + 1
      return acc
    }, {}),
    label_counts: rows.reduce((acc, row) => {
      acc[row.primary_label] = (acc[row.primary_label] ?? 0) + 1
      return acc
    }, {}),
    first_rows: rows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'learning-candidate-shortlist.json'), summary)
  writeFileSync(join(reportsDir, 'learning-candidate-shortlist.md'), `# Learning Candidate Shortlist

Generated: ${summary.generated_at}

- Requested rows: ${summary.requested_rows}
- Output rows: ${summary.output_rows}
- Reviewed rows: ${summary.reviewed_rows}
- Unreviewed rows: ${summary.unreviewed_rows}

This is a prioritization artifact, not a production release gate. A row means the account has enough public provenance and category fit to review for "learn from this creator" value.

## Tiers

${Object.entries(summary.tier_counts).map(([tier, count]) => `- ${tier}: ${count}`).join('\n') || '- None'}

## Labels

${Object.entries(summary.label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

Primary files:

- \`data/processed/learning_candidate_shortlist.csv\`
- \`data/processed/learning_candidate_shortlist.jsonl\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
