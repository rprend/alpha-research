import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const adjudicationQueuePath = join(generatedDir, 'adjudication-queue.jsonl')
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

function summarize(rows, validationErrors) {
  const reviewedRows = rows.filter(isReviewed)
  const validReviewedRows = reviewedRows.filter((row) => !validationErrors.some((error) => error.item_id === row.item_id))
  const byCategory = Object.fromEntries(
    unique(rows.map((row) => row.category)).map((category) => {
      const categoryRows = rows.filter((row) => row.category === category)
      const reviewed = categoryRows.filter(isReviewed)
      return [
        category,
        {
          total: categoryRows.length,
          reviewed: reviewed.length,
          valid_reviewed: reviewed.filter((row) => !validationErrors.some((error) => error.item_id === row.item_id)).length,
        },
      ]
    }),
  )
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_queue: 'generated/adjudication-queue.jsonl',
    total_items: rows.length,
    reviewed_items: reviewedRows.length,
    valid_reviewed_items: validReviewedRows.length,
    invalid_reviewed_items: reviewedRows.length - validReviewedRows.length,
    unreviewed_items: rows.length - reviewedRows.length,
    gold_ready: rows.length > 0 && validReviewedRows.length === rows.length,
    by_category: byCategory,
    validation_errors: validationErrors,
  }
}

function buildGoldSuite(rows, pilotById) {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'pilot-gold-v0',
    source_queue: 'generated/adjudication-queue.jsonl',
    items: rows.map((row) => {
      const fields = finalFields(row)
      const pilotItem = pilotById.get(row.item_id)
      return {
        id: row.item_id,
        category: row.category,
        construction: row.construction,
        transform: row.transform,
        challenge: row.challenge || null,
        question: row.question,
        final_label: fields.final_label,
        final_answer: fields.final_answer,
        required_citation_ids: fields.required_citation_ids || [],
        insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
        notes: fields.notes,
        evidence_units: row.evidence_units,
        scoring_focus: pilotItem.scoring_focus,
        expected_failure: pilotItem.expected_failure,
      }
    }),
  }
}

assert(existsSync(pilotSuitePath), `Missing pilot suite: ${pilotSuitePath}`)
assert(existsSync(adjudicationQueuePath), `Missing adjudication queue: ${adjudicationQueuePath}`)

const pilotSuite = readJson(pilotSuitePath)
const rows = readJsonl(adjudicationQueuePath)
const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
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

const summary = summarize(rows, validationErrors)
writeJson(goldSummaryPath, summary)

if (summary.gold_ready) {
  writeJson(goldSuitePath, buildGoldSuite(rows, pilotById))
  console.log(`Wrote adjudicated gold suite to ${goldSuitePath}`)
} else {
  console.log(`Gold suite not ready: ${summary.valid_reviewed_items}/${summary.total_items} valid reviewed items.`)
}

writeJson(goldSummaryPath, summary)
console.log(`Wrote gold readiness summary to ${goldSummaryPath}`)

if (strict && !summary.gold_ready) {
  process.exitCode = 1
}
