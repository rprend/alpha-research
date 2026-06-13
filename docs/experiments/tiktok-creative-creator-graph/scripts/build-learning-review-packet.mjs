import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const packetDir = join(experimentDir, 'data/processed/learning_review_packets')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRows = Number(args.get('--max-rows') ?? 1000)
const batchSize = Number(args.get('--batch-size') ?? 100)

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
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
  if (typeof value === 'string') return value.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
  return [value]
}

function compact(values, limit = 4) {
  return values.map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, limit).join(' | ')
}

function compactCsv(values, limit = 4) {
  return values.map((value) => String(value ?? '').trim()).filter(Boolean).slice(0, limit).join(', ')
}

function suggestedDecision(row) {
  if (row.candidate_tier === 'review_first' && Number(row.overall_usefulness) >= 78) return 'excellent_benchmark'
  if (['review_first', 'strong_candidate'].includes(row.candidate_tier)) return 'keep'
  return 'maybe'
}

function main() {
  ensureDir(packetDir)
  ensureDir(reportsDir)

  const shortlist = readJsonl(join(processedDir, 'learning_candidate_shortlist.jsonl'))
    .filter((row) => row.review_status !== 'reviewed')
    .slice(0, maxRows)
  const accounts = new Map(readJsonl(join(processedDir, 'creator_accounts.jsonl')).map((row) => [row.id, row]))
  const sourcesByCreator = new Map()
  for (const source of readJsonl(join(processedDir, 'creator_sources.jsonl'))) {
    const rows = sourcesByCreator.get(source.creator_id) ?? []
    rows.push(source)
    sourcesByCreator.set(source.creator_id, rows)
  }

  const packetId = `learning_review_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
  const rows = shortlist.map((row, index) => {
    const account = accounts.get(row.creator_id) ?? {}
    const sources = sourcesByCreator.get(row.creator_id) ?? []
    return {
      packet_id: packetId,
      review_batch_id: `learning_batch_${String(Math.floor(index / Math.max(1, batchSize)) + 1).padStart(4, '0')}`,
      review_row_id: `learning_row_${String(index + 1).padStart(5, '0')}`,
      shortlist_rank: row.shortlist_rank,
      handle: row.handle,
      display_name: row.display_name,
      profile_url: row.profile_url,
      primary_label: row.primary_label,
      secondary_labels: row.secondary_labels,
      candidate_tier: row.candidate_tier,
      suggested_decision: suggestedDecision(row),
      learning_candidate_score: row.learning_candidate_score,
      overall_usefulness: row.overall_usefulness,
      category_fit: row.category_fit,
      creative_signal: row.creative_signal,
      public_source_evidence: row.public_source_evidence,
      public_profile_video_count: row.public_profile_video_count,
      bio: account.bio ?? '',
      source_labels: row.source_labels,
      source_names: row.source_names || compact(Array.from(new Set(sources.map((source) => source.source_name))), 5),
      source_queries: row.source_queries || compact(Array.from(new Set(sources.map((source) => source.source_query))), 5),
      reviewer_decision: '',
      reviewer: '',
      notes: '',
    }
  })

  const decisionTemplate = rows.map((row) => ({
    packet_id: row.packet_id,
    review_batch_id: row.review_batch_id,
    review_row_id: row.review_row_id,
    handle: row.handle,
    suggested_decision: row.suggested_decision,
    decision: '',
    reviewer: '',
    notes: '',
  }))

  const batches = []
  for (let index = 0; index < rows.length; index += Math.max(1, batchSize)) {
    const batchRows = rows.slice(index, index + Math.max(1, batchSize))
    const batchTemplates = decisionTemplate.slice(index, index + Math.max(1, batchSize))
    const batchId = batchRows[0]?.review_batch_id ?? `learning_batch_${String(batches.length + 1).padStart(4, '0')}`
    const packetCsv = `data/processed/learning_review_packets/${packetId}-${batchId}.csv`
    const decisionCsv = `data/processed/learning_review_packets/${packetId}-${batchId}-decision-template.csv`
    writeCsv(join(packetDir, `${packetId}-${batchId}.csv`), batchRows)
    writeCsv(join(packetDir, `${packetId}-${batchId}-decision-template.csv`), batchTemplates)
    batches.push({
      packet_id: packetId,
      review_batch_id: batchId,
      sequence: batches.length + 1,
      rows: batchRows.length,
      packet_csv: packetCsv,
      decision_template_csv: decisionCsv,
      candidate_tiers: compactCsv(Array.from(new Set(batchRows.map((item) => item.candidate_tier))), 8),
      primary_labels: compactCsv(Array.from(new Set(batchRows.map((item) => item.primary_label))), 12),
    })
  }

  writeJsonl(join(packetDir, `${packetId}.jsonl`), rows)
  writeCsv(join(packetDir, `${packetId}.csv`), rows)
  writeCsv(join(packetDir, `${packetId}-decision-template.csv`), decisionTemplate)
  writeJsonl(join(packetDir, `${packetId}-batches.jsonl`), batches)
  writeJsonl(join(processedDir, 'learning_review_packet_latest.jsonl'), rows)
  writeCsv(join(processedDir, 'learning_review_packet_latest.csv'), rows)
  writeJsonl(join(processedDir, 'learning_review_packet_batches.jsonl'), batches)
  writeCsv(join(processedDir, 'learning_review_packet_batches.csv'), batches)

  const summary = {
    generated_at: new Date().toISOString(),
    packet_id: packetId,
    requested_rows: maxRows,
    rows: rows.length,
    batch_size: batchSize,
    batches: batches.length,
    packet_csv: `data/processed/learning_review_packets/${packetId}.csv`,
    decision_template_csv: `data/processed/learning_review_packets/${packetId}-decision-template.csv`,
    tier_counts: rows.reduce((acc, row) => {
      acc[row.candidate_tier] = (acc[row.candidate_tier] ?? 0) + 1
      return acc
    }, {}),
    suggested_decision_counts: rows.reduce((acc, row) => {
      acc[row.suggested_decision] = (acc[row.suggested_decision] ?? 0) + 1
      return acc
    }, {}),
  }

  writeJson(join(reportsDir, 'learning-review-packet.json'), summary)
  writeFileSync(join(reportsDir, 'learning-review-packet.md'), `# Learning Review Packet

Generated: ${summary.generated_at}

- Packet id: ${summary.packet_id}
- Rows: ${summary.rows}
- Batch size: ${summary.batch_size}
- Batches: ${summary.batches}
- Packet CSV: \`${summary.packet_csv}\`
- Decision template CSV: \`${summary.decision_template_csv}\`

This packet is sourced from \`learning_candidate_shortlist\` and is meant for fast review of accounts that are likely worth learning from. Fill the \`decision\` column with \`excellent_benchmark\`, \`keep\`, \`maybe\`, \`wrong_category\`, \`repost_or_aggregator\`, or \`brand_or_studio\`, then place completed CSVs in \`data/raw/review-decisions/\`.

## Tiers

${Object.entries(summary.tier_counts).map(([tier, count]) => `- ${tier}: ${count}`).join('\n') || '- None'}

## Suggested Decisions

${Object.entries(summary.suggested_decision_counts).map(([decision, count]) => `- ${decision}: ${count}`).join('\n') || '- None'}

## Batches

| Seq | Batch | Rows | Tiers | Decision template |
| ---: | --- | ---: | --- | --- |
${batches.map((batch) => `| ${batch.sequence} | ${batch.review_batch_id} | ${batch.rows} | ${batch.candidate_tiers || 'none'} | \`${batch.decision_template_csv}\` |`).join('\n') || '| 0 | none | 0 | none | none |'}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
