import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const adjudicationQueuePath = join(generatedDir, 'adjudication-queue.jsonl')
const workbookIndexPath = join(generatedDir, 'review-workbooks/index.json')
const reviewMergeReportPath = join(generatedDir, 'review-merge-report.json')
const goldSuitePath = join(generatedDir, 'gold-suite.json')
const goldSummaryPath = join(generatedDir, 'gold-suite-summary.json')
const strict = process.argv.includes('--strict')

const validLabels = new Set(['SUPPORTED', 'REFUTED', 'INSUFFICIENT', 'CONFLICT', 'INVALID_ITEM'])
const evidenceRequiredLabels = new Set(['SUPPORTED', 'REFUTED', 'CONFLICT'])
const noEvidenceLabels = new Set(['INSUFFICIENT', 'INVALID_ITEM'])

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function finalFields(row) {
  return row.reviewer_fields || {}
}

function isReviewed(row) {
  return validLabels.has(finalFields(row).final_label)
}

function canonicalReview(row) {
  const fields = finalFields(row)
  return JSON.stringify({
    final_label: fields.final_label || '',
    final_answer: fields.final_answer || '',
    required_citation_ids: fields.required_citation_ids || [],
    insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
  })
}

function validateReviewedRow(row, pilotItem) {
  const fields = finalFields(row)
  const errors = []
  const evidenceIds = new Set((row.evidence_units || []).map((unit) => unit.id))
  const requiredCitationIds = fields.required_citation_ids || []

  if (!validLabels.has(fields.final_label)) {
    errors.push('final_label must be one of SUPPORTED, REFUTED, INSUFFICIENT, CONFLICT, INVALID_ITEM')
  }
  if (!String(fields.final_answer || '').trim()) {
    errors.push('final_answer is required for reviewed rows')
  }
  if (!Array.isArray(requiredCitationIds)) {
    errors.push('required_citation_ids must be an array')
  } else {
    const duplicateIds = requiredCitationIds.filter((id, index) => requiredCitationIds.indexOf(id) !== index)
    if (duplicateIds.length) errors.push(`required_citation_ids contains duplicates: ${unique(duplicateIds).join(', ')}`)
    const unknownIds = requiredCitationIds.filter((id) => !evidenceIds.has(id))
    if (unknownIds.length) errors.push(`required_citation_ids are not present in evidence_units: ${unknownIds.join(', ')}`)
    if (evidenceRequiredLabels.has(fields.final_label) && requiredCitationIds.length === 0) {
      errors.push(`${fields.final_label} rows must cite at least one evidence unit`)
    }
    if (noEvidenceLabels.has(fields.final_label) && requiredCitationIds.length > 0) {
      errors.push(`${fields.final_label} rows should not have required citation ids`)
    }
  }
  if (fields.final_label === 'INSUFFICIENT' && fields.insufficient_or_conflicting_evidence !== true) {
    errors.push('INSUFFICIENT rows must set insufficient_or_conflicting_evidence=true')
  }
  if (fields.final_label === 'CONFLICT' && fields.insufficient_or_conflicting_evidence !== true) {
    errors.push('CONFLICT rows must set insufficient_or_conflicting_evidence=true')
  }
  if (pilotItem.challenge && !row.challenge) {
    errors.push('review row is missing challenge payload from pilot item')
  }
  if (!String(fields.notes || '').trim()) {
    errors.push('notes are required for adjudicated rows')
  }

  return errors
}

function summarize(rows, validationErrors, mergeReport) {
  const validReviewedItems = mergeReport.merge_ready_items
  const invalidReviewedItems = mergeReport.validation_error_count
  const reviewedItems = Math.min(rows.length, validReviewedItems + invalidReviewedItems + mergeReport.disagreement_items)
  const byCategory = Object.fromEntries(
    unique(mergeReport.item_summaries.map((item) => item.category)).map((category) => {
      const categoryItems = mergeReport.item_summaries.filter((item) => item.category === category)
      const readyItems = categoryItems.filter((item) => item.completed_reviews >= 2 && !item.has_disagreement)
      return [
        category,
        {
          total: categoryItems.length,
          completed_review_items: categoryItems.filter((item) => item.completed_reviews >= 2).length,
          merge_ready: readyItems.length,
          missing_review_items: categoryItems.filter((item) => item.missing_reviews > 0).length,
          disagreement_items: categoryItems.filter((item) => item.has_disagreement).length,
        },
      ]
    }),
  )
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_queue: 'generated/adjudication-queue.jsonl',
    source_workbooks: 'generated/review-workbooks/index.json',
    source_review_merge_report: 'generated/review-merge-report.json',
    total_items: rows.length,
    reviewed_items: reviewedItems,
    valid_reviewed_items: validReviewedItems,
    invalid_reviewed_items: invalidReviewedItems,
    unreviewed_items: mergeReport.missing_review_items,
    completed_reviews: mergeReport.completed_reviews,
    missing_review_items: mergeReport.missing_review_items,
    disagreement_items: mergeReport.disagreement_items,
    validation_error_count: mergeReport.validation_error_count,
    merge_ready_items: mergeReport.merge_ready_items,
    gold_ready: Boolean(mergeReport.merge_ready),
    by_category: byCategory,
    validation_errors: validationErrors,
  }
}

function buildGoldRows(workbookRows, pilotById) {
  const byItem = new Map()
  for (const row of workbookRows) {
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id).push(row)
  }

  return [...byItem.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, rows]) => {
      const reviewedRows = rows.filter(isReviewed)
      const signatures = new Set(reviewedRows.map(canonicalReview))
      assert(reviewedRows.length >= 2, `Cannot promote ${itemId}: fewer than two completed reviews.`)
      assert(signatures.size === 1, `Cannot promote ${itemId}: reviewer disagreement remains.`)
      const row = reviewedRows[0]
      const fields = finalFields(row)
      const pilotItem = pilotById.get(itemId)
      assert(pilotItem, `Cannot promote ${itemId}: item_id is not present in pilot-suite.json.`)
      return {
        id: itemId,
        category: row.category,
        construction: pilotItem.construction,
        transform: pilotItem.transform,
        challenge: row.challenge || pilotItem.challenge || null,
        question: row.question,
        final_label: fields.final_label,
        final_answer: fields.final_answer,
        required_citation_ids: fields.required_citation_ids || [],
        insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
        notes: fields.notes,
        reviewer_slots: reviewedRows.map((review) => review.reviewer_slot),
        evidence_units: row.evidence_units,
        scoring_focus: pilotItem.scoring_focus,
        expected_failure: pilotItem.expected_failure,
      }
    })
}

assert(existsSync(pilotSuitePath), `Missing pilot suite: ${pilotSuitePath}`)
assert(existsSync(adjudicationQueuePath), `Missing adjudication queue: ${adjudicationQueuePath}`)
assert(existsSync(workbookIndexPath), `Missing review workbook index: ${workbookIndexPath}`)
assert(existsSync(reviewMergeReportPath), `Missing review merge report: ${reviewMergeReportPath}`)

const pilotSuite = readJson(pilotSuitePath)
const rows = readJsonl(adjudicationQueuePath)
const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
const workbookIndex = readJson(workbookIndexPath)
const mergeReport = readJson(reviewMergeReportPath)
const workbookRows = workbookIndex.workbooks.flatMap((workbook) => readJsonl(join(experimentDir, workbook.path)))
const validationErrors = []

for (const row of rows) {
  const pilotItem = pilotById.get(row.item_id)
  if (!pilotItem) {
    validationErrors.push({ item_id: row.item_id, errors: ['item_id is not present in pilot-suite.json'] })
    continue
  }
  if (isReviewed(row)) {
    const errors = validateReviewedRow(row, pilotItem)
    if (errors.length) validationErrors.push({ item_id: row.item_id, errors })
  }
}

const summary = summarize(rows, validationErrors, mergeReport)
writeJson(goldSummaryPath, summary)

if (summary.gold_ready) {
  const goldRows = buildGoldRows(workbookRows, pilotById)
  writeJson(goldSuitePath, {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'reviewed-gold-v0',
    source_workbooks: 'generated/review-workbooks/index.json',
    source_review_merge_report: 'generated/review-merge-report.json',
    items: goldRows,
  })
  console.log(`Wrote adjudicated gold suite to ${goldSuitePath}`)
} else {
  console.log(`Gold suite not ready: ${summary.valid_reviewed_items}/${summary.total_items} valid reviewed items.`)
}

writeJson(goldSummaryPath, summary)
console.log(`Wrote gold readiness summary to ${goldSummaryPath}`)

if (strict && !summary.gold_ready) {
  process.exitCode = 1
}
