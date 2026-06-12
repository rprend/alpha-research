import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const releaseDir = join(experimentDir, 'data/release')
const reportsDir = join(experimentDir, 'reports')

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
  if (!existsSync(path)) return { headers: [], rows: [] }
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return { headers: [], rows: [] }
  const headers = parseCsvLine(lines[0])
  const rows = lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
  return { headers, rows }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sha256(path) {
  if (!existsSync(path)) return null
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function check(condition, id, evidence, severity = 'error') {
  return {
    id,
    status: condition ? 'pass' : 'fail',
    severity,
    evidence,
  }
}

function duplicateValues(rows, field) {
  const counts = new Map()
  for (const row of rows) {
    const value = row[field]
    if (!value) continue
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  return Array.from(counts.entries()).filter(([, count]) => count > 1).map(([value]) => value)
}

function main() {
  ensureDir(reportsDir)
  const manifestPath = join(releaseDir, 'manifest.json')
  const manifest = readJson(manifestPath)
  const checks = []

  checks.push(check(Boolean(manifest), 'manifest_exists', manifestPath))
  if (!manifest) {
    const summary = { generated_at: new Date().toISOString(), complete: false, checks }
    writeJson(join(reportsDir, 'release-verification.json'), summary)
    console.log(JSON.stringify(summary, null, 2))
    process.exit(1)
  }

  const requiredFiles = [
    'useful_creators.jsonl',
    'useful_creators.csv',
    'benchmark_creators.jsonl',
    'benchmark_creators.csv',
    'rejected_creators.jsonl',
    'rejected_creators.csv',
    'review_queue.csv',
    'all_scored_creators.csv',
    'DATA_CARD.md',
  ]

  for (const file of requiredFiles) {
    checks.push(check(existsSync(join(releaseDir, file)), `file_exists:${file}`, `data/release/${file}`))
  }

  for (const file of manifest.files ?? []) {
    const path = join(experimentDir, file.path)
    const actualHash = sha256(path)
    checks.push(check(actualHash === file.sha256, `sha256:${file.path}`, `expected ${file.sha256}, actual ${actualHash}`))
    if (file.path.endsWith('.jsonl')) {
      const rows = readJsonl(path)
      checks.push(check(rows.length === file.rows, `row_count:${file.path}`, `expected ${file.rows}, actual ${rows.length}`))
    }
    if (file.path.endsWith('.csv')) {
      const csv = readCsv(path)
      checks.push(check(csv.rows.length === file.rows, `row_count:${file.path}`, `expected ${file.rows}, actual ${csv.rows.length}`))
    }
  }

  const useful = readJsonl(join(releaseDir, 'useful_creators.jsonl'))
  const benchmarks = readJsonl(join(releaseDir, 'benchmark_creators.jsonl'))
  const rejected = readJsonl(join(releaseDir, 'rejected_creators.jsonl'))
  const allScored = readCsv(join(releaseDir, 'all_scored_creators.csv'))
  const requiredColumns = [
    'identity_id',
    'creator_id',
    'handle',
    'profile_url',
    'primary_label',
    'reviewed_status',
    'overall_usefulness',
    'source_type',
    'duplicate_risk',
  ]

  for (const column of requiredColumns) {
    checks.push(check(allScored.headers.includes(column), `required_column:${column}`, `all_scored_creators.csv includes ${column}`))
  }

  const usefulBadStatus = useful.filter((row) => !['useful', 'excellent'].includes(row.reviewed_status))
  const rejectedBadStatus = rejected.filter((row) => row.reviewed_status !== 'reject' && !['repost_or_aggregator', 'brand_or_studio'].includes(row.review_decision))
  const benchmarkBadStatus = benchmarks.filter((row) => row.reviewed_status !== 'excellent' && row.review_decision !== 'excellent_benchmark')
  const duplicateCanonicalIdentities = duplicateValues(allScored.rows.filter((row) => row.is_canonical_identity === 'true' || row.is_canonical_identity === true), 'identity_id')
  const missingIdentityRows = allScored.rows.filter((row) => !row.identity_id)
  const missingScoreRows = allScored.rows.filter((row) => row.overall_usefulness === '' || row.overall_usefulness == null)

  checks.push(check(usefulBadStatus.length === 0, 'useful_statuses_valid', `${usefulBadStatus.length} invalid useful rows`))
  checks.push(check(rejectedBadStatus.length === 0, 'rejected_statuses_valid', `${rejectedBadStatus.length} invalid rejected rows`))
  checks.push(check(benchmarkBadStatus.length === 0, 'benchmark_statuses_valid', `${benchmarkBadStatus.length} invalid benchmark rows`))
  checks.push(check(duplicateCanonicalIdentities.length === 0, 'canonical_identity_unique', `${duplicateCanonicalIdentities.length} duplicate canonical identities`))
  checks.push(check(missingIdentityRows.length === 0, 'identity_present', `${missingIdentityRows.length} rows missing identity_id`))
  checks.push(check(missingScoreRows.length === 0, 'score_present', `${missingScoreRows.length} rows missing overall_usefulness`))
  checks.push(check((manifest.counts?.useful_creators ?? -1) === useful.length, 'manifest_useful_count', `manifest ${manifest.counts?.useful_creators}, file ${useful.length}`))
  checks.push(check((manifest.counts?.benchmark_creators ?? -1) === benchmarks.length, 'manifest_benchmark_count', `manifest ${manifest.counts?.benchmark_creators}, file ${benchmarks.length}`))
  checks.push(check((manifest.counts?.rejected_creators ?? -1) === rejected.length, 'manifest_rejected_count', `manifest ${manifest.counts?.rejected_creators}, file ${rejected.length}`))

  const complete = checks.every((row) => row.status === 'pass')
  const summary = {
    generated_at: new Date().toISOString(),
    complete,
    checks,
    counts: {
      useful_creators: useful.length,
      benchmark_creators: benchmarks.length,
      rejected_creators: rejected.length,
      all_scored_creators: allScored.rows.length,
    },
  }

  writeJson(join(reportsDir, 'release-verification.json'), summary)
  writeFileSync(join(reportsDir, 'release-verification.md'), `# Release Verification

Generated: ${summary.generated_at}

Complete: ${summary.complete}

## Counts

- Useful creators: ${summary.counts.useful_creators}
- Benchmark creators: ${summary.counts.benchmark_creators}
- Rejected creators: ${summary.counts.rejected_creators}
- All scored creators: ${summary.counts.all_scored_creators}

## Checks

${summary.checks.map((row) => `- ${row.id}: ${row.status} (${row.evidence})`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!complete) process.exit(1)
}

main()
