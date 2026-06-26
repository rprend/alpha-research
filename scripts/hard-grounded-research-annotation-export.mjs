import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotWorkbookDir = join(generatedDir, 'review-workbooks')
const expansionWorkbookDir = join(generatedDir, 'expansion-review-workbooks')
const assignmentsPath = join(generatedDir, 'annotation-assignments.json')
const protocolPath = join(generatedDir, 'annotation-protocol.json')
const exportDir = join(generatedDir, 'annotation-export')
const manifestPath = join(exportDir, 'manifest.json')
const exportMarkdownPath = join(experimentDir, 'ANNOTATION_EXPORT.md')

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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function workbookPath(scope, workbookId) {
  const dir = scope === 'pilot_review' ? pilotWorkbookDir : expansionWorkbookDir
  return join(dir, `${workbookId}.jsonl`)
}

function loadWorkbook(scope, workbookId) {
  const path = workbookPath(scope, workbookId)
  if (!existsSync(path)) throw new Error(`Missing ${scope} workbook: ${path}`)
  return readJsonl(path)
}

function selectRows(scope, workbookId, itemIds) {
  const rows = loadWorkbook(scope, workbookId)
  const wanted = new Set(itemIds)
  return rows.filter((row) => wanted.has(row.item_id)).map((row) => ({
    ...row,
    export_scope: scope,
    source_workbook_id: workbookId,
  }))
}

function pilotExports(assignments) {
  const byWorkbook = new Map()
  for (const assignment of assignments.pilot_assignments) {
    for (const workbook of assignment.reviewer_workbooks) {
      const current = byWorkbook.get(workbook.workbook_id) || {
        scope: 'pilot_review',
        workbook_id: workbook.workbook_id,
        reviewer_slot: workbook.reviewer_slot,
        category: workbook.category,
        item_ids: new Set(),
        assignment_ids: new Set(),
      }
      current.item_ids.add(assignment.item_id)
      current.assignment_ids.add(assignment.assignment_id)
      byWorkbook.set(workbook.workbook_id, current)
    }
  }
  return [...byWorkbook.values()].map((entry) => ({
    ...entry,
    item_ids: [...entry.item_ids].sort(),
    assignment_ids: [...entry.assignment_ids].sort(),
  }))
}

function expansionExports(assignments) {
  const exports = []
  for (const assignment of assignments.expansion_assignments) {
    for (const workbook of assignment.reviewer_workbooks) {
      exports.push({
        scope: 'expansion_review',
        workbook_id: workbook.workbook_id,
        reviewer_slot: workbook.reviewer_slot,
        category: assignment.category,
        item_ids: workbook.next_item_ids.slice(0, 5),
        assignment_ids: [assignment.assignment_id],
      })
    }
  }
  return exports
}

function buildExport() {
  const assignments = readJson(assignmentsPath)
  const protocol = readJson(protocolPath)
  const selected = [...pilotExports(assignments), ...expansionExports(assignments)]
  const files = []

  for (const exportSpec of selected) {
    const rows = selectRows(exportSpec.scope, exportSpec.workbook_id, exportSpec.item_ids)
    if (rows.length !== exportSpec.item_ids.length) {
      throw new Error(`Export ${exportSpec.workbook_id} selected ${exportSpec.item_ids.length} rows but found ${rows.length}`)
    }
    const path = join(exportDir, `${exportSpec.workbook_id}.export.jsonl`)
    writeJsonl(path, rows)
    files.push({
      file: `generated/annotation-export/${basename(path)}`,
      scope: exportSpec.scope,
      workbook_id: exportSpec.workbook_id,
      reviewer_slot: exportSpec.reviewer_slot,
      category: exportSpec.category,
      assignment_ids: exportSpec.assignment_ids,
      row_count: rows.length,
      expected_return_row_count: rows.length,
      item_ids: rows.map((row) => row.item_id),
      required_return_fields: protocol.required_reviewer_fields,
      return_packet_checks: [
        'Every exported row is returned exactly once.',
        'Only reviewer_fields are modified.',
        'required_citation_ids refer only to citation ids present in evidence_units.',
        'reviewer_confidence is a supported enum value.',
        'notes explains insufficiency, conflict, or conclusion-overreach judgments.',
      ],
      sha256: fileDigest(path),
    })
  }

  const manifest = {
    benchmark_id: 'hard-grounded-research-benchmark',
    export_id: 'annotation-export-2026-06-26-wave-1',
    export_ready: true,
    generated_from: {
      annotation_assignments: 'generated/annotation-assignments.json',
      annotation_protocol: 'generated/annotation-protocol.json',
      pilot_workbooks: 'generated/review-workbooks/*.jsonl',
      expansion_workbooks: 'generated/expansion-review-workbooks/*.jsonl',
    },
    reviewer_fields_only: true,
    import_contract: {
      editable_path: 'reviewer_fields',
      required_fields: protocol.required_reviewer_fields,
      reviewer_must_not_edit: [
        'item_id',
        'category',
        'challenge_type',
        'question',
        'candidate_answer',
        'evidence_units',
        'required_dimensions',
        'rubric',
        'quality_findings',
      ],
      merge_gates: [
        'review-preflight must pass',
        'review-merge must find two valid agreeing reviews per item',
        'disagreement rows must be resolved before gold promotion',
      ],
    },
    return_readiness: {
      ready: true,
      expected_files: files.length,
      expected_rows: files.reduce((sum, file) => sum + file.row_count, 0),
      packet_checklist: [
        'Return one JSONL file for each exported JSONL file.',
        'Preserve item_id, source_workbook_id, export_scope, evidence_units, rubric, and quality_findings exactly.',
        'Fill every required reviewer field on every row.',
        'Use category_fit and generation_defect only for expansion_review packets.',
        'Run the annotation import dry-run before applying returned packets.',
      ],
      dry_run_command:
        'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir>',
      apply_command:
        'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir> --apply',
    },
    totals: {
      file_count: files.length,
      row_count: files.reduce((sum, file) => sum + file.row_count, 0),
      pilot_files: files.filter((file) => file.scope === 'pilot_review').length,
      pilot_rows: files.filter((file) => file.scope === 'pilot_review').reduce((sum, file) => sum + file.row_count, 0),
      expansion_files: files.filter((file) => file.scope === 'expansion_review').length,
      expansion_rows: files.filter((file) => file.scope === 'expansion_review').reduce((sum, file) => sum + file.row_count, 0),
    },
    files,
  }

  writeJson(manifestPath, manifest)
  return manifest
}

function renderMarkdown(manifest) {
  const summaryRows = [
    ['Export id', manifest.export_id],
    ['Files', String(manifest.totals.file_count)],
    ['Rows', String(manifest.totals.row_count)],
    ['Pilot rows', String(manifest.totals.pilot_rows)],
    ['Expansion rows', String(manifest.totals.expansion_rows)],
    ['Reviewer fields only', String(manifest.reviewer_fields_only)],
    ['Return readiness', String(manifest.return_readiness.ready)],
    ['Expected returned files', String(manifest.return_readiness.expected_files)],
    ['Expected returned rows', String(manifest.return_readiness.expected_rows)],
  ]
  const checklistRows = manifest.return_readiness.packet_checklist.map((item, index) => [
    String(index + 1),
    item,
  ])
  const fileRows = manifest.files.map((file) => [
    file.file,
    file.scope,
    file.category,
    file.reviewer_slot,
    `${file.row_count}/${file.expected_return_row_count}`,
    file.sha256.slice(0, 16),
  ])

  return `# Hard Grounded Research Annotation Export

This generated packet exports the first review wave from the current pilot and expansion workbooks. It does not complete review, adjudicate labels, or promote gold; it gives reviewers stable JSONL files and checksums that can be imported back through the existing preflight and merge gates.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Import Contract

- Reviewers may edit only the \`reviewer_fields\` object.
- Required reviewer fields: ${manifest.import_contract.required_fields.join(', ')}
- Do not edit item metadata, evidence units, rubrics, quality findings, or challenge payloads.
- Gold promotion remains blocked until double-review preflight and merge gates pass.

## Return Readiness Checklist

${markdownTable(['Step', 'Requirement'], checklistRows)}

Dry-run command: \`${manifest.return_readiness.dry_run_command}\`

Apply command: \`${manifest.return_readiness.apply_command}\`

## Export Files

${markdownTable(['File', 'Scope', 'Category', 'Reviewer', 'Rows exported/expected return', 'SHA-256 prefix'], fileRows)}
`
}

for (const path of [assignmentsPath, protocolPath]) {
  if (!existsSync(path)) throw new Error(`Missing annotation export input: ${path}`)
}
for (const dir of [pilotWorkbookDir, expansionWorkbookDir]) {
  if (!existsSync(dir) || readdirSync(dir).filter((name) => name.endsWith('.jsonl')).length === 0) {
    throw new Error(`Missing annotation export workbook directory: ${dir}`)
  }
}

const manifest = buildExport()
writeText(exportMarkdownPath, renderMarkdown(manifest))

console.log(`Wrote hard grounded annotation export manifest to ${manifestPath}`)
console.log(`Wrote hard grounded annotation export report to ${exportMarkdownPath}`)
