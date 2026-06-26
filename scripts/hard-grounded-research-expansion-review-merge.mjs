import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'expansion-review-workbooks/index.json')
const reportPath = join(generatedDir, 'expansion-review-merge-report.json')
const reportMarkdownPath = join(experimentDir, 'EXPANSION_REVIEW_MERGE_REPORT.md')
const resolutionQueuePath = join(generatedDir, 'expansion-review-resolution-queue.jsonl')
const resolutionReportPath = join(experimentDir, 'EXPANSION_REVIEW_RESOLUTION_QUEUE.md')
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

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '')
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

function isCompleteReview(row) {
  const fields = reviewerFields(row)
  return (
    validLabels.has(fields.final_label) &&
    validCategoryFit.has(fields.category_fit) &&
    validGenerationDefects.has(fields.generation_defect)
  )
}

function validateReview(row) {
  const fields = reviewerFields(row)
  const errors = []
  const evidenceIds = new Set((row.evidence_units || []).map((unit) => unit.id))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) errors.push('final_label is blank or invalid')
  if (!String(fields.final_answer || '').trim()) errors.push('final_answer is required')
  if (!Array.isArray(requiredCitationIds)) {
    errors.push('required_citation_ids must be an array')
  } else {
    const unknownIds = requiredCitationIds.filter((id) => !evidenceIds.has(id))
    if (unknownIds.length) errors.push(`required_citation_ids are not present in evidence_units: ${unknownIds.join(', ')}`)
    if (evidenceRequiredLabels.has(fields.final_label) && requiredCitationIds.length === 0) {
      errors.push(`${fields.final_label} reviews must cite at least one evidence unit`)
    }
    if (noEvidenceLabels.has(fields.final_label) && requiredCitationIds.length > 0) {
      errors.push(`${fields.final_label} reviews should not have required citation ids`)
    }
  }
  if (
    (fields.final_label === 'INSUFFICIENT' || fields.final_label === 'CONFLICT') &&
    fields.insufficient_or_conflicting_evidence !== true
  ) {
    errors.push(`${fields.final_label} reviews must set insufficient_or_conflicting_evidence=true`)
  }
  if (!validCategoryFit.has(fields.category_fit)) errors.push('category_fit is blank or invalid')
  if (!validGenerationDefects.has(fields.generation_defect)) errors.push('generation_defect is blank or invalid')
  if (!String(fields.notes || '').trim()) errors.push('notes are required')
  if (!String(fields.reviewer_confidence || '').trim()) errors.push('reviewer_confidence is required')
  return errors
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

function publicReview(row) {
  const fields = reviewerFields(row)
  return {
    reviewer_slot: row.reviewer_slot,
    final_label: fields.final_label || '',
    final_answer: fields.final_answer || '',
    required_citation_ids: fields.required_citation_ids || [],
    insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
    category_fit: fields.category_fit || '',
    generation_defect: fields.generation_defect || '',
    notes: fields.notes || '',
    reviewer_confidence: fields.reviewer_confidence || '',
  }
}

function roundMetric(value) {
  if (value === null || value === undefined) return null
  return Number(value.toFixed(4))
}

function agreementStats(itemSummaries, byItem) {
  const doubleReviewed = itemSummaries.filter((item) => item.completed_reviews >= 2)
  const exactAgreements = doubleReviewed.filter((item) => !item.has_disagreement)
  const labelAgreements = doubleReviewed.filter((item) => {
    const labels = new Set((byItem.get(item.item_id) || []).filter(isCompleteReview).map((row) => reviewerFields(row).final_label))
    return labels.size === 1
  })
  const categoryFitAgreements = doubleReviewed.filter((item) => {
    const fits = new Set((byItem.get(item.item_id) || []).filter(isCompleteReview).map((row) => reviewerFields(row).category_fit))
    return fits.size === 1
  })
  const defectAgreements = doubleReviewed.filter((item) => {
    const defects = new Set((byItem.get(item.item_id) || []).filter(isCompleteReview).map((row) => reviewerFields(row).generation_defect))
    return defects.size === 1
  })

  return {
    double_reviewed_items: doubleReviewed.length,
    exact_agreement_items: exactAgreements.length,
    label_agreement_items: labelAgreements.length,
    category_fit_agreement_items: categoryFitAgreements.length,
    generation_defect_agreement_items: defectAgreements.length,
    exact_agreement_rate: doubleReviewed.length ? roundMetric(exactAgreements.length / doubleReviewed.length) : null,
    label_agreement_rate: doubleReviewed.length ? roundMetric(labelAgreements.length / doubleReviewed.length) : null,
    category_fit_agreement_rate: doubleReviewed.length ? roundMetric(categoryFitAgreements.length / doubleReviewed.length) : null,
    generation_defect_agreement_rate: doubleReviewed.length ? roundMetric(defectAgreements.length / doubleReviewed.length) : null,
  }
}

function buildReport(index, reviewRows) {
  const byItem = new Map()
  const validationErrors = []
  for (const row of reviewRows) {
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id).push(row)
    const errors = validateReview(row)
    if (errors.length && isCompleteReview(row)) {
      validationErrors.push({
        item_id: row.item_id,
        reviewer_slot: row.reviewer_slot,
        errors,
      })
    }
  }

  const itemSummaries = [...byItem.entries()].map(([itemId, rows]) => {
    const completedRows = rows.filter(isCompleteReview)
    const completedSignatures = new Set(completedRows.map(canonicalReview))
    return {
      item_id: itemId,
      category: rows[0]?.category || '',
      assigned_reviews: rows.length,
      completed_reviews: completedRows.length,
      missing_reviews: Math.max(0, index.merge_policy.require_two_reviews_per_item ? 2 - completedRows.length : 0),
      has_disagreement: completedRows.length >= 2 && completedSignatures.size > 1,
      reviewer_slots: rows.map((row) => row.reviewer_slot),
    }
  })

  const readyItems = itemSummaries.filter((item) => item.completed_reviews >= 2 && !item.has_disagreement)
  const disagreementItems = itemSummaries.filter((item) => item.has_disagreement)
  const missingItems = itemSummaries.filter((item) => item.missing_reviews > 0)
  const resolutionQueue = disagreementItems.map((item) => {
    const rows = byItem.get(item.item_id) || []
    return {
      item_id: item.item_id,
      category: item.category,
      resolution_status: 'needs_expansion_adjudicator_resolution',
      reviewer_slots: item.reviewer_slots,
      reviews: rows.filter(isCompleteReview).map(publicReview),
      adjudicator_fields: {
        final_label: '',
        final_answer: '',
        required_citation_ids: [],
        insufficient_or_conflicting_evidence: false,
        category_fit: '',
        generation_defect: '',
        notes: '',
      },
    }
  })

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_index: 'generated/expansion-review-workbooks/index.json',
    source_candidates: 'generated/expansion-candidates.json',
    workbook_count: index.workbook_count,
    total_review_rows: reviewRows.length,
    unique_items: itemSummaries.length,
    completed_reviews: reviewRows.filter(isCompleteReview).length,
    missing_review_items: missingItems.length,
    disagreement_items: disagreementItems.length,
    validation_error_count: validationErrors.length,
    merge_ready_items: readyItems.length,
    agreement: agreementStats(itemSummaries, byItem),
    merge_ready: readyItems.length === itemSummaries.length && validationErrors.length === 0,
    gold_promotion_allowed: false,
    item_summaries: itemSummaries,
    resolution_queue_count: resolutionQueue.length,
    resolution_queue_path: 'generated/expansion-review-resolution-queue.jsonl',
    resolution_queue: resolutionQueue,
    validation_errors: validationErrors,
  }
}

function renderReport(report) {
  const rows = report.item_summaries.map((item) => [
    item.item_id,
    item.category,
    String(item.assigned_reviews),
    String(item.completed_reviews),
    String(item.missing_reviews),
    item.has_disagreement ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research Expansion Review Merge Report

This report validates expansion candidate reviewer workbooks before candidates can be used for paper-scale claims. It does not promote any item to gold.

## Summary

- Workbooks: ${report.workbook_count}
- Review rows: ${report.total_review_rows}
- Unique items: ${report.unique_items}
- Completed reviews: ${report.completed_reviews}
- Missing-review items: ${report.missing_review_items}
- Disagreement items: ${report.disagreement_items}
- Validation errors: ${report.validation_error_count}
- Merge-ready items: ${report.merge_ready_items}
- Double-reviewed items: ${report.agreement.double_reviewed_items}
- Exact agreement rate: ${report.agreement.exact_agreement_rate ?? 'n/a'}
- Label agreement rate: ${report.agreement.label_agreement_rate ?? 'n/a'}
- Category-fit agreement rate: ${report.agreement.category_fit_agreement_rate ?? 'n/a'}
- Generation-defect agreement rate: ${report.agreement.generation_defect_agreement_rate ?? 'n/a'}
- Resolution queue items: ${report.resolution_queue_count}
- Merge ready: ${report.merge_ready}
- Gold promotion allowed: ${report.gold_promotion_allowed}

## Items

${markdownTable(['Item', 'Category', 'Assigned', 'Completed', 'Missing', 'Disagreement'], rows)}
`
}

function renderResolutionQueue(report) {
  const rows = report.resolution_queue.map((item) => [
    item.item_id,
    item.category,
    item.reviewer_slots.join(', '),
    item.resolution_status,
  ])

  return `# Hard Grounded Research Expansion Review Resolution Queue

This file lists expansion candidates where completed independent reviews disagree. It is only populated after reviews are complete enough to compare.

## Summary

- Resolution queue items: ${report.resolution_queue_count}
- Source: ${report.resolution_queue_path}
- Merge ready: ${report.merge_ready}

## Items

${rows.length ? markdownTable(['Item', 'Category', 'Reviewer slots', 'Status'], rows) : 'No expansion reviewer disagreements are present yet.'}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing expansion review workbook index: ${workbookIndexPath}`)

const index = readJson(workbookIndexPath)
const reviewRows = index.workbooks.flatMap((workbook) => {
  const path = join(experimentDir, workbook.path)
  if (!existsSync(path)) throw new Error(`Missing expansion review workbook: ${path}`)
  return readJsonl(path)
})

const report = buildReport(index, reviewRows)
writeJson(reportPath, report)
writeJsonl(resolutionQueuePath, report.resolution_queue)
writeText(reportMarkdownPath, renderReport(report))
writeText(resolutionReportPath, renderResolutionQueue(report))

console.log(`Wrote expansion review merge report to ${reportPath}`)
console.log(`Wrote expansion review merge markdown to ${reportMarkdownPath}`)
console.log(`Wrote expansion review resolution queue to ${resolutionQueuePath}`)
console.log(`Wrote expansion review resolution markdown to ${resolutionReportPath}`)

if (strict && !report.merge_ready) {
  process.exitCode = 1
}
