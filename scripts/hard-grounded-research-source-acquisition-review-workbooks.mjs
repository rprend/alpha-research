import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const candidatesPath = join(generatedDir, 'source-acquisition-candidates.json')
const rubricsPath = join(experimentDir, 'rubrics.json')
const workbookDir = join(generatedDir, 'source-acquisition-review-workbooks')
const indexPath = join(workbookDir, 'index.json')
const reportPath = join(experimentDir, 'SOURCE_ACQUISITION_REVIEW_WORKBOOKS.md')
const reviewerSlots = ['reviewer_a', 'reviewer_b']

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function evidenceUnits(candidate) {
  const base = {
    id: `${candidate.id}:source-row`,
    dataset: candidate.source_dataset,
    source_row_id: candidate.source_row_id,
    locator: `${candidate.source_locator.config}/${candidate.source_locator.split}/row:${candidate.source_locator.row_idx}`,
    title: candidate.source_dataset,
  }
  if (candidate.pointer_only) {
    return [{
      ...base,
      text: '',
      pointer_only: true,
      field_keys: candidate.field_keys,
      evidence_policy: candidate.evidence_policy,
    }]
  }
  return [{
    ...base,
    text: candidate.source_preview || '',
    pointer_only: false,
    field_keys: candidate.field_keys,
    evidence_policy: candidate.evidence_policy,
  }]
}

function workbookRow(candidate, reviewerSlot, rubrics) {
  const rubric = rubrics.category_rubrics[candidate.category]
  if (!rubric) throw new Error(`Missing rubric for source acquisition candidate category: ${candidate.category}`)

  return {
    workbook_family: 'source_acquisition_candidates',
    reviewer_slot: reviewerSlot,
    item_id: candidate.id,
    acquisition_id: candidate.acquisition_id,
    batch_id: candidate.batch_id,
    category: candidate.category,
    challenge_type: 'source_acquisition_task_draft',
    review_priority: 'source_acquisition_candidate_review',
    question: candidate.question_draft,
    candidate_answer: '',
    task_generation_instruction: candidate.task_generation_instruction,
    evidence_policy: candidate.evidence_policy,
    package_policy: candidate.package_policy,
    pointer_only: candidate.pointer_only,
    source_locator: candidate.source_locator,
    required_dimensions: rubric.required_dimensions,
    rubric: {
      strong_answer: rubric.strong_answer,
      near_miss: rubric.near_miss,
      hard_negative: rubric.hard_negative,
    },
    evidence_units: evidenceUnits(candidate),
    provenance: {
      source_candidate_suite: 'generated/source-acquisition-candidates.json',
      source_acquisition_id: candidate.acquisition_id,
      global_source_key: candidate.global_source_key,
    },
    reviewer_fields: {
      final_label: '',
      final_answer: '',
      required_citation_ids: [],
      insufficient_or_conflicting_evidence: false,
      category_fit: '',
      generation_defect: '',
      notes: '',
      reviewer_confidence: '',
    },
  }
}

function buildWorkbooks(candidateSuite, rubrics) {
  const byCategory = new Map()
  for (const candidate of candidateSuite.candidates) {
    const current = byCategory.get(candidate.category) || []
    current.push(candidate)
    byCategory.set(candidate.category, current)
  }

  const workbooks = []
  for (const summary of candidateSuite.category_summaries) {
    const candidates = byCategory.get(summary.category) || []
    for (const reviewerSlot of reviewerSlots) {
      const rows = candidates.map((candidate) => workbookRow(candidate, reviewerSlot, rubrics))
      const filename = `source_acq_${summary.category.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.${reviewerSlot}.jsonl`
      writeJsonl(join(workbookDir, filename), rows)
      workbooks.push({
        workbook_id: filename.replace(/\.jsonl$/, ''),
        category: summary.category,
        reviewer_slot: reviewerSlot,
        item_count: rows.length,
        known_license_items: rows.filter((row) => !row.pointer_only).length,
        pointer_only_items: rows.filter((row) => row.pointer_only).length,
        path: `generated/source-acquisition-review-workbooks/${filename}`,
      })
    }
  }

  return {
    source_acquisition_review_workbooks_ready:
      workbooks.length === candidateSuite.category_summaries.length * reviewerSlots.length &&
      workbooks.reduce((sum, workbook) => sum + workbook.item_count, 0) === candidateSuite.summary.required_review_rows,
    benchmark_id: candidateSuite.benchmark_id,
    source_candidate_suite: 'generated/source-acquisition-candidates.json',
    workbook_family: 'source_acquisition_candidates',
    workbook_count: workbooks.length,
    total_review_rows: workbooks.reduce((sum, workbook) => sum + workbook.item_count, 0),
    candidate_count: candidateSuite.summary.candidates,
    pointer_only_review_rows: workbooks.reduce((sum, workbook) => sum + workbook.pointer_only_items, 0),
    known_license_review_rows: workbooks.reduce((sum, workbook) => sum + workbook.known_license_items, 0),
    merge_policy: {
      merge_target: 'generated/source-acquisition-candidates.json',
      require_two_reviews_per_item: true,
      disagreement_resolution_required: true,
      gold_promotion_allowed_before_merge: false,
      reviewer_fields_only: true,
      pointer_only_text_must_remain_blank: true,
    },
    workbooks,
  }
}

function renderReport(index) {
  const rows = index.workbooks.map((workbook) => [
    workbook.workbook_id,
    workbook.category,
    workbook.reviewer_slot,
    String(workbook.item_count),
    String(workbook.known_license_items),
    String(workbook.pointer_only_items),
    workbook.path,
  ])

  return `# Source Acquisition Review Workbooks

This generated index creates independent review workbooks for source-acquisition task drafts. These workbooks do not complete review, adjudicate labels, or promote candidates to gold.

## Merge Policy

- Source candidate suite: ${index.source_candidate_suite}
- Require two reviews per item: ${index.merge_policy.require_two_reviews_per_item}
- Disagreement resolution required: ${index.merge_policy.disagreement_resolution_required}
- Gold promotion allowed before merge: ${index.merge_policy.gold_promotion_allowed_before_merge}
- Reviewer fields only: ${index.merge_policy.reviewer_fields_only}
- Pointer-only text must remain blank: ${index.merge_policy.pointer_only_text_must_remain_blank}
- Workbook count: ${index.workbook_count}
- Total review rows: ${index.total_review_rows}
- Candidate count: ${index.candidate_count}

## Workbooks

${markdownTable(['Workbook', 'Category', 'Reviewer slot', 'Rows', 'Known-license', 'Pointer-only', 'Path'], rows)}
`
}

const index = buildWorkbooks(readJson(candidatesPath), readJson(rubricsPath))
writeJson(indexPath, index)
writeText(reportPath, renderReport(index))

console.log(`Wrote source acquisition review workbook index to ${indexPath}`)
console.log(`Wrote source acquisition review workbook report to ${reportPath}`)
