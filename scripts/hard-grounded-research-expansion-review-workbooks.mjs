import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const candidatesPath = join(generatedDir, 'expansion-candidates.json')
const rubricsPath = join(experimentDir, 'rubrics.json')
const workbookDir = join(generatedDir, 'expansion-review-workbooks')
const indexPath = join(workbookDir, 'index.json')
const reportPath = join(experimentDir, 'EXPANSION_REVIEW_WORKBOOKS.md')
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
  return candidate.source_examples.flatMap((source) =>
    source.evidence_units.map((unit) => ({
      id: unit.id,
      dataset: source.source_dataset,
      source_row_id: source.source_row_id,
      title: unit.title,
      locator: unit.locator,
      text: unit.text,
    })),
  )
}

function workbookRow(candidate, reviewerSlot, rubrics) {
  const rubric = rubrics.category_rubrics[candidate.category]
  if (!rubric) throw new Error(`Missing rubric for expansion candidate category: ${candidate.category}`)

  return {
    workbook_family: 'expansion_candidates',
    batch_id: candidate.batch_id,
    reviewer_slot: reviewerSlot,
    item_id: candidate.id,
    seed_item_id: candidate.seed_item_id,
    category: candidate.category,
    challenge_type: candidate.transform,
    review_priority: 'expansion_candidate_review',
    question: candidate.question,
    candidate_answer: candidate.expected_answer,
    required_dimensions: rubric.required_dimensions,
    rubric: {
      strong_answer: rubric.strong_answer,
      near_miss: rubric.near_miss,
      hard_negative: rubric.hard_negative,
    },
    evidence_units: evidenceUnits(candidate),
    provenance: candidate.provenance,
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
  const candidatesByBatch = new Map()
  for (const candidate of candidateSuite.candidates) {
    const current = candidatesByBatch.get(candidate.batch_id) || []
    current.push(candidate)
    candidatesByBatch.set(candidate.batch_id, current)
  }

  const workbooks = []
  for (const batch of candidateSuite.batch_summaries) {
    const candidates = candidatesByBatch.get(batch.batch_id) || []
    for (const reviewerSlot of reviewerSlots) {
      const rows = candidates.map((candidate) => workbookRow(candidate, reviewerSlot, rubrics))
      const filename = `${batch.batch_id}.${reviewerSlot}.jsonl`
      writeJsonl(join(workbookDir, filename), rows)
      workbooks.push({
        workbook_id: `${batch.batch_id}.${reviewerSlot}`,
        batch_id: batch.batch_id,
        category: batch.category,
        reviewer_slot: reviewerSlot,
        item_count: rows.length,
        path: `generated/expansion-review-workbooks/${filename}`,
      })
    }
  }

  return {
    version: '0.1.0',
    source_candidates: candidateSuite.source_manifest,
    source_candidate_suite: 'generated/expansion-candidates.json',
    workbook_family: 'expansion_candidates',
    workbook_count: workbooks.length,
    total_review_rows: workbooks.reduce((sum, workbook) => sum + workbook.item_count, 0),
    candidate_count: candidateSuite.candidate_count,
    merge_policy: {
      merge_target: 'generated/expansion-candidates.json',
      require_two_reviews_per_item: true,
      disagreement_resolution_required: true,
      gold_promotion_allowed_before_merge: false,
      reviewer_fields_only: true,
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
    workbook.path,
  ])

  return `# Hard Grounded Research Expansion Review Workbooks

This generated index creates independent review workbooks for machine expansion candidates. These workbooks are separate from pilot adjudication and do not promote candidates to gold.

## Merge Policy

- Merge target: ${index.merge_policy.merge_target}
- Require two reviews per item: ${index.merge_policy.require_two_reviews_per_item}
- Disagreement resolution required: ${index.merge_policy.disagreement_resolution_required}
- Gold promotion allowed before merge: ${index.merge_policy.gold_promotion_allowed_before_merge}
- Reviewers should edit reviewer fields only: ${index.merge_policy.reviewer_fields_only}
- Workbook count: ${index.workbook_count}
- Total review rows: ${index.total_review_rows}
- Candidate count: ${index.candidate_count}

## Workbooks

${markdownTable(['Workbook', 'Category', 'Reviewer slot', 'Rows', 'Path'], rows)}
`
}

const index = buildWorkbooks(readJson(candidatesPath), readJson(rubricsPath))
writeJson(indexPath, index)
writeText(reportPath, renderReport(index))

console.log(`Wrote hard grounded expansion review workbook index to ${indexPath}`)
console.log(`Wrote hard grounded expansion review workbook report to ${reportPath}`)
