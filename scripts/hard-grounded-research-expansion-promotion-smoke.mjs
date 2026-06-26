import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'expansion-review-workbooks/index.json')
const smokeDir = join(generatedDir, 'expansion-promotion-smoke')
const smokeJsonPath = join(smokeDir, 'report.json')
const smokeMarkdownPath = join(experimentDir, 'EXPANSION_PROMOTION_SMOKE.md')

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

function evidenceIds(row) {
  return (row.evidence_units || []).map((unit) => unit.id)
}

function fixtureFields(row) {
  const ids = evidenceIds(row)
  const insufficient = row.challenge_type === 'insufficient_evidence_probe' || ids.length === 0
  return {
    final_label: insufficient ? 'INSUFFICIENT' : 'SUPPORTED',
    final_answer: insufficient ? 'ABSTAIN' : row.candidate_answer || 'fixture-supported-answer',
    required_citation_ids: insufficient ? [] : ids.slice(0, 1),
    insufficient_or_conflicting_evidence: insufficient,
    category_fit: 'IN_CATEGORY',
    generation_defect: 'NONE',
    notes: 'Fixture expansion-promotion smoke label; not a human annotation and not release eligible.',
    reviewer_confidence: 'low',
  }
}

function completeRows(rows) {
  return rows.map((row) => ({
    ...row,
    reviewer_fields: fixtureFields(row),
  }))
}

function isComplete(row) {
  const fields = reviewerFields(row)
  return (
    validLabels.has(fields.final_label) &&
    validCategoryFit.has(fields.category_fit) &&
    validGenerationDefects.has(fields.generation_defect)
  )
}

function canonicalReview(row) {
  const fields = reviewerFields(row)
  return JSON.stringify({
    final_label: fields.final_label || '',
    final_answer: fields.final_answer || '',
    required_citation_ids: fields.required_citation_ids || [],
    insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
    category_fit: fields.category_fit || '',
    generation_defect: fields.generation_defect || '',
  })
}

function validateReview(row) {
  const fields = reviewerFields(row)
  const errors = []
  const ids = new Set(evidenceIds(row))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) errors.push('final_label is blank or invalid')
  if (!String(fields.final_answer || '').trim()) errors.push('final_answer is required')
  if (!Array.isArray(requiredCitationIds)) {
    errors.push('required_citation_ids must be an array')
  } else {
    const unknownIds = requiredCitationIds.filter((id) => !ids.has(id))
    if (unknownIds.length) errors.push(`unknown citation ids: ${unknownIds.join(', ')}`)
    if (evidenceRequiredLabels.has(fields.final_label) && requiredCitationIds.length === 0) {
      errors.push(`${fields.final_label} requires citations`)
    }
    if (noEvidenceLabels.has(fields.final_label) && requiredCitationIds.length > 0) {
      errors.push(`${fields.final_label} should not cite evidence`)
    }
  }
  if ((fields.final_label === 'INSUFFICIENT' || fields.final_label === 'CONFLICT') && fields.insufficient_or_conflicting_evidence !== true) {
    errors.push(`${fields.final_label} must set insufficient_or_conflicting_evidence=true`)
  }
  if (!validCategoryFit.has(fields.category_fit)) errors.push('category_fit is blank or invalid')
  if (!validGenerationDefects.has(fields.generation_defect)) errors.push('generation_defect is blank or invalid')
  if (!String(fields.notes || '').trim()) errors.push('notes are required')
  if (!String(fields.reviewer_confidence || '').trim()) errors.push('reviewer_confidence is required')
  return errors
}

function buildMerge(rows) {
  const byItem = new Map()
  const validationErrors = []
  for (const row of rows) {
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id).push(row)
    const errors = validateReview(row)
    if (errors.length) validationErrors.push({ item_id: row.item_id, reviewer_slot: row.reviewer_slot, errors })
  }

  const itemSummaries = [...byItem.entries()].map(([itemId, itemRows]) => {
    const completedRows = itemRows.filter(isComplete)
    const signatures = new Set(completedRows.map(canonicalReview))
    return {
      item_id: itemId,
      category: itemRows[0]?.category || '',
      assigned_reviews: itemRows.length,
      completed_reviews: completedRows.length,
      missing_reviews: Math.max(0, 2 - completedRows.length),
      has_disagreement: completedRows.length >= 2 && signatures.size > 1,
    }
  })

  const mergeReadyItems = itemSummaries.filter((item) => item.completed_reviews >= 2 && !item.has_disagreement).length
  return {
    unique_items: itemSummaries.length,
    total_review_rows: rows.length,
    completed_reviews: rows.filter(isComplete).length,
    validation_error_count: validationErrors.length,
    missing_review_items: itemSummaries.filter((item) => item.missing_reviews > 0).length,
    disagreement_items: itemSummaries.filter((item) => item.has_disagreement).length,
    merge_ready_items: mergeReadyItems,
    merge_ready: mergeReadyItems === itemSummaries.length && validationErrors.length === 0,
    item_summaries: itemSummaries,
    validation_errors: validationErrors,
  }
}

function buildSmoke() {
  const index = readJson(workbookIndexPath)
  const fixtureRows = []
  const fixtureWorkbooks = []

  for (const workbook of index.workbooks) {
    const sourceRows = readJsonl(join(experimentDir, workbook.path))
    const completedRows = completeRows(sourceRows)
    const fixturePath = join(smokeDir, 'review-workbooks', `${workbook.workbook_id}.fixture.jsonl`)
    writeJsonl(fixturePath, completedRows)
    fixtureRows.push(...completedRows)
    fixtureWorkbooks.push({
      ...workbook,
      fixture_path: `generated/expansion-promotion-smoke/review-workbooks/${workbook.workbook_id}.fixture.jsonl`,
    })
  }

  const merge = buildMerge(fixtureRows)
  const categorySummary = Object.fromEntries(
    [...new Set(merge.item_summaries.map((item) => item.category))].sort().map((category) => {
      const items = merge.item_summaries.filter((item) => item.category === category)
      return [
        category,
        {
          total_items: items.length,
          merge_ready_items: items.filter((item) => item.completed_reviews >= 2 && !item.has_disagreement).length,
        },
      ]
    }),
  )

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    smoke_id: 'expansion-promotion-smoke-2026-06-26',
    source_workbooks: 'generated/expansion-review-workbooks/index.json',
    fixture_not_human_review: true,
    fixture_release_eligible: false,
    expansion_promotion_smoke_ready: merge.merge_ready && merge.unique_items === 270,
    workbook_count: fixtureWorkbooks.length,
    fixture_workbooks: fixtureWorkbooks,
    merge,
    category_summary: categorySummary,
  }
}

function renderMarkdown(report) {
  const summaryRows = [
    ['Smoke ready', String(report.expansion_promotion_smoke_ready)],
    ['Fixture not human review', String(report.fixture_not_human_review)],
    ['Release eligible', String(report.fixture_release_eligible)],
    ['Workbooks', String(report.workbook_count)],
    ['Review rows', String(report.merge.total_review_rows)],
    ['Unique items', String(report.merge.unique_items)],
    ['Completed reviews', String(report.merge.completed_reviews)],
    ['Merge-ready items', String(report.merge.merge_ready_items)],
    ['Validation errors', String(report.merge.validation_error_count)],
  ]
  const categoryRows = Object.entries(report.category_summary).map(([category, value]) => [
    category,
    String(value.merge_ready_items),
    String(value.total_items),
  ])

  return `# Hard Grounded Research Expansion Promotion Smoke

This generated rehearsal completes copied expansion reviewer workbooks with fixture labels and verifies that the scaled 270-item review path can become merge-ready in isolation. It does not update real expansion workbooks and must not be used as human annotation evidence.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Category Readiness In Fixture Rehearsal

${markdownTable(['Category', 'Merge-ready fixture items', 'Total items'], categoryRows)}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing expansion review workbook index: ${workbookIndexPath}`)

const report = buildSmoke()
writeJson(smokeJsonPath, report)
writeText(smokeMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded expansion promotion smoke report to ${smokeJsonPath}`)
console.log(`Wrote hard grounded expansion promotion smoke markdown to ${smokeMarkdownPath}`)
