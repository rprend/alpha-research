import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const progressJsonPath = join(generatedDir, 'review-progress.json')
const progressMarkdownPath = join(experimentDir, 'REVIEW_PROGRESS.md')

const inputs = {
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  reviewMerge: join(generatedDir, 'review-merge-report.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  expansionReviewMerge: join(generatedDir, 'expansion-review-merge-report.json'),
  reviewOperations: join(generatedDir, 'review-operations.json'),
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  scalePlan: join(generatedDir, 'scale-plan.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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

function percent(numerator, denominator) {
  if (!denominator) return '0.0%'
  return `${((numerator / denominator) * 100).toFixed(1)}%`
}

function categoryRows(preflight, mergeReport) {
  const mergeByCategory = mergeReport.agreement?.by_category || {}
  return Object.entries(preflight.by_category || {}).map(([category, row]) => ({
    category,
    review_rows: row.review_rows,
    complete_rows: row.complete_rows,
    complete_percent: percent(row.complete_rows, row.review_rows),
    merge_ready_items: mergeByCategory[category]?.double_reviewed_items || 0,
    label_agreement_rate: mergeByCategory[category]?.label_agreement_rate,
  }))
}

function expansionCategoryRows(preflight, mergeReport) {
  const categories = new Map()
  for (const workbook of preflight.workbook_summaries || []) {
    const current = categories.get(workbook.category) || {
      category: workbook.category,
      review_rows: 0,
      complete_rows: 0,
    }
    current.review_rows += workbook.item_count
    current.complete_rows += workbook.complete_rows
    categories.set(workbook.category, current)
  }

  const mergeByCategory = {}
  for (const item of mergeReport.item_summaries || []) {
    const current = mergeByCategory[item.category] || { merge_ready_items: 0, total_items: 0 }
    current.total_items += 1
    if (item.completed_reviews === item.assigned_reviews && !item.has_disagreement) {
      current.merge_ready_items += 1
    }
    mergeByCategory[item.category] = current
  }

  return [...categories.values()].map((row) => ({
    ...row,
    complete_percent: percent(row.complete_rows, row.review_rows),
    merge_ready_items: mergeByCategory[row.category]?.merge_ready_items || 0,
  }))
}

function buildProgress({
  reviewPreflight,
  reviewMerge,
  expansionReviewPreflight,
  expansionReviewMerge,
  reviewOperations,
  annotationAssignments,
  reviewerHandoff,
  scalePlan,
}) {
  const pilotRows = categoryRows(reviewPreflight, reviewMerge)
  const expansionRows = expansionCategoryRows(expansionReviewPreflight, expansionReviewMerge)
  const blockers = [
    {
      id: 'pilot_review_preflight',
      cleared: Boolean(reviewPreflight.preflight_ready),
      remaining: reviewPreflight.incomplete_review_rows,
      detail: `${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows} pilot review rows complete`,
    },
    {
      id: 'pilot_review_merge',
      cleared: Boolean(reviewMerge.merge_ready),
      remaining: reviewMerge.missing_review_items + reviewMerge.disagreement_items,
      detail: `${reviewMerge.merge_ready_items}/${reviewMerge.unique_items} pilot items merge-ready`,
    },
    {
      id: 'expansion_review_preflight',
      cleared: Boolean(expansionReviewPreflight.preflight_ready),
      remaining: expansionReviewPreflight.incomplete_review_rows,
      detail: `${expansionReviewPreflight.complete_review_rows}/${expansionReviewPreflight.total_review_rows} expansion review rows complete`,
    },
    {
      id: 'expansion_review_merge',
      cleared: Boolean(expansionReviewMerge.merge_ready),
      remaining: expansionReviewMerge.missing_review_items + expansionReviewMerge.disagreement_items,
      detail: `${expansionReviewMerge.merge_ready_items}/${expansionReviewMerge.unique_items} expansion items merge-ready`,
    },
    {
      id: 'category_scale',
      cleared: Boolean(scalePlan.scale_ready),
      remaining: scalePlan.additional_reviewed_items_needed,
      detail: `${scalePlan.current_valid_reviewed_items}/${scalePlan.total_target_reviewed_items} reviewed target items ready`,
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    review_progress_ready: true,
    generated_from: {
      review_preflight: 'generated/review-preflight.json',
      review_merge: 'generated/review-merge-report.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge: 'generated/expansion-review-merge-report.json',
      review_operations: 'generated/review-operations.json',
      annotation_assignments: 'generated/annotation-assignments.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      scale_plan: 'generated/scale-plan.json',
    },
    summary: {
      pilot_complete_review_rows: reviewPreflight.complete_review_rows,
      pilot_total_review_rows: reviewPreflight.total_review_rows,
      pilot_complete_percent: percent(reviewPreflight.complete_review_rows, reviewPreflight.total_review_rows),
      pilot_merge_ready_items: reviewMerge.merge_ready_items,
      pilot_unique_items: reviewMerge.unique_items,
      expansion_complete_review_rows: expansionReviewPreflight.complete_review_rows,
      expansion_total_review_rows: expansionReviewPreflight.total_review_rows,
      expansion_complete_percent: percent(expansionReviewPreflight.complete_review_rows, expansionReviewPreflight.total_review_rows),
      expansion_merge_ready_items: expansionReviewMerge.merge_ready_items,
      expansion_unique_items: expansionReviewMerge.unique_items,
      target_reviewed_items: scalePlan.total_target_reviewed_items,
      reviewed_items_ready: scalePlan.current_valid_reviewed_items,
      reviewed_items_remaining: scalePlan.additional_reviewed_items_needed,
      first_wave_export_rows: reviewerHandoff.totals.export_rows,
      first_wave_export_files: reviewerHandoff.totals.export_files,
      first_wave_handoff_ready: reviewerHandoff.handoff_ready,
      pilot_assignment_count: annotationAssignments.totals.pilot_assignment_count,
      expansion_assignment_count: annotationAssignments.totals.expansion_assignment_count,
    },
    blockers,
    pilot_by_category: pilotRows,
    expansion_by_category: expansionRows,
    next_work_batches: reviewOperations.next_work_batches.slice(0, 12),
  }
}

function renderMarkdown(progress) {
  const blockerRows = progress.blockers.map((blocker) => [
    blocker.id,
    blocker.cleared ? 'yes' : 'no',
    String(blocker.remaining),
    blocker.detail,
  ])
  const pilotRows = progress.pilot_by_category.map((row) => [
    row.category,
    `${row.complete_rows}/${row.review_rows}`,
    row.complete_percent,
    String(row.merge_ready_items),
    row.label_agreement_rate === null || row.label_agreement_rate === undefined ? 'n/a' : String(row.label_agreement_rate),
  ])
  const expansionRows = progress.expansion_by_category.map((row) => [
    row.category,
    `${row.complete_rows}/${row.review_rows}`,
    row.complete_percent,
    String(row.merge_ready_items),
  ])
  const nextRows = progress.next_work_batches.map((batch) => [
    batch.kind,
    batch.workbook_id,
    batch.reviewer_slot,
    batch.category,
    String(batch.suggested_batch_size),
    batch.next_item_ids.join('<br>'),
  ])

  return `# Hard Grounded Research Review Progress

This generated report tracks human-review progress toward paper release. It is intentionally separate from fixture promotion smoke: fixture checks can prove mechanics, but only completed reviewer workbooks can clear these progress blockers.

## Summary

- Review progress report ready: ${progress.review_progress_ready}
- Pilot review rows complete: ${progress.summary.pilot_complete_review_rows}/${progress.summary.pilot_total_review_rows} (${progress.summary.pilot_complete_percent})
- Pilot merge-ready items: ${progress.summary.pilot_merge_ready_items}/${progress.summary.pilot_unique_items}
- Expansion review rows complete: ${progress.summary.expansion_complete_review_rows}/${progress.summary.expansion_total_review_rows} (${progress.summary.expansion_complete_percent})
- Expansion merge-ready items: ${progress.summary.expansion_merge_ready_items}/${progress.summary.expansion_unique_items}
- Reviewed target items ready: ${progress.summary.reviewed_items_ready}/${progress.summary.target_reviewed_items}
- Reviewed target items remaining: ${progress.summary.reviewed_items_remaining}
- First-wave handoff ready: ${progress.summary.first_wave_handoff_ready}
- First-wave export rows: ${progress.summary.first_wave_export_rows} across ${progress.summary.first_wave_export_files} files
- Pilot assignments: ${progress.summary.pilot_assignment_count}
- Expansion assignments: ${progress.summary.expansion_assignment_count}

## Blocking Progress Gates

${markdownTable(['Gate', 'Cleared', 'Remaining', 'Detail'], blockerRows)}

## Pilot Category Progress

${markdownTable(['Category', 'Complete rows', 'Complete', 'Merge-ready items', 'Label agreement'], pilotRows)}

## Expansion Category Progress

${markdownTable(['Category', 'Complete rows', 'Complete', 'Merge-ready items'], expansionRows)}

## Next Work Batches

${markdownTable(['Kind', 'Workbook', 'Reviewer', 'Category', 'Suggested rows', 'Next items'], nextRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing review progress input ${name}: ${path}`)
}

const progress = buildProgress({
  reviewPreflight: readJson(inputs.reviewPreflight),
  reviewMerge: readJson(inputs.reviewMerge),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  expansionReviewMerge: readJson(inputs.expansionReviewMerge),
  reviewOperations: readJson(inputs.reviewOperations),
  annotationAssignments: readJson(inputs.annotationAssignments),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  scalePlan: readJson(inputs.scalePlan),
})

writeJson(progressJsonPath, progress)
writeText(progressMarkdownPath, renderMarkdown(progress))

console.log(`Wrote hard grounded research review progress JSON to ${progressJsonPath}`)
console.log(`Wrote hard grounded research review progress report to ${progressMarkdownPath}`)
