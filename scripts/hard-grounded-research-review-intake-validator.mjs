import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-intake-validator.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_INTAKE_VALIDATOR.md')

const inputs = {
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
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

function buildValidator({ reviewDropoffManifest, reviewReturnPreflight, annotationImport }) {
  const preflightByFile = new Map(
    reviewReturnPreflight.expected_files.map((file) => [file.expected_return_file, file]),
  )
  const importFindingCount = annotationImport.finding_count ?? annotationImport.findings?.length ?? 0
  const intakeRows = reviewDropoffManifest.packets.map((packet) => {
    const preflight = preflightByFile.get(packet.expected_return_file)
    const present = Boolean(preflight?.present)
    const acceptanceChecks = [
      {
        id: 'source_export_hash_bound',
        passed: Boolean(packet.export_sha256),
        detail: packet.export_sha256 ? packet.export_sha256.slice(0, 16) : 'missing source export hash',
      },
      {
        id: 'return_file_present',
        passed: present,
        detail: present ? preflight.returned_sha256?.slice(0, 16) || 'present' : 'missing return file',
      },
      {
        id: 'row_count_matches_export',
        passed: present && preflight.expected_rows === packet.expected_rows,
        detail: `${preflight?.expected_rows ?? 'missing'}/${packet.expected_rows} rows`,
      },
      {
        id: 'immutable_fields_preserved_by_import_dry_run',
        passed: present && annotationImport.annotation_import_ready === true && importFindingCount === 0,
        detail: present
          ? `import_ready=${annotationImport.annotation_import_ready}; findings=${importFindingCount}`
          : 'blocked until return file exists',
      },
    ]
    return {
      expected_return_file: packet.expected_return_file,
      scope: packet.scope,
      category: packet.category,
      reviewer_slot: packet.reviewer_slot,
      expected_rows: packet.expected_rows,
      export_sha256: packet.export_sha256,
      returned_sha256: preflight?.returned_sha256 || null,
      status: acceptanceChecks.every((check) => check.passed) ? 'accepted_for_apply' : 'blocked_before_apply',
      present,
      acceptance_checks: acceptanceChecks,
    }
  })
  const acceptedRows = intakeRows.filter((row) => row.status === 'accepted_for_apply')
  const blockedRows = intakeRows.filter((row) => row.status !== 'accepted_for_apply')
  const checks = [
    {
      id: 'dropoff_manifest_loaded',
      passed: reviewDropoffManifest.review_dropoff_manifest_ready === true,
      detail: `${reviewDropoffManifest.summary.packets} dropoff packets`,
    },
    {
      id: 'return_preflight_loaded',
      passed: reviewReturnPreflight.review_return_preflight_ready === true,
      detail: `${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files} returned files present`,
    },
    {
      id: 'all_packets_have_intake_rows',
      passed: intakeRows.length === reviewDropoffManifest.summary.packets,
      detail: `${intakeRows.length}/${reviewDropoffManifest.summary.packets} intake rows`,
    },
    {
      id: 'apply_blocked_until_clean_dry_run',
      passed: blockedRows.length > 0 || annotationImport.annotation_import_ready === true,
      detail: `${acceptedRows.length} accepted; ${blockedRows.length} blocked; import_ready=${annotationImport.annotation_import_ready}`,
    },
    {
      id: 'completion_still_blocked',
      passed: reviewDropoffManifest.summary.completion_claim_allowed === false,
      detail: `completion_claim_allowed=${reviewDropoffManifest.summary.completion_claim_allowed}`,
    },
  ]
  return {
    review_intake_validator_ready: checks.every((check) => check.passed),
    version: 'review-intake-validator-v1',
    completion_claim_allowed: false,
    generated_from: {
      review_dropoff_manifest: 'generated/review-dropoff-manifest.json',
      review_return_preflight: 'generated/review-return-preflight.json',
      annotation_import: 'generated/annotation-import/report.json',
    },
    commands: {
      refresh_dropoff_manifest: reviewDropoffManifest.commands.refresh_manifest,
      dry_run_import: reviewDropoffManifest.commands.dry_run,
      apply_after_all_packets_accepted: reviewDropoffManifest.commands.apply_after_clean_dry_run,
      refresh_intake_validator: 'node scripts/hard-grounded-research-review-intake-validator.mjs',
    },
    checks,
    intake_rows: intakeRows,
    summary: {
      packets: intakeRows.length,
      accepted_packets: acceptedRows.length,
      blocked_packets: blockedRows.length,
      present_return_files: reviewReturnPreflight.summary.present_return_files,
      missing_return_files: reviewReturnPreflight.summary.missing_return_files,
      latest_import_ready: Boolean(annotationImport.annotation_import_ready),
      latest_import_findings: importFindingCount,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const checkRows = report.checks.map((check) => [check.id, String(check.passed), check.detail])
  const intakeRows = report.intake_rows.map((row) => [
    row.expected_return_file,
    row.scope,
    row.category,
    row.reviewer_slot,
    String(row.expected_rows),
    String(row.present),
    row.status,
  ])

  return `# Hard Grounded Research Review Intake Validator

This generated validator defines the packet-level acceptance decision before reviewer returns can be applied. It does not contain returned labels and does not clear review, merge, gold, scale, or completion gates.

## Summary

- Intake validator ready: ${report.review_intake_validator_ready}
- Version: ${report.version}
- Packets: ${report.summary.packets}
- Accepted packets: ${report.summary.accepted_packets}
- Blocked packets: ${report.summary.blocked_packets}
- Present return files: ${report.summary.present_return_files}
- Missing return files: ${report.summary.missing_return_files}
- Latest import ready: ${report.summary.latest_import_ready}
- Latest import findings: ${report.summary.latest_import_findings}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Commands

- Refresh dropoff manifest: \`${report.commands.refresh_dropoff_manifest}\`
- Dry-run import: \`${report.commands.dry_run_import}\`
- Apply after all packets accepted: \`${report.commands.apply_after_all_packets_accepted}\`
- Refresh intake validator: \`${report.commands.refresh_intake_validator}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Intake Rows

${markdownTable(['Return file', 'Scope', 'Category', 'Reviewer', 'Rows', 'Present', 'Status'], intakeRows)}
`
}

const report = buildValidator({
  reviewDropoffManifest: readJson(inputs.reviewDropoffManifest),
  reviewReturnPreflight: readJson(inputs.reviewReturnPreflight),
  annotationImport: readJson(inputs.annotationImport),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded review intake validator to ${reportJsonPath}`)
console.log(`Wrote hard grounded review intake validator report to ${reportMarkdownPath}`)
