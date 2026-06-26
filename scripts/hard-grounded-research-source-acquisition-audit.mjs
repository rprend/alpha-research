import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'source-acquisition-audit.json')
const auditMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_AUDIT.md')

const inputs = {
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

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

function requiredStepsPresent(row) {
  const required = [
    'fetch_candidate_row_metadata',
    'materialize_hard_grounded_task_candidate',
    'deduplicate_against_existing_source_rows',
    'emit_review_workbook_rows',
    'complete_two_independent_reviews_before_gold',
  ]
  return required.every((step) => (row.required_next_steps || []).includes(step))
}

function auditPacket(summary, manifestBatch) {
  const path = join(experimentDir, summary.packet_path)
  const findings = []
  if (!existsSync(path)) {
    findings.push(`missing_packet_file:${summary.packet_path}`)
    return {
      batch_id: summary.batch_id,
      packet_path: summary.packet_path,
      row_count: 0,
      expected_rows: manifestBatch?.target_new_distinct_source_rows || summary.target_rows,
      finding_count: findings.length,
      findings,
    }
  }

  const rows = readJsonl(path)
  const rowSlots = rows.map((row) => row.row_slot)
  const expectedSlots = Array.from({ length: summary.target_rows }, (_, index) => index + 1)
  if (rows.length !== summary.target_rows) findings.push(`row_count_mismatch:${rows.length}/${summary.target_rows}`)
  if (manifestBatch && rows.length !== manifestBatch.target_new_distinct_source_rows) {
    findings.push(`manifest_row_count_mismatch:${rows.length}/${manifestBatch.target_new_distinct_source_rows}`)
  }
  if (JSON.stringify(rowSlots) !== JSON.stringify(expectedSlots)) findings.push('row_slots_not_sequential')

  for (const row of rows) {
    if (row.batch_id !== summary.batch_id) findings.push(`wrong_batch:${row.acquisition_id}`)
    if (row.category !== summary.category) findings.push(`wrong_category:${row.acquisition_id}`)
    if (row.source_dataset !== summary.source_dataset) findings.push(`wrong_dataset:${row.acquisition_id}`)
    if (!row.selection_constraints?.must_be_new_distinct_source_row) findings.push(`missing_distinct_constraint:${row.acquisition_id}`)
    if (!Array.isArray(row.selection_constraints?.exclude_source_row_ids)) findings.push(`missing_exclusion_list:${row.acquisition_id}`)
    if (!requiredStepsPresent(row)) findings.push(`missing_required_steps:${row.acquisition_id}`)
    if (row.review_status !== 'source_packet_ready_not_reviewed') findings.push(`wrong_review_status:${row.acquisition_id}`)
  }

  return {
    batch_id: summary.batch_id,
    packet_path: summary.packet_path,
    row_count: rows.length,
    expected_rows: summary.target_rows,
    finding_count: findings.length,
    findings: [...new Set(findings)].sort(),
  }
}

function buildAudit({ sourceAcquisitionManifest, sourceAcquisitionPackets, releaseGate }) {
  const manifestByBatch = new Map(
    sourceAcquisitionManifest.acquisition_batches.map((batch) => [batch.batch_id, batch]),
  )
  const packetAudits = sourceAcquisitionPackets.packet_summaries.map((summary) =>
    auditPacket(summary, manifestByBatch.get(summary.batch_id)),
  )
  const totalRows = packetAudits.reduce((sum, packet) => sum + packet.row_count, 0)
  const findingCount = packetAudits.reduce((sum, packet) => sum + packet.finding_count, 0)
  const missingManifestBatches = sourceAcquisitionManifest.acquisition_batches
    .filter((batch) => !sourceAcquisitionPackets.packet_summaries.some((packet) => packet.batch_id === batch.batch_id))
    .map((batch) => batch.batch_id)

  return {
    source_acquisition_audit_ready:
      findingCount === 0 &&
      missingManifestBatches.length === 0 &&
      totalRows === sourceAcquisitionManifest.summary.target_new_distinct_source_rows &&
      releaseGate.status !== 'release_ready',
    benchmark_id: sourceAcquisitionManifest.benchmark_id,
    generated_from: {
      source_acquisition_manifest: 'generated/source-acquisition-manifest.json',
      source_acquisition_packets: 'generated/source-acquisition-packets.json',
      packet_dir: 'generated/source-acquisition-packets/',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      packet_count: packetAudits.length,
      audited_rows: totalRows,
      expected_rows: sourceAcquisitionManifest.summary.target_new_distinct_source_rows,
      finding_count: findingCount,
      missing_manifest_batches: missingManifestBatches.length,
      completion_claim_allowed: false,
    },
    missing_manifest_batches: missingManifestBatches,
    packet_audits: packetAudits,
  }
}

function renderMarkdown(audit) {
  const rows = audit.packet_audits.map((packet) => [
    packet.batch_id,
    packet.packet_path,
    String(packet.row_count),
    String(packet.expected_rows),
    String(packet.finding_count),
    packet.findings.join('<br>') || 'none',
  ])

  return `# Hard Grounded Research Source Acquisition Audit

This generated audit validates the source-acquisition JSONL packets against the acquisition manifest. It checks row counts, packet paths, row-slot sequencing, exclusion constraints, required next steps, and review status. It does not fetch upstream rows or create gold labels.

## Summary

- Source acquisition audit ready: ${audit.source_acquisition_audit_ready}
- Packet count: ${audit.summary.packet_count}
- Audited rows: ${audit.summary.audited_rows}
- Expected rows: ${audit.summary.expected_rows}
- Finding count: ${audit.summary.finding_count}
- Missing manifest batches: ${audit.summary.missing_manifest_batches}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Packet Audits

${markdownTable(['Batch', 'Packet path', 'Rows', 'Expected', 'Findings', 'Finding detail'], rows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source acquisition audit input ${name}: ${path}`)
}

const audit = buildAudit({
  sourceAcquisitionManifest: readJson(inputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(inputs.sourceAcquisitionPackets),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))
console.log(`Wrote hard grounded research source acquisition audit to ${auditJsonPath}`)
console.log(`Wrote hard grounded research source acquisition audit report to ${auditMarkdownPath}`)
