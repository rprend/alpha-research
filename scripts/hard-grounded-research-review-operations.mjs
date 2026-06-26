import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reviewPreflightPath = join(generatedDir, 'review-preflight.json')
const reviewMergePath = join(generatedDir, 'review-merge-report.json')
const expansionReviewPreflightPath = join(generatedDir, 'expansion-review-preflight.json')
const expansionReviewMergePath = join(generatedDir, 'expansion-review-merge-report.json')
const operationsJsonPath = join(generatedDir, 'review-operations.json')
const operationsMarkdownPath = join(experimentDir, 'REVIEW_OPERATIONS.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function missingFieldCounts(workbooks) {
  const counts = new Map()
  for (const workbook of workbooks) {
    for (const item of workbook.next_items || []) {
      for (const field of item.missing_fields || []) {
        counts.set(field, (counts.get(field) || 0) + 1)
      }
    }
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])))
}

function categoryRowsFromPreflight(preflight) {
  if (preflight.by_category) {
    return Object.entries(preflight.by_category).map(([category, summary]) => ({
      category,
      review_rows: summary.review_rows,
      complete_rows: summary.complete_rows,
      incomplete_rows: summary.incomplete_rows,
    }))
  }

  const byCategory = new Map()
  for (const workbook of preflight.workbook_summaries || []) {
    const current = byCategory.get(workbook.category) || {
      category: workbook.category,
      review_rows: 0,
      complete_rows: 0,
      incomplete_rows: 0,
    }
    current.review_rows += workbook.item_count
    current.complete_rows += workbook.complete_rows
    current.incomplete_rows += workbook.incomplete_rows
    byCategory.set(workbook.category, current)
  }
  return [...byCategory.values()]
}

function nextWorkBatches(preflight, kind) {
  return (preflight.workbook_summaries || [])
    .filter((workbook) => workbook.incomplete_rows > 0)
    .map((workbook) => ({
      kind,
      workbook_id: workbook.workbook_id,
      reviewer_slot: workbook.reviewer_slot,
      category: workbook.category,
      incomplete_rows: workbook.incomplete_rows,
      suggested_batch_size: Math.min(10, workbook.incomplete_rows),
      next_item_ids: (workbook.next_items || []).map((item) => item.item_id).slice(0, 10),
    }))
    .sort((left, right) => right.incomplete_rows - left.incomplete_rows || left.workbook_id.localeCompare(right.workbook_id))
}

function buildOperations({ reviewPreflight, reviewMerge, expansionReviewPreflight, expansionReviewMerge }) {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    sources: {
      review_preflight: 'generated/review-preflight.json',
      review_merge: 'generated/review-merge-report.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge: 'generated/expansion-review-merge-report.json',
    },
    review_operations_ready: true,
    pilot_review: {
      total_review_rows: reviewPreflight.total_review_rows,
      complete_review_rows: reviewPreflight.complete_review_rows,
      incomplete_review_rows: reviewPreflight.incomplete_review_rows,
      merge_ready_items: reviewMerge.merge_ready_items,
      disagreement_items: reviewMerge.disagreement_items,
      categories: categoryRowsFromPreflight(reviewPreflight),
      missing_field_counts_from_next_items: missingFieldCounts(reviewPreflight.workbook_summaries || []),
    },
    expansion_review: {
      total_review_rows: expansionReviewPreflight.total_review_rows,
      complete_review_rows: expansionReviewPreflight.complete_review_rows,
      incomplete_review_rows: expansionReviewPreflight.incomplete_review_rows,
      merge_ready_items: expansionReviewMerge.merge_ready_items,
      disagreement_items: expansionReviewMerge.disagreement_items,
      categories: categoryRowsFromPreflight(expansionReviewPreflight),
      missing_field_counts_from_next_items: missingFieldCounts(expansionReviewPreflight.workbook_summaries || []),
    },
    next_work_batches: [
      ...nextWorkBatches(reviewPreflight, 'pilot_review'),
      ...nextWorkBatches(expansionReviewPreflight, 'expansion_review'),
    ],
    readiness: {
      review_preflight_ready: reviewPreflight.preflight_ready,
      review_merge_ready: reviewMerge.merge_ready,
      expansion_review_preflight_ready: expansionReviewPreflight.preflight_ready,
      expansion_review_merge_ready: expansionReviewMerge.merge_ready,
      review_operations_ready: true,
    },
  }
}

function renderMarkdown(operations) {
  const categoryRows = [
    ...operations.pilot_review.categories.map((category) => [
      'pilot',
      category.category,
      String(category.complete_rows),
      String(category.review_rows),
      String(category.incomplete_rows),
    ]),
    ...operations.expansion_review.categories.map((category) => [
      'expansion',
      category.category,
      String(category.complete_rows),
      String(category.review_rows),
      String(category.incomplete_rows),
    ]),
  ]
  const batchRows = operations.next_work_batches.slice(0, 40).map((batch) => [
    batch.kind,
    batch.workbook_id,
    batch.category,
    batch.reviewer_slot,
    String(batch.incomplete_rows),
    String(batch.suggested_batch_size),
    batch.next_item_ids.join('<br>'),
  ])

  return `# Hard Grounded Research Review Operations

This generated packet turns the pilot and expansion review preflights into an operations queue. It does not fill reviewer fields or promote gold; it identifies the exact rows and workbooks that must be completed before merge and paper claims.

## Summary

- Pilot review rows: ${operations.pilot_review.complete_review_rows}/${operations.pilot_review.total_review_rows}
- Expansion review rows: ${operations.expansion_review.complete_review_rows}/${operations.expansion_review.total_review_rows}
- Pilot merge-ready items: ${operations.pilot_review.merge_ready_items}
- Expansion merge-ready items: ${operations.expansion_review.merge_ready_items}
- Review operations ready: ${operations.review_operations_ready}

## Category Progress

${markdownTable(['Scope', 'Category', 'Complete rows', 'Total rows', 'Incomplete rows'], categoryRows)}

## Next Work Batches

${batchRows.length ? markdownTable(['Scope', 'Workbook', 'Category', 'Reviewer', 'Incomplete rows', 'Suggested batch size', 'Next item ids'], batchRows) : 'All review rows are complete.'}
`
}

for (const path of [reviewPreflightPath, reviewMergePath, expansionReviewPreflightPath, expansionReviewMergePath]) {
  if (!existsSync(path)) throw new Error(`Missing review operations input: ${path}`)
}

const operations = buildOperations({
  reviewPreflight: readJson(reviewPreflightPath),
  reviewMerge: readJson(reviewMergePath),
  expansionReviewPreflight: readJson(expansionReviewPreflightPath),
  expansionReviewMerge: readJson(expansionReviewMergePath),
})

writeJson(operationsJsonPath, operations)
writeText(operationsMarkdownPath, renderMarkdown(operations))

console.log(`Wrote hard grounded review operations JSON to ${operationsJsonPath}`)
console.log(`Wrote hard grounded review operations report to ${operationsMarkdownPath}`)
