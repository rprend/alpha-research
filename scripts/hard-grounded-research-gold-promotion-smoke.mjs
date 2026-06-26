import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workbookIndexPath = join(generatedDir, 'review-workbooks/index.json')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const smokeDir = join(generatedDir, 'gold-promotion-smoke')
const smokeJsonPath = join(smokeDir, 'report.json')
const smokeMarkdownPath = join(experimentDir, 'GOLD_PROMOTION_SMOKE.md')

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
  if (row.challenge_type === 'insufficient_evidence_probe' || ids.length === 0) {
    return {
      final_label: 'INSUFFICIENT',
      final_answer: 'ABSTAIN',
      required_citation_ids: [],
      insufficient_or_conflicting_evidence: true,
      notes: 'Fixture gold-promotion smoke label; not a human annotation and not release eligible.',
      reviewer_confidence: 'low',
    }
  }
  return {
    final_label: 'SUPPORTED',
    final_answer: row.candidate_answer || 'fixture-supported-answer',
    required_citation_ids: ids.slice(0, 1),
    insufficient_or_conflicting_evidence: false,
    notes: 'Fixture gold-promotion smoke label; not a human annotation and not release eligible.',
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
  if (!String(fields.notes || '').trim()) errors.push('notes are required')
  return errors
}

function buildMergeReport(rows) {
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

function buildGoldRows(rows, pilotById) {
  const byItem = new Map()
  for (const row of rows) {
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id).push(row)
  }
  return [...byItem.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([itemId, itemRows]) => {
      const reviewedRows = itemRows.filter(isComplete)
      const fields = reviewerFields(reviewedRows[0])
      const pilotItem = pilotById.get(itemId)
      return {
        id: itemId,
        category: reviewedRows[0].category,
        construction: pilotItem?.construction || null,
        transform: pilotItem?.transform || null,
        challenge: reviewedRows[0].challenge || pilotItem?.challenge || null,
        question: reviewedRows[0].question,
        final_label: fields.final_label,
        final_answer: fields.final_answer,
        required_citation_ids: fields.required_citation_ids || [],
        insufficient_or_conflicting_evidence: Boolean(fields.insufficient_or_conflicting_evidence),
        notes: fields.notes,
        reviewer_slots: reviewedRows.map((row) => row.reviewer_slot),
        evidence_units: reviewedRows[0].evidence_units,
        scoring_focus: pilotItem?.scoring_focus || [],
        expected_failure: pilotItem?.expected_failure || '',
      }
    })
}

function buildSmoke() {
  const index = readJson(workbookIndexPath)
  const pilotSuite = readJson(pilotSuitePath)
  const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
  const fixtureWorkbooks = []
  const fixtureRows = []

  for (const workbook of index.workbooks) {
    const sourceRows = readJsonl(join(experimentDir, workbook.path))
    const completedRows = completeRows(sourceRows)
    const fixturePath = join(smokeDir, 'review-workbooks', `${workbook.workbook_id}.fixture.jsonl`)
    writeJsonl(fixturePath, completedRows)
    fixtureRows.push(...completedRows)
    fixtureWorkbooks.push({
      ...workbook,
      fixture_path: `generated/gold-promotion-smoke/review-workbooks/${workbook.workbook_id}.fixture.jsonl`,
    })
  }

  const merge = buildMergeReport(fixtureRows)
  const goldRows = merge.merge_ready ? buildGoldRows(fixtureRows, pilotById) : []
  const report = {
    benchmark_id: 'hard-grounded-research-benchmark',
    smoke_id: 'gold-promotion-smoke-2026-06-26',
    source_workbooks: 'generated/review-workbooks/index.json',
    fixture_not_human_review: true,
    fixture_release_eligible: false,
    reviewer_fields_only_rehearsal: true,
    gold_promotion_smoke_ready: merge.merge_ready && goldRows.length === merge.unique_items,
    workbook_count: fixtureWorkbooks.length,
    fixture_workbooks: fixtureWorkbooks,
    merge,
    gold_summary: {
      gold_ready: merge.merge_ready,
      gold_items: goldRows.length,
      valid_reviewed_items: merge.merge_ready_items,
      total_items: merge.unique_items,
      fixture_only: true,
    },
  }
  writeJson(join(smokeDir, 'gold-suite.fixture.json'), {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'fixture-gold-promotion-smoke-v0',
    fixture_not_human_review: true,
    items: goldRows,
  })
  return report
}

function renderMarkdown(report) {
  const summaryRows = [
    ['Smoke ready', String(report.gold_promotion_smoke_ready)],
    ['Fixture not human review', String(report.fixture_not_human_review)],
    ['Release eligible', String(report.fixture_release_eligible)],
    ['Workbooks', String(report.workbook_count)],
    ['Review rows', String(report.merge.total_review_rows)],
    ['Unique items', String(report.merge.unique_items)],
    ['Completed reviews', String(report.merge.completed_reviews)],
    ['Merge-ready items', String(report.merge.merge_ready_items)],
    ['Validation errors', String(report.merge.validation_error_count)],
    ['Fixture gold items', String(report.gold_summary.gold_items)],
  ]
  const categoryRows = Object.entries(
    report.merge.item_summaries.reduce((acc, item) => {
      acc[item.category] ||= { total: 0, ready: 0 }
      acc[item.category].total += 1
      if (item.completed_reviews >= 2 && !item.has_disagreement) acc[item.category].ready += 1
      return acc
    }, {}),
  ).map(([category, value]) => [category, String(value.ready), String(value.total)])

  return `# Hard Grounded Research Gold Promotion Smoke

This generated rehearsal completes copied reviewer workbooks with fixture labels and verifies that preflight/merge/gold-shape promotion can succeed in isolation. It does not write \`generated/gold-suite.json\`, does not update real review workbooks, and must not be used as human annotation evidence.

## Summary

${markdownTable(['Field', 'Value'], summaryRows)}

## Category Readiness In Fixture Rehearsal

${markdownTable(['Category', 'Merge-ready fixture items', 'Total items'], categoryRows)}
`
}

if (!existsSync(workbookIndexPath)) throw new Error(`Missing review workbook index: ${workbookIndexPath}`)
if (!existsSync(pilotSuitePath)) throw new Error(`Missing pilot suite: ${pilotSuitePath}`)

const report = buildSmoke()
writeJson(smokeJsonPath, report)
writeText(smokeMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded gold promotion smoke report to ${smokeJsonPath}`)
console.log(`Wrote hard grounded gold promotion smoke markdown to ${smokeMarkdownPath}`)
