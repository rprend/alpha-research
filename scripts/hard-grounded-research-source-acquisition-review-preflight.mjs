import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'source-acquisition-review-workbooks/index.json')
const preflightJsonPath = join(generatedDir, 'source-acquisition-review-preflight.json')
const preflightMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_REVIEW_PREFLIGHT.md')
const strict = process.argv.includes('--strict')

const validLabels = new Set(['SUPPORTED', 'REFUTED', 'INSUFFICIENT', 'CONFLICT', 'INVALID_ITEM'])
const validCategoryFit = new Set(['IN_CATEGORY', 'WRONG_CATEGORY', 'AMBIGUOUS_CATEGORY'])
const validGenerationDefects = new Set(['NONE', 'BAD_SOURCE_ROW', 'BAD_EVIDENCE', 'BAD_QUESTION', 'BAD_EXPECTED_ANSWER', 'DUPLICATE', 'OTHER'])
const evidenceRequiredLabels = new Set(['SUPPORTED', 'REFUTED', 'CONFLICT'])
const noEvidenceLabels = new Set(['INSUFFICIENT', 'INVALID_ITEM'])

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`)
      }
    })
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

function reviewerFields(row) {
  return row.reviewer_fields || {}
}

function missingFields(row) {
  const fields = reviewerFields(row)
  const missing = []
  const evidenceIds = new Set((row.evidence_units || []).map((unit) => unit.id))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) missing.push('final_label')
  if (!String(fields.final_answer || '').trim()) missing.push('final_answer')
  if (!Array.isArray(requiredCitationIds)) {
    missing.push('required_citation_ids_array')
  } else {
    const unknownIds = requiredCitationIds.filter((id) => !evidenceIds.has(id))
    if (unknownIds.length) missing.push(`unknown_required_citation_ids:${unknownIds.join(',')}`)
    if (evidenceRequiredLabels.has(fields.final_label) && requiredCitationIds.length === 0) {
      missing.push('required_citation_ids')
    }
    if (noEvidenceLabels.has(fields.final_label) && requiredCitationIds.length > 0) {
      missing.push('remove_required_citation_ids')
    }
  }
  if (
    (fields.final_label === 'INSUFFICIENT' || fields.final_label === 'CONFLICT') &&
    fields.insufficient_or_conflicting_evidence !== true
  ) {
    missing.push('insufficient_or_conflicting_evidence')
  }
  if (!validCategoryFit.has(fields.category_fit)) missing.push('category_fit')
  if (!validGenerationDefects.has(fields.generation_defect)) missing.push('generation_defect')
  if (!String(fields.notes || '').trim()) missing.push('notes')
  if (!String(fields.reviewer_confidence || '').trim()) missing.push('reviewer_confidence')
  if (row.pointer_only && (row.evidence_units || []).some((unit) => String(unit.text || '').trim())) {
    missing.push('pointer_only_text_must_remain_blank')
  }
  return missing
}

function buildPreflight(index, workbookRows) {
  const workbookSummaries = workbookRows.map(({ workbook, rows }) => {
    const incompleteRows = rows
      .map((row) => ({ row, missing: missingFields(row) }))
      .filter((entry) => entry.missing.length > 0)
      .sort((left, right) => left.row.item_id.localeCompare(right.row.item_id))

    return {
      workbook_id: workbook.workbook_id,
      reviewer_slot: workbook.reviewer_slot,
      category: workbook.category,
      item_count: rows.length,
      complete_rows: rows.length - incompleteRows.length,
      incomplete_rows: incompleteRows.length,
      pointer_only_rows: rows.filter((row) => row.pointer_only).length,
      next_items: incompleteRows.slice(0, 5).map((entry) => ({
        item_id: entry.row.item_id,
        missing_fields: entry.missing,
      })),
    }
  })

  const totalRows = workbookSummaries.reduce((sum, workbook) => sum + workbook.item_count, 0)
  const completeRows = workbookSummaries.reduce((sum, workbook) => sum + workbook.complete_rows, 0)
  const incompleteRows = totalRows - completeRows

  return {
    source_acquisition_review_preflight_report_ready:
      index.source_acquisition_review_workbooks_ready &&
      totalRows === index.total_review_rows &&
      workbookSummaries.length === index.workbook_count,
    benchmark_id: 'hard-grounded-research-benchmark',
    source_index: 'generated/source-acquisition-review-workbooks/index.json',
    workbook_count: index.workbook_count,
    candidate_count: index.candidate_count,
    total_review_rows: totalRows,
    complete_review_rows: completeRows,
    incomplete_review_rows: incompleteRows,
    pointer_only_review_rows: workbookSummaries.reduce((sum, workbook) => sum + workbook.pointer_only_rows, 0),
    preflight_ready: incompleteRows === 0,
    gold_promotion_allowed: false,
    required_source_acquisition_fields: ['category_fit', 'generation_defect'],
    workbook_summaries: workbookSummaries,
  }
}

function renderMarkdown(report) {
  const workbookRows = report.workbook_summaries.map((workbook) => [
    workbook.workbook_id,
    workbook.category,
    workbook.reviewer_slot,
    `${workbook.complete_rows}/${workbook.item_count}`,
    String(workbook.incomplete_rows),
    String(workbook.pointer_only_rows),
  ])
  const nextRows = report.workbook_summaries
    .flatMap((workbook) =>
      workbook.next_items.map((item) => [
        workbook.workbook_id,
        item.item_id,
        item.missing_fields.join('<br>'),
      ]),
    )
    .slice(0, 40)

  return `# Source Acquisition Review Preflight

This generated report checks source-acquisition reviewer workbooks before any merge, adjudication, or gold-promotion path. It does not complete review; it identifies the fields reviewers must return.

## Summary

- Report ready: ${report.source_acquisition_review_preflight_report_ready}
- Workbooks: ${report.workbook_count}
- Candidate items: ${report.candidate_count}
- Review rows: ${report.total_review_rows}
- Complete review rows: ${report.complete_review_rows}
- Incomplete review rows: ${report.incomplete_review_rows}
- Pointer-only review rows: ${report.pointer_only_review_rows}
- Preflight ready: ${report.preflight_ready}
- Gold promotion allowed: ${report.gold_promotion_allowed}
- Required source-acquisition fields: ${report.required_source_acquisition_fields.join(', ')}

## Workbook Status

${markdownTable(['Workbook', 'Category', 'Reviewer', 'Complete', 'Incomplete', 'Pointer-only rows'], workbookRows)}

## Next Incomplete Rows

${nextRows.length ? markdownTable(['Workbook', 'Item', 'Missing fields'], nextRows) : 'All source acquisition review rows are complete.'}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing source acquisition review workbook index: ${workbookIndexPath}`)

const index = readJson(workbookIndexPath)
const workbookRows = index.workbooks.map((workbook) => {
  const path = join(experimentDir, workbook.path)
  if (!existsSync(path)) throw new Error(`Missing source acquisition review workbook: ${path}`)
  return { workbook, rows: readJsonl(path) }
})

const report = buildPreflight(index, workbookRows)
writeJson(preflightJsonPath, report)
writeText(preflightMarkdownPath, renderMarkdown(report))

console.log(`Wrote source acquisition review preflight JSON to ${preflightJsonPath}`)
console.log(`Wrote source acquisition review preflight report to ${preflightMarkdownPath}`)

if (strict && !report.preflight_ready) {
  process.exitCode = 1
}
