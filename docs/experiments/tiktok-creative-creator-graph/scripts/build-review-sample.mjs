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

const maxRows = Number(args.get('--max-rows') ?? 250)
const perLabelTarget = Number(args.get('--per-label') ?? 25)

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
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

function newestWave(waves) {
  return [...waves].sort((a, b) => String(b.generated_at).localeCompare(String(a.generated_at)))[0] ?? null
}

function reviewBand(row) {
  if (row.status === 'excellent') return 'benchmark_check'
  if (row.status === 'reject') return 'rejection_check'
  if (row.status === 'needs_review') return 'borderline'
  return 'quality_audit'
}

function main() {
  const reviewQueue = readJsonl(join(processedDir, 'review_queue.jsonl'))
  const decisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const categoryCoverage = readJsonl(join(processedDir, 'category_coverage.jsonl'))
  const waves = readJsonl(join(processedDir, 'acquisition_import_waves.jsonl'))
  const decidedIds = new Set(decisions.map((row) => row.creator_id))
  const coverageByLabel = new Map(categoryCoverage.map((row) => [row.label, row]))
  const latestWave = newestWave(waves)

  const candidates = reviewQueue
    .filter((row) => !decidedIds.has(row.creator_id))
    .map((row) => {
      const coverage = coverageByLabel.get(row.primary_label)
      const uncoveredBoost = Number(coverage?.useful_primary_accounts ?? 0) === 0 ? 100 : 0
      const gapBoost = Math.min(50, Math.ceil(Number(coverage?.useful_gap ?? 0) / 100))
      const priorityScore = (6 - Number(row.review_priority ?? 5)) * 100 + uncoveredBoost + gapBoost + Number(row.overall_usefulness ?? 0)
      return {
        ...row,
        review_band: reviewBand(row),
        category_useful_gap: coverage?.useful_gap ?? '',
        category_current_useful: coverage?.useful_primary_accounts ?? '',
        latest_wave_id: latestWave?.wave_id ?? '',
        sample_score: priorityScore,
      }
    })
    .sort((a, b) => b.sample_score - a.sample_score || String(a.primary_label).localeCompare(String(b.primary_label)) || String(a.handle).localeCompare(String(b.handle)))

  const byLabel = new Map()
  const selected = []
  for (const row of candidates) {
    const label = row.primary_label || 'unclassified'
    const count = byLabel.get(label) ?? 0
    if (count >= perLabelTarget) continue
    selected.push(row)
    byLabel.set(label, count + 1)
    if (selected.length >= maxRows) break
  }

  const outputRows = selected.map((row, index) => ({
    review_sample_id: `review_${String(index + 1).padStart(5, '0')}`,
    creator_id: row.creator_id,
    handle: row.handle,
    display_name: row.display_name,
    primary_label: row.primary_label,
    review_band: row.review_band,
    status: row.status,
    overall_usefulness: row.overall_usefulness,
    review_priority: row.review_priority,
    sample_score: row.sample_score,
    review_reasons: (row.review_reasons ?? []).join('|'),
    category_useful_gap: row.category_useful_gap,
    category_current_useful: row.category_current_useful,
    latest_wave_id: row.latest_wave_id,
    profile_url: row.profile_url,
  }))

  writeJsonl(join(processedDir, 'review_sample.jsonl'), outputRows)
  writeCsv(join(processedDir, 'review_sample.csv'), outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    requested_rows: maxRows,
    selected_rows: outputRows.length,
    available_unreviewed_rows: candidates.length,
    latest_wave_id: latestWave?.wave_id ?? '',
    category_counts: outputRows.reduce((acc, row) => {
      acc[row.primary_label] = (acc[row.primary_label] ?? 0) + 1
      return acc
    }, {}),
    band_counts: outputRows.reduce((acc, row) => {
      acc[row.review_band] = (acc[row.review_band] ?? 0) + 1
      return acc
    }, {}),
  }

  writeJson(join(reportsDir, 'review-sample.json'), summary)
  writeFileSync(join(reportsDir, 'review-sample.md'), `# Review Sample

Generated: ${summary.generated_at}

- Requested rows: ${summary.requested_rows}
- Selected rows: ${summary.selected_rows}
- Available unreviewed rows: ${summary.available_unreviewed_rows}
- Latest wave id: ${summary.latest_wave_id || 'none'}

## Category Counts

${Object.entries(summary.category_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Review Bands

${Object.entries(summary.band_counts).map(([band, count]) => `- ${band}: ${count}`).join('\n') || '- None'}

Primary sample file: \`data/processed/review_sample.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
