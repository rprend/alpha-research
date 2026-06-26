import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'review-workbooks/index.json')
const reportPath = join(generatedDir, 'review-merge-report.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_MERGE_REPORT.md')
const resolutionQueuePath = join(generatedDir, 'review-resolution-queue.jsonl')
const resolutionReportPath = join(experimentDir, 'REVIEW_RESOLUTION_QUEUE.md')
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

function isCompleteReview(row) {
  return validLabels.has(reviewerFields(row).final_label)
}

function canonicalReview(row) {
  const fields = reviewerFields(row)
  return JSON.stringify({
    final_label: fields.final_label || '',
    final_answer: fields.final_answer || '',
    required_citation_ids: fields.required_citation_ids || [],
    insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
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
    notes: fields.notes || '',
    reviewer_confidence: fields.reviewer_confidence || '',
  }
}

function validateReview(row) {
  const fields = reviewerFields(row)
  const errors = []
  const evidenceIds = new Set((row.evidence_units || []).map((unit) => unit.id))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) errors.push('final_label is blank or invalid')
  if (validLabels.has(fields.final_label) && !String(fields.final_answer || '').trim()) {
    errors.push('final_answer is required for completed reviews')
  }
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
  if (fields.final_label === 'INSUFFICIENT' && fields.insufficient_or_conflicting_evidence !== true) {
    errors.push('INSUFFICIENT reviews must set insufficient_or_conflicting_evidence=true')
  }
  if (fields.final_label === 'CONFLICT' && fields.insufficient_or_conflicting_evidence !== true) {
    errors.push('CONFLICT reviews must set insufficient_or_conflicting_evidence=true')
  }
  if (validLabels.has(fields.final_label) && !String(fields.notes || '').trim()) {
    errors.push('notes are required for completed reviews')
  }
  return errors
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
      resolution_status: 'needs_adjudicator_resolution',
      reviewer_slots: item.reviewer_slots,
      reviews: rows.filter(isCompleteReview).map(publicReview),
      adjudicator_fields: {
        final_label: '',
        final_answer: '',
        required_citation_ids: [],
        insufficient_or_conflicting_evidence: false,
        notes: '',
      },
    }
  })

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_index: 'generated/review-workbooks/index.json',
    workbook_count: index.workbook_count,
    total_review_rows: reviewRows.length,
    unique_items: itemSummaries.length,
    completed_reviews: reviewRows.filter(isCompleteReview).length,
    missing_review_items: missingItems.length,
    disagreement_items: disagreementItems.length,
    validation_error_count: validationErrors.length,
    merge_ready_items: readyItems.length,
    merge_ready: readyItems.length === itemSummaries.length && validationErrors.length === 0,
    item_summaries: itemSummaries,
    resolution_queue_count: resolutionQueue.length,
    resolution_queue_path: 'generated/review-resolution-queue.jsonl',
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

  return `# Hard Grounded Research Review Merge Report

This report validates reviewer workbooks before any labels are merged into \`generated/adjudication-queue.jsonl\`.

## Summary

- Workbooks: ${report.workbook_count}
- Review rows: ${report.total_review_rows}
- Unique items: ${report.unique_items}
- Completed reviews: ${report.completed_reviews}
- Missing-review items: ${report.missing_review_items}
- Disagreement items: ${report.disagreement_items}
- Validation errors: ${report.validation_error_count}
- Merge-ready items: ${report.merge_ready_items}
- Resolution queue items: ${report.resolution_queue_count}
- Merge ready: ${report.merge_ready}

## Items

${markdownTable(['Item', 'Category', 'Assigned', 'Completed', 'Missing', 'Disagreement'], rows)}
`
}

function writeJsonl(path, rows) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, rows.length ? `${rows.map((row) => JSON.stringify(row)).join('\n')}\n` : '')
}

function renderResolutionQueue(report) {
  const rows = report.resolution_queue.map((item) => [
    item.item_id,
    item.category,
    item.reviewer_slots.join(', '),
    item.resolution_status,
  ])

  return `# Hard Grounded Research Review Resolution Queue

This file is generated by \`benchmark:hard-grounded:review-merge\`. It lists only items where completed independent reviews disagree and an adjudicator must choose the final label before gold promotion.

## Summary

- Resolution queue items: ${report.resolution_queue_count}
- Source: ${report.resolution_queue_path}
- Merge ready: ${report.merge_ready}

## Items

${rows.length ? markdownTable(['Item', 'Category', 'Reviewer slots', 'Status'], rows) : 'No reviewer disagreements are present yet.'}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing review workbook index: ${workbookIndexPath}`)

const index = readJson(workbookIndexPath)
const reviewRows = index.workbooks.flatMap((workbook) => {
  const path = join(experimentDir, workbook.path)
  if (!existsSync(path)) throw new Error(`Missing review workbook: ${path}`)
  return readJsonl(path)
})

const report = buildReport(index, reviewRows)
writeJson(reportPath, report)
writeJsonl(resolutionQueuePath, report.resolution_queue)
writeText(reportMarkdownPath, renderReport(report))
writeText(resolutionReportPath, renderResolutionQueue(report))

console.log(`Wrote review merge report to ${reportPath}`)
console.log(`Wrote review merge markdown to ${reportMarkdownPath}`)
console.log(`Wrote review resolution queue to ${resolutionQueuePath}`)
console.log(`Wrote review resolution markdown to ${resolutionReportPath}`)

if (strict && !report.merge_ready) {
  process.exitCode = 1
}
