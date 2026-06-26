import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const packetDir = join(generatedDir, 'source-acquisition-packets')
const fetchedJsonPath = join(generatedDir, 'source-acquisition-fetched-rows.json')
const fetchedJsonlPath = join(generatedDir, 'source-acquisition-fetched-rows.jsonl')
const fetchedMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_FETCHED_ROWS.md')

const inputs = {
  packets: join(generatedDir, 'source-acquisition-packets.json'),
  audit: join(generatedDir, 'source-acquisition-audit.json'),
}

const rowIdFields = ['id', 'paper_id', 'claim_id', 'q_id']
const previewFields = ['title', 'question', 'claim', 'abstract', 'selftext', 'answer']
const batchFetchLength = 100
const maxFetchPagesPerBatch = 40

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function datasetViewerUrl(packet, offset, length) {
  const params = new URLSearchParams({
    dataset: packet.source_dataset,
    config: packet.viewer.config,
    split: packet.viewer.split,
    offset: String(offset),
    length: String(length),
  })
  return `https://datasets-server.huggingface.co/rows?${params.toString()}`
}

function sourceRowId(row, rowIdx) {
  for (const field of rowIdFields) {
    if (row[field] !== undefined && row[field] !== null && String(row[field]).trim()) return String(row[field])
  }
  return `row_idx:${rowIdx}`
}

function flattenedText(value, limit = 600) {
  if (value === undefined || value === null) return ''
  if (typeof value === 'string') return value.replace(/\s+/g, ' ').trim().slice(0, limit)
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  if (Array.isArray(value)) return value.map((entry) => flattenedText(entry, 120)).filter(Boolean).join(' | ').slice(0, limit)
  if (typeof value === 'object') return Object.entries(value).slice(0, 8).map(([key, entry]) => `${key}: ${flattenedText(entry, 120)}`).join(' | ').slice(0, limit)
  return ''
}

function preview(row, packagePolicy) {
  if (packagePolicy !== 'redistributable_known_license_evidence') return null
  const parts = []
  for (const field of previewFields) {
    const text = flattenedText(row[field], 280)
    if (text) parts.push(`${field}: ${text}`)
  }
  return parts.join(' || ').slice(0, 700) || null
}

function rowMetadata(packet, rowEnvelope) {
  const row = rowEnvelope.row || {}
  const id = sourceRowId(row, rowEnvelope.row_idx)
  return {
    acquisition_id: packet.acquisition_id,
    batch_id: packet.batch_id,
    category: packet.category,
    source_dataset: packet.source_dataset,
    source_row_id: id,
    global_source_key: `${packet.source_dataset}:${id}`,
    viewer: packet.viewer,
    hf_row_idx: rowEnvelope.row_idx,
    package_policy: packet.package_policy,
    license: packet.license,
    pointer_only: packet.package_policy !== 'redistributable_known_license_evidence',
    field_keys: Object.keys(row).sort(),
    row_preview: preview(row, packet.package_policy),
    truncated_cells: rowEnvelope.truncated_cells || [],
    selection_constraints: packet.selection_constraints,
    review_status: 'fetched_not_materialized_not_reviewed',
    required_next_steps: [
      'deduplicate_against_existing_source_rows',
      'materialize_hard_grounded_task_candidate',
      'emit_review_workbook_rows',
      'complete_two_independent_reviews_before_gold',
    ],
  }
}

async function fetchRows(packet, offset) {
  const url = datasetViewerUrl(packet, offset, batchFetchLength)
  const response = await fetch(url)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HF rows request failed ${response.status} for ${url}: ${body.slice(0, 500)}`)
  }
  return response.json()
}

async function acquireBatch(packetRows, globalSeen) {
  const first = packetRows[0]
  const excluded = new Set(first.selection_constraints.exclude_source_row_ids.map(String))
  const selected = []
  const batchSeen = new Set()
  const findings = []
  let offset = 0
  let pagesFetched = 0

  while (selected.length < packetRows.length && pagesFetched < maxFetchPagesPerBatch) {
    const page = await fetchRows(first, offset)
    pagesFetched += 1
    for (const rowEnvelope of page.rows || []) {
      const candidateId = sourceRowId(rowEnvelope.row || {}, rowEnvelope.row_idx)
      const globalKey = `${first.source_dataset}:${candidateId}`
      if (excluded.has(candidateId)) continue
      if (batchSeen.has(candidateId)) continue
      if (globalSeen.has(globalKey)) continue
      const packet = packetRows[selected.length]
      selected.push(rowMetadata(packet, rowEnvelope))
      batchSeen.add(candidateId)
      globalSeen.add(globalKey)
      if (selected.length === packetRows.length) break
    }
    if (!page.rows || page.rows.length < batchFetchLength) break
    offset += batchFetchLength
  }

  if (selected.length !== packetRows.length) {
    findings.push(`batch_underfilled:${first.batch_id}:${selected.length}/${packetRows.length}`)
  }

  return {
    batch_id: first.batch_id,
    category: first.category,
    source_dataset: first.source_dataset,
    requested_rows: packetRows.length,
    fetched_rows: selected.length,
    pages_fetched: pagesFetched,
    findings,
    rows: selected,
  }
}

async function buildFetchedRows({ packets, audit }) {
  assert(audit.source_acquisition_audit_ready, 'Source acquisition audit must pass before fetching rows.')
  const packetRows = packets.packet_summaries.flatMap((packet) => readJsonl(join(experimentDir, packet.packet_path)))
  const byBatch = new Map()
  for (const packet of packetRows) {
    if (!byBatch.has(packet.batch_id)) byBatch.set(packet.batch_id, [])
    byBatch.get(packet.batch_id).push(packet)
  }

  const globalSeen = new Set()
  const batchResults = []
  for (const rows of byBatch.values()) {
    batchResults.push(await acquireBatch(rows, globalSeen))
  }

  const acquiredRows = batchResults.flatMap((batch) => batch.rows)
  const findings = batchResults.flatMap((batch) => batch.findings)
  const knownLicenseRows = acquiredRows.filter((row) => !row.pointer_only).length
  const pointerOnlyRows = acquiredRows.filter((row) => row.pointer_only).length

  return {
    source_acquisition_fetch_report_ready:
      acquiredRows.length > 0 &&
      batchResults.length === packets.summary.packet_count &&
      new Set(acquiredRows.map((row) => row.global_source_key)).size === acquiredRows.length,
    source_acquisition_fetch_ready:
      findings.length === 0 &&
      acquiredRows.length === packets.summary.target_new_distinct_source_rows &&
      new Set(acquiredRows.map((row) => row.global_source_key)).size === acquiredRows.length,
    benchmark_id: 'hard-grounded-research-benchmark',
    generated_from: {
      source_acquisition_packets: 'generated/source-acquisition-packets.json',
      source_acquisition_audit: 'generated/source-acquisition-audit.json',
      packet_dir: 'generated/source-acquisition-packets/',
      hf_dataset_viewer: 'https://datasets-server.huggingface.co/rows',
    },
    summary: {
      requested_rows: packets.summary.target_new_distinct_source_rows,
      fetched_rows: acquiredRows.length,
      distinct_source_rows: new Set(acquiredRows.map((row) => row.global_source_key)).size,
      acquisition_batches: batchResults.length,
      known_license_rows: knownLicenseRows,
      pointer_only_rows: pointerOnlyRows,
      finding_count: findings.length,
      completion_claim_allowed: false,
    },
    findings,
    batch_results: batchResults.map(({ rows, ...batch }) => batch),
    rows: acquiredRows,
  }
}

function renderMarkdown(result) {
  const batchRows = result.batch_results.map((batch) => [
    batch.batch_id,
    batch.category,
    batch.source_dataset,
    `${batch.fetched_rows}/${batch.requested_rows}`,
    String(batch.pages_fetched),
    batch.findings.length ? batch.findings.join('<br>') : 'none',
  ])
  const datasetCounts = new Map()
  for (const row of result.rows) {
    datasetCounts.set(row.source_dataset, (datasetCounts.get(row.source_dataset) || 0) + 1)
  }
  const datasetRows = [...datasetCounts.entries()].sort().map(([dataset, count]) => [dataset, String(count)])

  return `# Source Acquisition Fetched Rows

This generated artifact executes the source acquisition packet queue against the Hugging Face dataset viewer. It records source-row metadata and stable row IDs for future task materialization; it does not create gold labels or paper-ready reviewed items.

## Summary

- Source acquisition fetch ready: ${result.source_acquisition_fetch_ready}
- Source acquisition fetch report ready: ${result.source_acquisition_fetch_report_ready}
- Requested rows: ${result.summary.requested_rows}
- Fetched rows: ${result.summary.fetched_rows}
- Distinct source rows: ${result.summary.distinct_source_rows}
- Known-license rows with previews: ${result.summary.known_license_rows}
- Pointer-only rows: ${result.summary.pointer_only_rows}
- Findings: ${result.summary.finding_count}
- Completion claim allowed: ${result.summary.completion_claim_allowed}

## Dataset Counts

${markdownTable(['Dataset', 'Fetched rows'], datasetRows)}

## Batch Results

${markdownTable(['Batch', 'Category', 'Dataset', 'Fetched/requested', 'Pages fetched', 'Findings'], batchRows)}

## Packaging Rule

Rows from \`redistributable_known_license_evidence\` packets include a short row preview. Rows from \`pointer_only_until_license_clearance\` packets store only row IDs, field keys, offsets, and metadata so this generated artifact does not redistribute unknown-license source text.

## Next Required Work

1. Deduplicate fetched rows against existing benchmark source rows.
2. Materialize hard-grounded task candidates from fetched rows.
3. Export candidate rows into reviewer workbooks.
4. Complete two independent reviews and adjudication before gold promotion.
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source acquisition fetch input ${name}: ${path}`)
}
assert(existsSync(packetDir), `Missing source acquisition packet directory: ${packetDir}`)

const result = await buildFetchedRows({
  packets: readJson(inputs.packets),
  audit: readJson(inputs.audit),
})

writeJson(fetchedJsonPath, result)
writeText(fetchedJsonlPath, result.rows.map((row) => JSON.stringify(row)).join('\n') + '\n')
writeText(fetchedMarkdownPath, renderMarkdown(result))

console.log(`Wrote hard grounded fetched source rows to ${fetchedJsonPath}`)
console.log(`Wrote hard grounded fetched source rows JSONL to ${fetchedJsonlPath}`)
console.log(`Wrote hard grounded fetched source rows report to ${fetchedMarkdownPath}`)
