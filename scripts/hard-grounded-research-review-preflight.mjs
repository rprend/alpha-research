import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'review-workbooks/index.json')
const preflightJsonPath = join(generatedDir, 'review-preflight.json')
const preflightMarkdownPath = join(experimentDir, 'REVIEW_PREFLIGHT.md')
const strict = process.argv.includes('--strict')

const validLabels = new Set(['SUPPORTED', 'REFUTED', 'INSUFFICIENT', 'CONFLICT', 'INVALID_ITEM'])
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
  if (!String(fields.notes || '').trim()) missing.push('notes')
  if (!String(fields.reviewer_confidence || '').trim()) missing.push('reviewer_confidence')
  return missing
}

function reviewComplete(row) {
  return missingFields(row).length === 0
}

function priorityRank(row) {
  if (row.review_priority === 'review_carefully') return 0
  if ((row.quality_findings || []).some((finding) => finding.severity === 'high')) return 1
  return 2
}

function buildPreflight(index, workbookRows) {
  const workbookSummaries = workbookRows.map(({ workbook, rows }) => {
    const incompleteRows = rows
      .map((row) => ({ row, missing: missingFields(row) }))
      .filter((entry) => entry.missing.length > 0)
      .sort((left, right) => priorityRank(left.row) - priorityRank(right.row) || left.row.item_id.localeCompare(right.row.item_id))

    return {
      workbook_id: workbook.workbook_id,
      reviewer_slot: workbook.reviewer_slot,
      category: workbook.category,
      item_count: rows.length,
      complete_rows: rows.filter(reviewComplete).length,
      incomplete_rows: incompleteRows.length,
      high_attention_rows: rows.filter((row) => row.review_priority === 'review_carefully').length,
      next_items: incompleteRows.slice(0, 5).map((entry) => ({
        item_id: entry.row.item_id,
        review_priority: entry.row.review_priority,
        missing_fields: entry.missing,
        quality_findings: (entry.row.quality_findings || []).map((finding) => finding.code),
      })),
    }
  })

  const totalRows = workbookSummaries.reduce((sum, workbook) => sum + workbook.item_count, 0)
  const completeRows = workbookSummaries.reduce((sum, workbook) => sum + workbook.complete_rows, 0)
  const incompleteRows = totalRows - completeRows
  const byCategory = Object.fromEntries(
    [...new Set(workbookSummaries.map((workbook) => workbook.category))].map((category) => {
      const categoryWorkbooks = workbookSummaries.filter((workbook) => workbook.category === category)
      const categoryRows = categoryWorkbooks.reduce((sum, workbook) => sum + workbook.item_count, 0)
      const categoryComplete = categoryWorkbooks.reduce((sum, workbook) => sum + workbook.complete_rows, 0)
      return [
        category,
        {
          review_rows: categoryRows,
          complete_rows: categoryComplete,
          incomplete_rows: categoryRows - categoryComplete,
        },
      ]
    }),
  )

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_index: 'generated/review-workbooks/index.json',
    workbook_count: index.workbook_count,
    total_review_rows: totalRows,
    complete_review_rows: completeRows,
    incomplete_review_rows: incompleteRows,
    preflight_ready: incompleteRows === 0,
    by_category: byCategory,
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
    String(workbook.high_attention_rows),
  ])
  const nextRows = report.workbook_summaries
    .flatMap((workbook) =>
      workbook.next_items.map((item) => [
        workbook.workbook_id,
        item.item_id,
        item.review_priority,
        item.missing_fields.join('<br>'),
        item.quality_findings.length ? item.quality_findings.join('<br>') : 'none',
      ]),
    )
    .slice(0, 40)

  return `# Hard Grounded Research Review Preflight

This generated report checks reviewer workbooks before merge. It is a work queue for completing independent human review; it does not promote machine labels to gold.

## Summary

- Workbooks: ${report.workbook_count}
- Review rows: ${report.total_review_rows}
- Complete review rows: ${report.complete_review_rows}
- Incomplete review rows: ${report.incomplete_review_rows}
- Preflight ready: ${report.preflight_ready}

## Workbook Status

${markdownTable(['Workbook', 'Category', 'Reviewer', 'Complete', 'Incomplete', 'High-attention'], workbookRows)}

## Next Incomplete Rows

${nextRows.length ? markdownTable(['Workbook', 'Item', 'Priority', 'Missing fields', 'Quality findings'], nextRows) : 'All review rows are complete.'}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing review workbook index: ${workbookIndexPath}`)

const index = readJson(workbookIndexPath)
const workbookRows = index.workbooks.map((workbook) => {
  const path = join(experimentDir, workbook.path)
  if (!existsSync(path)) throw new Error(`Missing review workbook: ${path}`)
  return { workbook, rows: readJsonl(path) }
})

const report = buildPreflight(index, workbookRows)
writeJson(preflightJsonPath, report)
writeText(preflightMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded review preflight JSON to ${preflightJsonPath}`)
console.log(`Wrote hard grounded review preflight report to ${preflightMarkdownPath}`)

if (strict && !report.preflight_ready) {
  process.exitCode = 1
}
