import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const packetsDir = join(generatedDir, 'source-acquisition-packets')
const packetsJsonPath = join(generatedDir, 'source-acquisition-packets.json')
const packetsMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_PACKETS.md')

const inputs = {
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  scaledPublicSuite: join(generatedDir, 'public-package/hard-grounded-research-scaled-public-suite.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function sourceRowsByDataset(scaledItems) {
  const byDataset = new Map()
  for (const item of scaledItems) {
    for (const example of item.source_examples || []) {
      if (!byDataset.has(example.source_dataset)) byDataset.set(example.source_dataset, new Set())
      byDataset.get(example.source_dataset).add(example.source_row_id)
    }
  }
  return byDataset
}

function packetFilename(batchId) {
  return `${batchId}.jsonl`
}

function buildPackets({ sourceAcquisitionManifest, scaledPublicSuite, releaseGate }) {
  const scaledItems = scaledPublicSuite.items || scaledPublicSuite
  const existingRows = sourceRowsByDataset(scaledItems)
  const packetSummaries = []
  let totalRows = 0

  mkdirSync(packetsDir, { recursive: true })

  for (const batch of sourceAcquisitionManifest.acquisition_batches) {
    const excludeSourceRowIds = [...(existingRows.get(batch.source_dataset) || new Set())].sort()
    const rows = Array.from({ length: batch.target_new_distinct_source_rows }, (_, index) => ({
      acquisition_id: `${batch.batch_id}_row_${String(index + 1).padStart(3, '0')}`,
      batch_id: batch.batch_id,
      category: batch.category,
      source_dataset: batch.source_dataset,
      hf_url: batch.hf_url,
      viewer: batch.viewer,
      row_slot: index + 1,
      package_policy: batch.package_policy,
      license: batch.license,
      selection_constraints: {
        must_be_new_distinct_source_row: true,
        exclude_source_row_ids: excludeSourceRowIds,
        prefer_rows_with_native_signals: batch.native_signals,
        construction_role: batch.construction_role,
      },
      required_next_steps: [
        'fetch_candidate_row_metadata',
        'materialize_hard_grounded_task_candidate',
        'deduplicate_against_existing_source_rows',
        'emit_review_workbook_rows',
        'complete_two_independent_reviews_before_gold',
      ],
      review_status: 'source_packet_ready_not_reviewed',
    }))
    const relativePath = `generated/source-acquisition-packets/${packetFilename(batch.batch_id)}`
    writeText(join(experimentDir, relativePath), `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
    totalRows += rows.length
    packetSummaries.push({
      batch_id: batch.batch_id,
      category: batch.category,
      source_dataset: batch.source_dataset,
      target_rows: rows.length,
      packet_path: relativePath,
      excluded_existing_source_rows: excludeSourceRowIds.length,
      package_policy: batch.package_policy,
    })
  }

  return {
    source_acquisition_packets_ready:
      packetSummaries.length === sourceAcquisitionManifest.summary.acquisition_batches &&
      totalRows === sourceAcquisitionManifest.summary.target_new_distinct_source_rows &&
      releaseGate.status !== 'release_ready',
    benchmark_id: sourceAcquisitionManifest.benchmark_id,
    generated_from: {
      source_acquisition_manifest: 'generated/source-acquisition-manifest.json',
      scaled_public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      packet_count: packetSummaries.length,
      target_new_distinct_source_rows: totalRows,
      source_datasets_covered: new Set(packetSummaries.map((packet) => packet.source_dataset)).size,
      categories_covered: new Set(packetSummaries.map((packet) => packet.category)).size,
      completion_claim_allowed: false,
    },
    packet_summaries: packetSummaries,
  }
}

function renderMarkdown(packets) {
  const rows = packets.packet_summaries.map((packet) => [
    packet.batch_id,
    packet.category,
    packet.source_dataset,
    String(packet.target_rows),
    packet.packet_path,
    String(packet.excluded_existing_source_rows),
    packet.package_policy,
  ])

  return `# Hard Grounded Research Source Acquisition Packets

This generated packet set turns the source acquisition manifest into executable JSONL queues. Each row is a target slot for a new distinct Hugging Face source row. These packets do not contain new upstream text and do not create reviewed gold labels.

## Summary

- Source acquisition packets ready: ${packets.source_acquisition_packets_ready}
- Packet count: ${packets.summary.packet_count}
- Target new distinct source rows: ${packets.summary.target_new_distinct_source_rows}
- Source datasets covered: ${packets.summary.source_datasets_covered}
- Categories covered: ${packets.summary.categories_covered}
- Completion claim allowed: ${packets.summary.completion_claim_allowed}

## Packets

${markdownTable(['Batch', 'Category', 'Dataset', 'Rows', 'Packet path', 'Excluded existing rows', 'Package policy'], rows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source acquisition packet input ${name}: ${path}`)
}

const packets = buildPackets({
  sourceAcquisitionManifest: readJson(inputs.sourceAcquisitionManifest),
  scaledPublicSuite: readJson(inputs.scaledPublicSuite),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(packetsJsonPath, packets)
writeText(packetsMarkdownPath, renderMarkdown(packets))
console.log(`Wrote hard grounded research source acquisition packets to ${packetsJsonPath}`)
console.log(`Wrote hard grounded research source acquisition packet report to ${packetsMarkdownPath}`)
