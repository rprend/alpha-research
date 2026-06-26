import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const manifestPath = join(generatedDir, 'annotation-export/manifest.json')
const defaultInputDir = join(generatedDir, 'annotation-returns')
const reportDir = join(generatedDir, 'annotation-import')
const reportJsonPath = join(reportDir, 'report.json')
const reportMarkdownPath = join(experimentDir, 'ANNOTATION_IMPORT.md')

const args = new Set(process.argv.slice(2))
const apply = args.has('--apply')
const allowFixture = args.has('--allow-fixture')
const inputArg = process.argv.slice(2).find((arg) => arg.startsWith('--input-dir='))
const inputDir = inputArg ? join(root, inputArg.slice('--input-dir='.length)) : defaultInputDir

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

const validLabels = new Set(['SUPPORTED', 'REFUTED', 'INSUFFICIENT', 'CONFLICT', 'INVALID_ITEM'])
const evidenceRequiredLabels = new Set(['SUPPORTED', 'REFUTED', 'CONFLICT'])
const noEvidenceLabels = new Set(['INSUFFICIENT', 'INVALID_ITEM'])
const validCategoryFit = new Set(['IN_CATEGORY', 'WRONG_CATEGORY', 'AMBIGUOUS_CATEGORY'])
const validGenerationDefects = new Set(['NONE', 'BAD_SOURCE_ROW', 'BAD_EVIDENCE', 'BAD_QUESTION', 'BAD_EXPECTED_ANSWER', 'DUPLICATE', 'OTHER'])

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function fileDigest(path) {
  return sha256(readFileSync(path))
}

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

function stableJson(value) {
  return JSON.stringify(value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function sourceWorkbookPath(file) {
  const dir = file.scope === 'pilot_review' ? 'review-workbooks' : 'expansion-review-workbooks'
  return join(generatedDir, dir, `${file.workbook_id}.jsonl`)
}

function returnedFileCandidates(file) {
  const exportName = basename(file.file)
  return [
    join(inputDir, exportName),
    join(inputDir, exportName.replace(/\.jsonl$/, '.returned.jsonl')),
    join(inputDir, exportName.replace(/\.jsonl$/, '.returned-fixture.jsonl')),
  ]
}

function returnedPathFor(file) {
  return returnedFileCandidates(file).find((path) => existsSync(path)) || null
}

function isFixtureRow(row) {
  return String(row.reviewer_fields?.notes || '').toLowerCase().includes('fixture')
}

function validateReviewerSchema(row, file) {
  const findings = []
  const fields = row.reviewer_fields || {}
  const evidenceIds = new Set((row.evidence_units || []).map((unit) => unit.id))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) {
    findings.push({
      item_id: row.item_id,
      code: 'invalid_final_label',
      detail: `final_label must be one of ${[...validLabels].join(', ')}`,
    })
  }
  if (!String(fields.final_answer || '').trim()) {
    findings.push({
      item_id: row.item_id,
      code: 'missing_final_answer',
      detail: 'final_answer is required for imported reviewer rows.',
    })
  }
  if (!Array.isArray(requiredCitationIds)) {
    findings.push({
      item_id: row.item_id,
      code: 'invalid_required_citation_ids',
      detail: 'required_citation_ids must be an array.',
    })
  } else {
    const unknownIds = requiredCitationIds.filter((id) => !evidenceIds.has(id))
    if (unknownIds.length) {
      findings.push({
        item_id: row.item_id,
        code: 'unknown_required_citation_id',
        detail: `required_citation_ids not found in evidence_units: ${unknownIds.join(', ')}`,
      })
    }
    if (evidenceRequiredLabels.has(fields.final_label) && requiredCitationIds.length === 0) {
      findings.push({
        item_id: row.item_id,
        code: 'missing_required_citation_for_label',
        detail: `${fields.final_label} rows must cite at least one evidence unit.`,
      })
    }
    if (noEvidenceLabels.has(fields.final_label) && requiredCitationIds.length > 0) {
      findings.push({
        item_id: row.item_id,
        code: 'unexpected_citation_for_label',
        detail: `${fields.final_label} rows should not include required citation ids.`,
      })
    }
  }
  if ((fields.final_label === 'INSUFFICIENT' || fields.final_label === 'CONFLICT') && fields.insufficient_or_conflicting_evidence !== true) {
    findings.push({
      item_id: row.item_id,
      code: 'missing_insufficient_or_conflicting_flag',
      detail: `${fields.final_label} rows must set insufficient_or_conflicting_evidence=true.`,
    })
  }
  if (!String(fields.notes || '').trim()) {
    findings.push({
      item_id: row.item_id,
      code: 'missing_notes',
      detail: 'notes are required for imported reviewer rows.',
    })
  }
  if (!String(fields.reviewer_confidence || '').trim()) {
    findings.push({
      item_id: row.item_id,
      code: 'missing_reviewer_confidence',
      detail: 'reviewer_confidence is required for imported reviewer rows.',
    })
  }
  if (file.scope === 'expansion_review') {
    if (!validCategoryFit.has(fields.category_fit)) {
      findings.push({
        item_id: row.item_id,
        code: 'invalid_category_fit',
        detail: `category_fit must be one of ${[...validCategoryFit].join(', ')}`,
      })
    }
    if (!validGenerationDefects.has(fields.generation_defect)) {
      findings.push({
        item_id: row.item_id,
        code: 'invalid_generation_defect',
        detail: `generation_defect must be one of ${[...validGenerationDefects].join(', ')}`,
      })
    }
  }
  return findings
}

function validateRows({ originalRows, returnedRows, requiredFields, file }) {
  const findings = []
  if (originalRows.length !== returnedRows.length) {
    findings.push({
      code: 'row_count_changed',
      detail: `${originalRows.length} original rows vs ${returnedRows.length} returned rows`,
    })
    return findings
  }

  for (let index = 0; index < originalRows.length; index += 1) {
    const original = originalRows[index]
    const returned = returnedRows[index]
    if (original.item_id !== returned.item_id) {
      findings.push({
        code: 'item_order_or_identity_changed',
        detail: `row ${index}: ${original.item_id} -> ${returned.item_id}`,
      })
      continue
    }
    for (const field of immutableFields) {
      if (stableJson(original[field]) !== stableJson(returned[field])) {
        findings.push({
          item_id: original.item_id,
          code: 'immutable_field_changed',
          field,
        })
      }
    }
    const fields = returned.reviewer_fields || {}
    for (const field of requiredFields) {
      if (!(field in fields) || fields[field] === '' || fields[field] === null) {
        findings.push({
          item_id: original.item_id,
          code: 'missing_required_reviewer_field',
          field,
        })
      }
    }
    if (!allowFixture && isFixtureRow(returned)) {
      findings.push({
        item_id: original.item_id,
        code: 'fixture_annotation_rejected',
        detail: 'Fixture annotations require --allow-fixture and must never be applied as human review.',
      })
    }
    if (file.scope === 'expansion_review') {
      for (const field of ['category_fit', 'generation_defect']) {
        if (!(field in fields) || fields[field] === '' || fields[field] === null) {
          findings.push({
            item_id: original.item_id,
            code: 'missing_expansion_reviewer_field',
            field,
          })
        }
      }
    }
    findings.push(...validateReviewerSchema(returned, file))
  }
  return findings
}

function applyReturnedRows(file, returnedRows) {
  const workbookPath = sourceWorkbookPath(file)
  const workbookRows = readJsonl(workbookPath)
  const byItem = new Map(returnedRows.map((row) => [row.item_id, row.reviewer_fields]))
  const updatedRows = workbookRows.map((row) => {
    if (!byItem.has(row.item_id)) return row
    return {
      ...row,
      reviewer_fields: byItem.get(row.item_id),
    }
  })
  writeJsonl(workbookPath, updatedRows)
}

function buildImportReport() {
  const manifest = readJson(manifestPath)
  const fileReports = []
  let returnedFileCount = 0
  let rowsChecked = 0
  let rowsImportable = 0
  let findingCount = 0

  for (const file of manifest.files) {
    const exportPath = join(experimentDir, file.file)
    const returnedPath = returnedPathFor(file)
    if (!returnedPath) {
      fileReports.push({
        source_file: file.file,
        returned_file: '',
        workbook_id: file.workbook_id,
        scope: file.scope,
        row_count: file.row_count,
        importable_rows: 0,
        findings: [{ code: 'returned_file_missing', detail: `No returned JSONL found for ${basename(file.file)}` }],
        applied: false,
      })
      findingCount += 1
      continue
    }

    const originalRows = readJsonl(exportPath)
    const returnedRows = readJsonl(returnedPath)
    const findings = []
    if (fileDigest(exportPath) !== file.sha256) {
      findings.push({
        code: 'source_export_checksum_mismatch',
        detail: `Expected ${file.sha256}`,
      })
    }
    findings.push(...validateRows({
      originalRows,
      returnedRows,
      requiredFields: manifest.import_contract.required_fields,
      file,
    }))

    const importable = findings.length === 0
    if (apply && importable && !allowFixture) applyReturnedRows(file, returnedRows)

    returnedFileCount += 1
    rowsChecked += returnedRows.length
    rowsImportable += importable ? returnedRows.length : 0
    findingCount += findings.length
    fileReports.push({
      source_file: file.file,
      returned_file: relative(root, returnedPath),
      workbook_id: file.workbook_id,
      scope: file.scope,
      row_count: returnedRows.length,
      importable_rows: importable ? returnedRows.length : 0,
      returned_sha256: fileDigest(returnedPath),
      findings,
      applied: Boolean(apply && importable && !allowFixture),
    })
  }

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    import_id: 'annotation-import-2026-06-26',
    input_dir: relative(root, inputDir),
    source_manifest: 'generated/annotation-export/manifest.json',
    apply_requested: apply,
    allow_fixture: allowFixture,
    annotation_import_ready: returnedFileCount > 0 && findingCount === 0,
    applied_to_workbooks: apply && !allowFixture && findingCount === 0,
    reviewer_fields_only_enforced: true,
    fixture_rows_allowed: allowFixture,
    returned_files_found: returnedFileCount,
    expected_files: manifest.files.length,
    rows_checked: rowsChecked,
    rows_importable: rowsImportable,
    finding_count: findingCount,
    files: fileReports,
  }
}

function renderMarkdown(report) {
  const summaryRows = [
    ['Import ready', String(report.annotation_import_ready)],
    ['Apply requested', String(report.apply_requested)],
    ['Applied to workbooks', String(report.applied_to_workbooks)],
    ['Allow fixture', String(report.allow_fixture)],
    ['Returned files found', `${report.returned_files_found}/${report.expected_files}`],
    ['Rows checked', String(report.rows_checked)],
    ['Rows importable', String(report.rows_importable)],
    ['Findings', String(report.finding_count)],
  ]
  const fileRows = report.files.map((file) => [
    file.source_file,
    file.returned_file || 'missing',
    file.scope,
    String(file.row_count),
    String(file.importable_rows),
    String(file.findings.length),
    String(file.applied),
  ])

  return `# Hard Grounded Research Annotation Import

This generated report validates returned reviewer JSONL files against the annotation export manifest. The importer defaults to dry-run validation; it updates reviewer workbooks only when invoked with \`--apply\` and fixture rows are not allowed.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Import Rules

- Returned files must preserve every immutable benchmark field from the exported packet.
- Reviewers may change only \`reviewer_fields\`.
- Fixture rows are rejected unless \`--allow-fixture\` is passed, and fixture rows are never applied to workbooks.
- \`final_label\`, citation ids, insufficiency/conflict flags, notes, confidence, and expansion enums are validated before rows can be applied.
- Expansion review rows must include \`category_fit\` and \`generation_defect\` before import can pass.

## Files

${markdownTable(['Source file', 'Returned file', 'Scope', 'Rows', 'Importable rows', 'Findings', 'Applied'], fileRows)}
`
}

if (!existsSync(manifestPath)) throw new Error(`Missing annotation export manifest: ${manifestPath}`)
if (!existsSync(inputDir)) throw new Error(`Missing returned annotation input directory: ${inputDir}`)
if (!allowFixture) {
  const fixtureNames = readdirSync(inputDir).filter((name) => name.includes('fixture'))
  if (fixtureNames.length > 0) {
    throw new Error(`Input directory contains fixture files; rerun with --allow-fixture for smoke validation only: ${inputDir}`)
  }
}

const report = buildImportReport()
writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

if (apply && !report.applied_to_workbooks) {
  throw new Error('Annotation import --apply requested, but no rows were applied because the import report is not clean or fixture rows were allowed.')
}

console.log(`Wrote hard grounded annotation import report to ${reportJsonPath}`)
console.log(`Wrote hard grounded annotation import markdown to ${reportMarkdownPath}`)
