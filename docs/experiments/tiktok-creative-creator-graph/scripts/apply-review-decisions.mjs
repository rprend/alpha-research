import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const rawReviewDir = join(experimentDir, 'data/raw/review-decisions')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const inputPath = args.get('--input') ? join(root, String(args.get('--input'))) : null

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

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

function parseCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
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

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : null
}

function loadReviewRows() {
  const paths = []
  if (inputPath) {
    paths.push(inputPath)
  } else if (existsSync(rawReviewDir)) {
    for (const file of readdirSync(rawReviewDir).sort()) {
      const path = join(rawReviewDir, file)
      if (['.jsonl', '.json', '.csv'].includes(extname(path))) paths.push(path)
    }
  }

  const rows = []
  for (const path of paths) {
    const extension = extname(path)
    const parsed = extension === '.jsonl'
      ? readJsonl(path)
      : extension === '.json'
        ? readJson(path)
        : readCsv(path)
    const list = Array.isArray(parsed) ? parsed : [parsed]
    for (const row of list) rows.push({ ...row, _source_file: basename(path) })
  }
  return rows
}

function canonicalDecision(value) {
  const decision = String(value ?? '').trim().toLowerCase()
  if (['excellent', 'benchmark', 'excellent_benchmark'].includes(decision)) return 'excellent_benchmark'
  if (['keep', 'approve', 'approved'].includes(decision)) return 'keep'
  if (['maybe', 'needs_review', 'uncertain'].includes(decision)) return 'maybe'
  if (['wrong_category'].includes(decision)) return 'wrong_category'
  if (['reject', 'repost', 'aggregator', 'repost_or_aggregator', 'clip_account'].includes(decision)) return 'repost_or_aggregator'
  if (['brand', 'studio', 'brand_or_studio'].includes(decision)) return 'brand_or_studio'
  return decision || 'maybe'
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const reviewRows = loadReviewRows()
  const accountByHandle = new Map(accounts.map((account) => [account.handle, account]))
  const scoreById = new Map(scores.map((score) => [score.creator_id, score]))
  const classificationById = new Map(classifications.map((classification) => [classification.creator_id, classification]))

  const decisions = []
  const missing = []
  for (const row of reviewRows) {
    const handle = normalizeHandle(row.handle ?? row.profile_url ?? row.url)
    const account = handle ? accountByHandle.get(handle) : null
    if (!account) {
      missing.push({
        handle: handle ?? row.handle ?? '',
        decision: canonicalDecision(row.decision),
        source_file: row._source_file,
        notes: row.notes ?? '',
      })
      continue
    }
    decisions.push({
      creator_id: account.id,
      handle: account.handle,
      decision: canonicalDecision(row.decision),
      reviewer: row.reviewer ?? 'unknown',
      notes: row.notes ?? '',
      source_file: row._source_file,
      reviewed_at: row.reviewed_at ?? new Date().toISOString(),
    })
  }

  const decisionById = new Map(decisions.map((decision) => [decision.creator_id, decision]))
  const reviewedScores = scores.map((score) => {
    const decision = decisionById.get(score.creator_id)
    if (!decision) return { ...score, review_decision: '', reviewed_status: score.status }
    const reviewedStatus = decision.decision === 'excellent_benchmark'
      ? 'excellent'
      : decision.decision === 'keep'
        ? ['reject', 'needs_review'].includes(score.status) ? 'useful' : score.status
        : ['repost_or_aggregator', 'brand_or_studio'].includes(decision.decision)
          ? 'reject'
          : score.status
    return {
      ...score,
      review_decision: decision.decision,
      reviewed_status: reviewedStatus,
    }
  })

  const accepted = reviewedScores
    .filter((score) => ['useful', 'excellent'].includes(score.reviewed_status))
    .map((score) => {
      const account = accounts.find((candidate) => candidate.id === score.creator_id)
      const classification = classificationById.get(score.creator_id)
      return {
        creator_id: score.creator_id,
        handle: account?.handle ?? '',
        primary_label: classification?.primary_label ?? '',
        reviewed_status: score.reviewed_status,
        overall_usefulness: score.overall_usefulness,
        review_decision: score.review_decision,
      }
    })

  const rejected = reviewedScores
    .filter((score) => score.reviewed_status === 'reject')
    .map((score) => {
      const account = accounts.find((candidate) => candidate.id === score.creator_id)
      return {
        creator_id: score.creator_id,
        handle: account?.handle ?? '',
        original_status: score.status,
        review_decision: score.review_decision,
        repost_risk: score.repost_risk,
      }
    })

  const benchmarks = reviewedScores
    .filter((score) => score.reviewed_status === 'excellent')
    .map((score) => {
      const account = accounts.find((candidate) => candidate.id === score.creator_id)
      const classification = classificationById.get(score.creator_id)
      return {
        creator_id: score.creator_id,
        handle: account?.handle ?? '',
        primary_label: classification?.primary_label ?? '',
        overall_usefulness: score.overall_usefulness,
        review_decision: score.review_decision,
      }
    })

  writeJsonl(join(processedDir, 'review_decisions.jsonl'), decisions)
  writeJsonl(join(processedDir, 'review_missing_accounts.jsonl'), missing)
  writeJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'), reviewedScores)
  writeCsv(join(processedDir, 'creator_scores_reviewed.csv'), reviewedScores)
  writeJsonl(join(processedDir, 'accepted_creators.jsonl'), accepted)
  writeJsonl(join(processedDir, 'rejected_creators.jsonl'), rejected)
  writeJsonl(join(processedDir, 'benchmark_creators.jsonl'), benchmarks)

  const summary = {
    generated_at: new Date().toISOString(),
    review_rows: reviewRows.length,
    applied_decisions: decisions.length,
    missing_accounts: missing.length,
    accepted_creators: accepted.length,
    rejected_creators: rejected.length,
    benchmark_creators: benchmarks.length,
    decision_counts: decisions.reduce((acc, decision) => {
      acc[decision.decision] = (acc[decision.decision] ?? 0) + 1
      return acc
    }, {}),
  }
  writeJson(join(reportsDir, 'review-decisions.json'), summary)
  writeFileSync(join(reportsDir, 'review-decisions.md'), `# Review Decisions

Generated: ${summary.generated_at}

- Review rows: ${summary.review_rows}
- Applied decisions: ${summary.applied_decisions}
- Missing accounts: ${summary.missing_accounts}
- Accepted creators: ${summary.accepted_creators}
- Rejected creators: ${summary.rejected_creators}
- Benchmark creators: ${summary.benchmark_creators}

## Decision Counts

${Object.entries(summary.decision_counts).map(([decision, count]) => `- ${decision}: ${count}`).join('\n')}
`)
  console.log(JSON.stringify(summary, null, 2))
}

main()
