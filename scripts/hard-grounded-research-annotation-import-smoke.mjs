import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const exportManifestPath = join(generatedDir, 'annotation-export/manifest.json')
const smokeDir = join(generatedDir, 'annotation-import-smoke')
const smokeJsonPath = join(smokeDir, 'report.json')
const smokeMarkdownPath = join(experimentDir, 'ANNOTATION_IMPORT_SMOKE.md')

const immutableFields = [
  'export_scope',
  'source_workbook_id',
  'batch_id',
  'reviewer_slot',
  'item_id',
  'category',
  'challenge_type',
  'review_priority',
  'quality_findings',
  'question',
  'candidate_answer',
  'required_dimensions',
  'rubric',
  'evidence_units',
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fileDigest(path) {
  return sha256(readFileSync(path))
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function stableJson(value) {
  return JSON.stringify(value)
}

function smokeReviewerFields(row) {
  const citationIds = row.evidence_units?.slice(0, 1).map((unit) => unit.id) || []
  const fields = {
    final_label: citationIds.length ? 'SUPPORTED' : 'INSUFFICIENT',
    final_answer: row.candidate_answer || 'ABSTAIN',
    required_citation_ids: citationIds,
    insufficient_or_conflicting_evidence: citationIds.length === 0,
    notes: 'Fixture import-smoke row; not a human annotation and not eligible for gold promotion.',
    reviewer_confidence: 'low',
  }
  if (row.export_scope === 'expansion_review') {
    fields.category_fit = 'fits_category'
    fields.generation_defect = 'none_detected'
  }
  return fields
}

function validateReturnedRows(originalRows, returnedRows, requiredFields) {
  assert(originalRows.length === returnedRows.length, `Row count changed: ${originalRows.length} -> ${returnedRows.length}`)
  const findings = []
  for (let index = 0; index < originalRows.length; index += 1) {
    const original = originalRows[index]
    const returned = returnedRows[index]
    assert(original.item_id === returned.item_id, `Row order or item id changed at row ${index}: ${original.item_id} -> ${returned.item_id}`)
    for (const field of immutableFields) {
      if (stableJson(original[field]) !== stableJson(returned[field])) {
        findings.push({
          item_id: original.item_id,
          code: 'immutable_field_changed',
          field,
        })
      }
    }
    const returnedFields = returned.reviewer_fields || {}
    for (const field of requiredFields) {
      if (!(field in returnedFields) || returnedFields[field] === '' || returnedFields[field] === null) {
        findings.push({
          item_id: original.item_id,
          code: 'missing_required_reviewer_field',
          field,
        })
      }
    }
  }
  return findings
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function buildSmoke() {
  const manifest = readJson(exportManifestPath)
  const fileReports = []
  let rowsChecked = 0
  let findingCount = 0

  for (const file of manifest.files) {
    const originalPath = join(experimentDir, file.file.replace(/^generated\//, 'generated/'))
    assert(existsSync(originalPath), `Missing export file: ${originalPath}`)
    assert(fileDigest(originalPath) === file.sha256, `Export checksum mismatch for ${file.file}`)
    const originalRows = readJsonl(originalPath)
    const returnedRows = originalRows.map((row) => ({
      ...row,
      reviewer_fields: smokeReviewerFields(row),
    }))
    const findings = validateReturnedRows(originalRows, returnedRows, manifest.import_contract.required_fields)
    const returnedPath = join(smokeDir, `${basename(file.file, '.jsonl')}.returned-fixture.jsonl`)
    writeJsonl(returnedPath, returnedRows)

    rowsChecked += originalRows.length
    findingCount += findings.length
    fileReports.push({
      source_file: file.file,
      returned_fixture_file: `generated/annotation-import-smoke/${basename(returnedPath)}`,
      workbook_id: file.workbook_id,
      scope: file.scope,
      row_count: originalRows.length,
      source_sha256: file.sha256,
      returned_sha256: fileDigest(returnedPath),
      findings,
    })
  }

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    smoke_id: 'annotation-import-smoke-2026-06-26',
    source_manifest: 'generated/annotation-export/manifest.json',
    annotation_import_smoke_ready: findingCount === 0,
    fixture_not_human_review: true,
    reviewer_fields_only_enforced: true,
    rows_checked: rowsChecked,
    files_checked: fileReports.length,
    finding_count: findingCount,
    immutable_fields_checked: immutableFields,
    required_reviewer_fields: manifest.import_contract.required_fields,
    files: fileReports,
  }
}

function renderMarkdown(report) {
  const summaryRows = [
    ['Smoke ready', String(report.annotation_import_smoke_ready)],
    ['Fixture not human review', String(report.fixture_not_human_review)],
    ['Files checked', String(report.files_checked)],
    ['Rows checked', String(report.rows_checked)],
    ['Findings', String(report.finding_count)],
    ['Reviewer fields only enforced', String(report.reviewer_fields_only_enforced)],
  ]
  const fileRows = report.files.map((file) => [
    file.source_file,
    file.scope,
    String(file.row_count),
    file.returned_sha256.slice(0, 16),
    String(file.findings.length),
  ])

  return `# Hard Grounded Research Annotation Import Smoke

This generated smoke test proves the exported annotation packet can be returned with only \`reviewer_fields\` changed. It writes fixture returned rows for contract testing only; these rows are not human review and must not count toward gold promotion.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Contract

- Source export checksums must match the export manifest before fixture rows are generated.
- Immutable benchmark fields must remain byte-stable after a returned review packet is parsed.
- Every returned row must contain the required reviewer fields.
- Fixture rows are explicitly non-human annotations.

## Files

${markdownTable(['Source file', 'Scope', 'Rows', 'Returned SHA-256 prefix', 'Findings'], fileRows)}
`
}

if (!existsSync(exportManifestPath)) throw new Error(`Missing annotation export manifest: ${exportManifestPath}`)

const report = buildSmoke()
writeJson(smokeJsonPath, report)
writeText(smokeMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded annotation import smoke report to ${smokeJsonPath}`)
console.log(`Wrote hard grounded annotation import smoke markdown to ${smokeMarkdownPath}`)
