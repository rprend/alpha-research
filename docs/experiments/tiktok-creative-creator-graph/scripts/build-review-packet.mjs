import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reviewPacketDir = join(experimentDir, 'data/processed/review_packets')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRows = Number(args.get('--max-rows') ?? 250)
const batchSize = Number(args.get('--batch-size') ?? 250)

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

function compactList(values, limit = 3) {
  return values.filter(Boolean).slice(0, limit).join(' | ')
}

function decisionHint(row) {
  if (row.status === 'excellent') return 'excellent_benchmark'
  if (row.status === 'reject') return 'repost_or_aggregator'
  if (row.review_band === 'borderline') return 'maybe'
  return 'keep'
}

function main() {
  ensureDir(reviewPacketDir)
  ensureDir(reportsDir)

  const reviewSample = readJsonl(join(processedDir, 'review_sample.jsonl')).slice(0, maxRows)
  const accounts = new Map(readJsonl(join(processedDir, 'creator_accounts.jsonl')).map((row) => [row.id, row]))
  const scores = new Map(readJsonl(join(processedDir, 'creator_scores.jsonl')).map((row) => [row.creator_id, row]))
  const videosByCreator = new Map()
  for (const video of readJsonl(join(processedDir, 'creator_videos.jsonl'))) {
    const rows = videosByCreator.get(video.creator_id) ?? []
    rows.push(video)
    videosByCreator.set(video.creator_id, rows)
  }
  const sourcesByCreator = new Map()
  for (const source of readJsonl(join(processedDir, 'creator_sources.jsonl'))) {
    const rows = sourcesByCreator.get(source.creator_id) ?? []
    rows.push(source)
    sourcesByCreator.set(source.creator_id, rows)
  }

  const packetId = `review_packet_${new Date().toISOString().slice(0, 10).replaceAll('-', '')}`
  const rows = reviewSample.map((sample, index) => {
    const account = accounts.get(sample.creator_id) ?? {}
    const score = scores.get(sample.creator_id) ?? {}
    const videos = videosByCreator.get(sample.creator_id) ?? []
    const sources = sourcesByCreator.get(sample.creator_id) ?? []
    const captions = videos.map((video) => video.caption)
    const videoUrls = videos.map((video) => video.url)
    const hashtags = Array.from(new Set(videos.flatMap((video) => video.hashtags ?? [])))
    return {
      packet_id: packetId,
      review_batch_id: `review_batch_${String(Math.floor(index / Math.max(1, batchSize)) + 1).padStart(4, '0')}`,
      review_row_id: `packet_row_${String(index + 1).padStart(5, '0')}`,
      creator_id: sample.creator_id,
      handle: sample.handle,
      display_name: sample.display_name,
      profile_url: sample.profile_url,
      primary_label: sample.primary_label,
      review_band: sample.review_band,
      model_status: sample.status,
      suggested_decision: decisionHint(sample),
      overall_usefulness: sample.overall_usefulness,
      category_fit: score.category_fit ?? '',
      originality: score.originality ?? '',
      creative_signal: score.creative_signal ?? '',
      graph_value: score.graph_value ?? '',
      repost_risk: score.repost_risk ?? '',
      bio: account.bio ?? '',
      follower_count: account.follower_count ?? '',
      likes_count: account.likes_count ?? '',
      latest_video_url: videoUrls[0] ?? '',
      evidence_video_urls: compactList(videoUrls, 5),
      evidence_captions: compactList(captions, 5),
      evidence_hashtags: compactList(hashtags, 12),
      source_types: Array.from(new Set(sources.map((source) => source.source_type))).join('|'),
      source_queries: compactList(Array.from(new Set(sources.map((source) => source.source_query))), 5),
      review_reasons: sample.review_reasons,
      reviewer_decision: '',
      reviewer: '',
      reviewer_notes: '',
    }
  })

  const decisionTemplate = rows.map((row) => ({
    packet_id: row.packet_id,
    review_batch_id: row.review_batch_id,
    review_row_id: row.review_row_id,
    handle: row.handle,
    decision: '',
    reviewer: '',
    notes: '',
  }))
  const batches = []
  for (let index = 0; index < rows.length; index += Math.max(1, batchSize)) {
    const batchRows = rows.slice(index, index + Math.max(1, batchSize))
    const batchId = batchRows[0]?.review_batch_id ?? `review_batch_${String(batches.length + 1).padStart(4, '0')}`
    const batchTemplate = decisionTemplate.slice(index, index + Math.max(1, batchSize))
    const batchPacketCsv = `data/processed/review_packets/${packetId}-${batchId}.csv`
    const batchDecisionCsv = `data/processed/review_packets/${packetId}-${batchId}-decision-template.csv`
    writeCsv(join(reviewPacketDir, `${packetId}-${batchId}.csv`), batchRows)
    writeCsv(join(reviewPacketDir, `${packetId}-${batchId}-decision-template.csv`), batchTemplate)
    batches.push({
      packet_id: packetId,
      review_batch_id: batchId,
      sequence: batches.length + 1,
      rows: batchRows.length,
      packet_csv: batchPacketCsv,
      decision_template_csv: batchDecisionCsv,
      primary_labels: Array.from(new Set(batchRows.map((row) => row.primary_label).filter(Boolean))).join('|'),
      review_bands: Array.from(new Set(batchRows.map((row) => row.review_band).filter(Boolean))).join('|'),
    })
  }

  writeJsonl(join(reviewPacketDir, `${packetId}.jsonl`), rows)
  writeCsv(join(reviewPacketDir, `${packetId}.csv`), rows)
  writeCsv(join(reviewPacketDir, `${packetId}-decision-template.csv`), decisionTemplate)
  writeJsonl(join(reviewPacketDir, `${packetId}-batches.jsonl`), batches)
  writeJsonl(join(processedDir, 'review_packet_latest.jsonl'), rows)
  writeCsv(join(processedDir, 'review_packet_latest.csv'), rows)
  writeJsonl(join(processedDir, 'review_packet_batches.jsonl'), batches)
  writeCsv(join(processedDir, 'review_packet_batches.csv'), batches)

  const summary = {
    generated_at: new Date().toISOString(),
    packet_id: packetId,
    rows: rows.length,
    decision_template_rows: decisionTemplate.length,
    batch_size: batchSize,
    batches: batches.length,
    packet_csv: `data/processed/review_packets/${packetId}.csv`,
    decision_template_csv: `data/processed/review_packets/${packetId}-decision-template.csv`,
    batch_manifest_jsonl: `data/processed/review_packets/${packetId}-batches.jsonl`,
    band_counts: rows.reduce((acc, row) => {
      acc[row.review_band] = (acc[row.review_band] ?? 0) + 1
      return acc
    }, {}),
    suggested_decision_counts: rows.reduce((acc, row) => {
      acc[row.suggested_decision] = (acc[row.suggested_decision] ?? 0) + 1
      return acc
    }, {}),
  }

  writeJson(join(reportsDir, 'review-packet.json'), summary)
  writeFileSync(join(reportsDir, 'review-packet.md'), `# Review Packet

Generated: ${summary.generated_at}

- Packet id: ${summary.packet_id}
- Rows: ${summary.rows}
- Decision template rows: ${summary.decision_template_rows}
- Batch size: ${summary.batch_size}
- Batches: ${summary.batches}
- Packet CSV: \`${summary.packet_csv}\`
- Decision template CSV: \`${summary.decision_template_csv}\`
- Batch manifest: \`${summary.batch_manifest_jsonl}\`

## Batches

| Seq | Batch | Rows | Labels | Decision template |
| ---: | --- | ---: | --- | --- |
${batches.map((batch) => `| ${batch.sequence} | ${batch.review_batch_id} | ${batch.rows} | ${batch.primary_labels || 'none'} | \`${batch.decision_template_csv}\` |`).join('\n') || '| 0 | none | 0 | none | none |'}

## Review Bands

${Object.entries(summary.band_counts).map(([band, count]) => `- ${band}: ${count}`).join('\n') || '- None'}

## Suggested Decisions

${Object.entries(summary.suggested_decision_counts).map(([decision, count]) => `- ${decision}: ${count}`).join('\n') || '- None'}

Import completed decisions by placing a filled decision CSV in \`data/raw/review-decisions/\` and running \`node docs/experiments/tiktok-creative-creator-graph/scripts/apply-review-decisions.mjs\`.
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
