import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-dropoff-manifest.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_DROPOFF_MANIFEST.md')

const inputs = {
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
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

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function buildManifest({ reviewWaveSchedule, reviewReturnContract, annotationExport }) {
  const contractByReturn = new Map(reviewReturnContract.expected_files.map((file) => [file.expected_return_file, file]))
  const exportByFile = new Map(annotationExport.files.map((file) => [file.file, file]))
  const packets = reviewWaveSchedule.packets.map((packet) => {
    const contract = contractByReturn.get(packet.expected_return_file)
    const exported = exportByFile.get(packet.export_file)
    const exportPath = join(experimentDir, packet.export_file.replace(/^docs\/experiments\/hard-grounded-research-benchmark\//, ''))
    return {
      expected_return_file: packet.expected_return_file,
      dropoff_path: join(reviewReturnContract.return_contract.input_dir, packet.expected_return_file),
      export_file: packet.export_file,
      export_sha256: existsSync(exportPath) ? sha256(exportPath) : null,
      export_rows: exported?.row_count || contract?.expected_rows || packet.expected_rows,
      scope: packet.scope,
      category: packet.category,
      reviewer_slot: packet.reviewer_slot,
      priority: packet.priority,
      expected_rows: packet.expected_rows,
      required_reviewer_fields: contract?.required_reviewer_fields || reviewReturnContract.return_contract.required_reviewer_fields,
      expansion_required_fields: contract?.expansion_required_fields || [],
      reviewer_must_not_edit: reviewReturnContract.return_contract.reviewer_must_not_edit,
      acceptance_criteria: packet.acceptance_criteria,
      status: packet.status,
    }
  })
  const checks = [
    {
      id: 'schedule_loaded',
      passed: reviewWaveSchedule.review_wave_schedule_ready === true,
      detail: `${reviewWaveSchedule.summary.packets} scheduled packets`,
    },
    {
      id: 'contract_loaded',
      passed: reviewReturnContract.review_return_contract_ready === true,
      detail: `${reviewReturnContract.summary.expected_return_files} contract files`,
    },
    {
      id: 'all_packets_have_hashes',
      passed: packets.every((packet) => packet.export_sha256),
      detail: `${packets.filter((packet) => packet.export_sha256).length}/${packets.length} export files hashed`,
    },
    {
      id: 'dropoff_paths_match_contract',
      passed: packets.every((packet) => packet.dropoff_path.startsWith(reviewReturnContract.return_contract.input_dir)),
      detail: reviewReturnContract.return_contract.input_dir,
    },
    {
      id: 'completion_still_blocked',
      passed: reviewWaveSchedule.summary.completion_claim_allowed === false,
      detail: `completion_claim_allowed=${reviewWaveSchedule.summary.completion_claim_allowed}`,
    },
  ]
  return {
    review_dropoff_manifest_ready: checks.every((check) => check.passed),
    version: 'review-dropoff-manifest-v1',
    completion_claim_allowed: false,
    generated_from: {
      review_wave_schedule: 'generated/review-wave-schedule.json',
      review_return_contract: 'generated/review-return-contract.json',
      annotation_export: 'generated/annotation-export/manifest.json',
    },
    commands: {
      dry_run: reviewReturnContract.return_contract.dry_run_command,
      apply_after_clean_dry_run: reviewReturnContract.return_contract.apply_command,
      refresh_manifest: 'node scripts/hard-grounded-research-review-dropoff-manifest.mjs',
    },
    checks,
    packets,
    summary: {
      packets: packets.length,
      export_hashes: packets.filter((packet) => packet.export_sha256).length,
      expected_rows: packets.reduce((sum, packet) => sum + packet.expected_rows, 0),
      pilot_packets: packets.filter((packet) => packet.scope === 'pilot_review').length,
      expansion_packets: packets.filter((packet) => packet.scope === 'expansion_review').length,
      scheduled_missing_packets: packets.filter((packet) => packet.status === 'scheduled_for_collection').length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(manifest) {
  const checkRows = manifest.checks.map((check) => [check.id, String(check.passed), check.detail])
  const packetRows = manifest.packets.map((packet) => [
    packet.expected_return_file,
    packet.priority,
    packet.scope,
    packet.category,
    packet.reviewer_slot,
    String(packet.expected_rows),
    packet.export_sha256 ? packet.export_sha256.slice(0, 12) : 'missing',
  ])
  return `# Hard Grounded Research Review Dropoff Manifest

This generated manifest defines exactly what reviewers should return and how maintainers validate each drop-off before import. It does not contain returned labels and does not clear review, merge, gold, scale, or completion gates.

## Summary

- Manifest ready: ${manifest.review_dropoff_manifest_ready}
- Version: ${manifest.version}
- Packets: ${manifest.summary.packets}
- Export hashes: ${manifest.summary.export_hashes}
- Expected rows: ${manifest.summary.expected_rows}
- Pilot packets: ${manifest.summary.pilot_packets}
- Expansion packets: ${manifest.summary.expansion_packets}
- Scheduled missing packets: ${manifest.summary.scheduled_missing_packets}
- Completion claim allowed: ${manifest.summary.completion_claim_allowed}

## Commands

- Dry run: \`${manifest.commands.dry_run}\`
- Apply after clean dry run: \`${manifest.commands.apply_after_clean_dry_run}\`
- Refresh manifest: \`${manifest.commands.refresh_manifest}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Dropoff Packets

${markdownTable(['Return file', 'Priority', 'Scope', 'Category', 'Reviewer', 'Rows', 'Export sha256'], packetRows)}
`
}

const manifest = buildManifest({
  reviewWaveSchedule: readJson(inputs.reviewWaveSchedule),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  annotationExport: readJson(inputs.annotationExport),
})

writeJson(reportJsonPath, manifest)
writeText(reportMarkdownPath, renderMarkdown(manifest))

console.log(`Wrote hard grounded review dropoff manifest to ${reportJsonPath}`)
console.log(`Wrote hard grounded review dropoff manifest report to ${reportMarkdownPath}`)
