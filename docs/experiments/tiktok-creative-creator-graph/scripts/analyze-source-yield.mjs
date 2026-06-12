import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

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

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const sources = readJsonl(join(processedDir, 'creator_sources.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const reviewedScores = readJsonl(join(processedDir, 'creator_scores_reviewed.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const reviews = readJsonl(join(processedDir, 'review_decisions.jsonl'))

  const scoreByCreator = new Map(scores.map((score) => [score.creator_id, score]))
  const reviewedByCreator = new Map(reviewedScores.map((score) => [score.creator_id, score]))
  const classByCreator = new Map(classifications.map((classification) => [classification.creator_id, classification]))
  const reviewByCreator = new Map(reviews.map((review) => [review.creator_id, review]))
  const groups = new Map()

  for (const source of sources) {
    const key = [
      source.source_type || 'unknown',
      source.source_name || 'unknown',
      source.source_query || '',
    ].join('|')
    if (!groups.has(key)) {
      groups.set(key, {
        source_type: source.source_type || 'unknown',
        source_name: source.source_name || 'unknown',
        source_query: source.source_query || '',
        creators_seen: new Set(),
        useful_creators: new Set(),
        excellent_creators: new Set(),
        rejected_creators: new Set(),
        reviewed_creators: new Set(),
        labels: new Map(),
        score_sum: 0,
      })
    }

    const group = groups.get(key)
    const score = reviewedByCreator.get(source.creator_id) ?? scoreByCreator.get(source.creator_id)
    const classification = classByCreator.get(source.creator_id)
    const review = reviewByCreator.get(source.creator_id)
    const status = score?.reviewed_status ?? score?.status ?? 'unknown'
    group.creators_seen.add(source.creator_id)
    group.score_sum += Number(score?.overall_usefulness ?? 0)
    if (['useful', 'excellent'].includes(status)) group.useful_creators.add(source.creator_id)
    if (status === 'excellent') group.excellent_creators.add(source.creator_id)
    if (status === 'reject') group.rejected_creators.add(source.creator_id)
    if (review) group.reviewed_creators.add(source.creator_id)
    if (classification?.primary_label) {
      group.labels.set(classification.primary_label, (group.labels.get(classification.primary_label) ?? 0) + 1)
    }
  }

  const rows = Array.from(groups.values()).map((group) => {
    const seen = group.creators_seen.size
    const useful = group.useful_creators.size
    const excellent = group.excellent_creators.size
    const rejected = group.rejected_creators.size
    const reviewed = group.reviewed_creators.size
    const usefulnessRate = seen ? useful / seen : 0
    const rejectionRate = seen ? rejected / seen : 0
    const averageScore = seen ? group.score_sum / seen : 0
    const yieldScore = Math.max(0, Math.min(100, averageScore * 0.45 + usefulnessRate * 40 + excellent * 8 + reviewed * 3 - rejectionRate * 25))
    return {
      source_type: group.source_type,
      source_name: group.source_name,
      source_query: group.source_query,
      creators_seen: seen,
      useful_creators: useful,
      excellent_creators: excellent,
      rejected_creators: rejected,
      reviewed_creators: reviewed,
      usefulness_rate: Number(usefulnessRate.toFixed(3)),
      rejection_rate: Number(rejectionRate.toFixed(3)),
      average_usefulness: Number(averageScore.toFixed(1)),
      yield_score: Math.round(yieldScore),
      top_labels: Array.from(group.labels.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => `${label}:${count}`).join('; '),
    }
  }).sort((a, b) => b.yield_score - a.yield_score || b.useful_creators - a.useful_creators)

  writeJsonl(join(processedDir, 'source_yield.jsonl'), rows)
  writeCsv(join(processedDir, 'source_yield.csv'), rows)

  const summary = {
    generated_at: new Date().toISOString(),
    sources: rows.length,
    best_sources: rows.slice(0, 10),
    weak_sources: rows.filter((row) => row.creators_seen >= 1 && row.useful_creators === 0).slice(0, 10),
    total_seen: new Set(sources.map((source) => source.creator_id)).size,
  }
  writeJson(join(reportsDir, 'source-yield.json'), summary)
  writeFileSync(join(reportsDir, 'source-yield.md'), `# Source Yield

Generated: ${summary.generated_at}

- Sources: ${summary.sources}
- Distinct creators seen through sources: ${summary.total_seen}

## Best Sources

| Source type | Query | Seen | Useful | Rejected | Yield |
| --- | --- | ---: | ---: | ---: | ---: |
${summary.best_sources.map((row) => `| ${row.source_type} | ${row.source_query || row.source_name} | ${row.creators_seen} | ${row.useful_creators} | ${row.rejected_creators} | ${row.yield_score} |`).join('\n')}

## Weak Sources

| Source type | Query | Seen | Useful | Rejected | Yield |
| --- | --- | ---: | ---: | ---: | ---: |
${summary.weak_sources.map((row) => `| ${row.source_type} | ${row.source_query || row.source_name} | ${row.creators_seen} | ${row.useful_creators} | ${row.rejected_creators} | ${row.yield_score} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
