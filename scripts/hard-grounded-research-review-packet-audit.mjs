import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const auditJsonPath = join(generatedDir, 'review-packet-audit.json')
const auditMarkdownPath = join(experimentDir, 'REVIEW_PACKET_AUDIT.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
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

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function hasSameValues(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value))
}

function countBy(values) {
  const counts = {}
  for (const value of values) counts[value] = (counts[value] || 0) + 1
  return counts
}

function fileRows(manifestFile) {
  const relative = manifestFile.file
  const path = join(experimentDir, relative)
  if (!existsSync(path)) {
    return { path, rows: [], findings: [`missing export file ${relative}`] }
  }
  const rows = readJsonl(path)
  const digest = sha256File(path)
  const findings = []
  if (digest !== manifestFile.sha256) findings.push(`${relative} SHA-256 does not match manifest`)
  if (rows.length !== manifestFile.row_count) findings.push(`${relative} row count ${rows.length} does not match manifest ${manifestFile.row_count}`)
  return { path, rows, findings }
}

function inspectManifestFile({ manifestFile, protocol }) {
  const { rows, findings } = fileRows(manifestFile)
  const requiredFields = protocol.required_reviewer_fields || []
  const itemIds = new Set()
  let mutableOnlyRows = 0
  let rowsWithEvidence = 0
  let rowsWithRequiredReviewerFields = 0

  for (const [index, row] of rows.entries()) {
    const rowPath = `${manifestFile.file}:${index + 1}`
    itemIds.add(row.item_id)
    if (row.export_scope !== manifestFile.scope) findings.push(`${rowPath} export_scope ${row.export_scope} does not match manifest ${manifestFile.scope}`)
    if (row.source_workbook_id !== manifestFile.workbook_id) findings.push(`${rowPath} source_workbook_id ${row.source_workbook_id} does not match manifest ${manifestFile.workbook_id}`)
    if (row.reviewer_slot !== manifestFile.reviewer_slot) findings.push(`${rowPath} reviewer_slot ${row.reviewer_slot} does not match manifest ${manifestFile.reviewer_slot}`)
    if (row.category !== manifestFile.category) findings.push(`${rowPath} category ${row.category} does not match manifest ${manifestFile.category}`)
    if (!Array.isArray(row.evidence_units) || row.evidence_units.length === 0) findings.push(`${rowPath} has no evidence units`)
    else rowsWithEvidence += 1
    if (!row.reviewer_fields || typeof row.reviewer_fields !== 'object') {
      findings.push(`${rowPath} is missing reviewer_fields object`)
    } else {
      const reviewerKeys = Object.keys(row.reviewer_fields)
      if (requiredFields.every((field) => reviewerKeys.includes(field))) rowsWithRequiredReviewerFields += 1
      else findings.push(`${rowPath} reviewer_fields missing one or more required fields`)
      if (manifestFile.scope === 'pilot_review' && (reviewerKeys.includes('category_fit') || reviewerKeys.includes('generation_defect'))) {
        findings.push(`${rowPath} pilot row includes expansion-only reviewer fields`)
      }
      mutableOnlyRows += 1
    }
  }

  return {
    file: manifestFile.file,
    scope: manifestFile.scope,
    category: manifestFile.category,
    reviewer_slot: manifestFile.reviewer_slot,
    row_count: rows.length,
    unique_items: itemIds.size,
    rows_with_evidence: rowsWithEvidence,
    rows_with_required_reviewer_fields: rowsWithRequiredReviewerFields,
    reviewer_fields_only: mutableOnlyRows === rows.length,
    finding_count: findings.length,
    findings,
  }
}

function buildAudit({ spec, annotationExport, annotationImportSmoke, annotationProtocol, reviewProgress, reviewExecutionPlan }) {
  const fileReports = annotationExport.files.map((manifestFile) =>
    inspectManifestFile({ manifestFile, protocol: annotationProtocol })
  )
  const findings = []
  const requiredFields = annotationProtocol.required_reviewer_fields || []
  const exportRequiredFields = annotationExport.import_contract?.required_fields || []
  const categories = spec.categories.map((category) =>
    typeof category === 'string' ? category : category.name
  )
  const scopeCategoryCounts = {
    pilot_review: countBy(annotationExport.files.filter((file) => file.scope === 'pilot_review').map((file) => file.category)),
    expansion_review: countBy(annotationExport.files.filter((file) => file.scope === 'expansion_review').map((file) => file.category)),
  }

  if (!annotationExport.export_ready) findings.push('annotation export is not ready')
  if (!annotationExport.return_readiness?.ready) findings.push('annotation export return readiness is not ready')
  if (!annotationExport.reviewer_fields_only) findings.push('annotation export is not marked reviewer-fields-only')
  if (!annotationImportSmoke.smoke_ready && !annotationImportSmoke.annotation_import_smoke_ready) findings.push('annotation import smoke is not ready')
  if (!hasSameValues(requiredFields, exportRequiredFields)) findings.push('export required fields do not match annotation protocol')
  if (annotationExport.return_readiness?.expected_files !== annotationExport.totals?.file_count) findings.push('return expected file count does not match export file count')
  if (annotationExport.return_readiness?.expected_rows !== annotationExport.totals?.row_count) findings.push('return expected row count does not match export row count')
  if (reviewProgress.summary?.first_wave_export_rows !== annotationExport.totals?.row_count) findings.push('review progress first-wave rows do not match annotation export rows')
  if (reviewProgress.summary?.first_wave_export_files !== annotationExport.totals?.file_count) findings.push('review progress first-wave files do not match annotation export files')
  if (!reviewExecutionPlan.review_execution_plan_ready) findings.push('review execution plan is not ready')

  for (const category of categories) {
    if (!scopeCategoryCounts.expansion_review[category]) findings.push(`expansion first wave does not cover category ${category}`)
  }
  for (const report of fileReports) {
    findings.push(...report.findings)
  }

  const pilotFiles = fileReports.filter((file) => file.scope === 'pilot_review')
  const expansionFiles = fileReports.filter((file) => file.scope === 'expansion_review')
  const itemIds = new Set(annotationExport.files.flatMap((file) => file.item_ids || []))

  return {
    review_packet_audit_ready: findings.length === 0,
    version: 'review-packet-audit-v1',
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      annotation_import_smoke: 'generated/annotation-import-smoke/report.json',
      annotation_protocol: 'generated/annotation-protocol.json',
      review_progress: 'generated/review-progress.json',
      review_execution_plan: 'generated/review-execution-plan.json',
    },
    packet_contract: {
      required_reviewer_fields: requiredFields,
      editable_path: annotationExport.import_contract?.editable_path,
      reviewer_must_not_edit: annotationExport.import_contract?.reviewer_must_not_edit || [],
      return_expected_files: annotationExport.return_readiness?.expected_files,
      return_expected_rows: annotationExport.return_readiness?.expected_rows,
    },
    scope_coverage: {
      pilot_review: scopeCategoryCounts.pilot_review,
      expansion_review: scopeCategoryCounts.expansion_review,
    },
    file_reports: fileReports,
    findings,
    summary: {
      files_checked: fileReports.length,
      rows_checked: fileReports.reduce((sum, file) => sum + file.row_count, 0),
      unique_items_checked: itemIds.size,
      pilot_files: pilotFiles.length,
      pilot_rows: pilotFiles.reduce((sum, file) => sum + file.row_count, 0),
      expansion_files: expansionFiles.length,
      expansion_rows: expansionFiles.reduce((sum, file) => sum + file.row_count, 0),
      categories_with_expansion_first_wave: Object.keys(scopeCategoryCounts.expansion_review).length,
      required_reviewer_fields: requiredFields.length,
      finding_count: findings.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(audit) {
  const scopeRows = Object.entries(audit.scope_coverage).flatMap(([scope, counts]) =>
    Object.entries(counts).map(([category, files]) => [scope, category, String(files)])
  )
  const fileRowsForMarkdown = audit.file_reports.map((file) => [
    file.file,
    file.scope,
    file.category,
    file.reviewer_slot,
    String(file.row_count),
    file.finding_count ? String(file.finding_count) : '0',
  ])
  const findingRows = audit.findings.map((finding) => ['finding', finding])

  return `# Hard Grounded Research Review Packet Audit

This generated audit verifies that the first-wave reviewer packet is internally consistent, returnable through the annotation import path, and covered by the current review execution plan. It does not complete human review or clear gold, merge, scale, or novelty blockers.

## Summary

- Review packet audit ready: ${audit.review_packet_audit_ready}
- Version: ${audit.version}
- Files checked: ${audit.summary.files_checked}
- Rows checked: ${audit.summary.rows_checked}
- Unique items checked: ${audit.summary.unique_items_checked}
- Pilot files/rows: ${audit.summary.pilot_files}/${audit.summary.pilot_rows}
- Expansion files/rows: ${audit.summary.expansion_files}/${audit.summary.expansion_rows}
- Expansion categories covered in first wave: ${audit.summary.categories_with_expansion_first_wave}
- Required reviewer fields: ${audit.summary.required_reviewer_fields}
- Findings: ${audit.summary.finding_count}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Packet Contract

- Editable path: \`${audit.packet_contract.editable_path}\`
- Required reviewer fields: ${audit.packet_contract.required_reviewer_fields.join(', ')}
- Expected return files/rows: ${audit.packet_contract.return_expected_files}/${audit.packet_contract.return_expected_rows}

## Scope Coverage

${markdownTable(['Scope', 'Category', 'Files'], scopeRows)}

## Export Files

${markdownTable(['File', 'Scope', 'Category', 'Reviewer', 'Rows', 'Findings'], fileRowsForMarkdown)}

## Findings

${findingRows.length ? markdownTable(['Type', 'Finding'], findingRows) : 'No review packet audit findings.'}
`
}

const audit = buildAudit({
  spec: readJson(inputs.spec),
  annotationExport: readJson(inputs.annotationExport),
  annotationImportSmoke: readJson(inputs.annotationImportSmoke),
  annotationProtocol: readJson(inputs.annotationProtocol),
  reviewProgress: readJson(inputs.reviewProgress),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
})

writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))
