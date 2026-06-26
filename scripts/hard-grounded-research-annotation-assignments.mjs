import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reviewOperationsPath = join(generatedDir, 'review-operations.json')
const reviewTriagePath = join(generatedDir, 'review-triage.json')
const reviewPreflightPath = join(generatedDir, 'review-preflight.json')
const expansionReviewPreflightPath = join(generatedDir, 'expansion-review-preflight.json')
const assignmentsJsonPath = join(generatedDir, 'annotation-assignments.json')
const assignmentsMarkdownPath = join(experimentDir, 'ANNOTATION_ASSIGNMENTS.md')

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

function pilotWorkbookByItem(reviewPreflight) {
  const byItem = new Map()
  for (const workbook of reviewPreflight.workbook_summaries || []) {
    for (const item of workbook.next_items || []) {
      const current = byItem.get(item.item_id) || []
      current.push({
        workbook_id: workbook.workbook_id,
        reviewer_slot: workbook.reviewer_slot,
        category: workbook.category,
      })
      byItem.set(item.item_id, current)
    }
  }
  return byItem
}

function pilotAssignments(reviewPreflight, reviewTriage) {
  const byItem = pilotWorkbookByItem(reviewPreflight)
  const topItems = reviewTriage.triage_items
    .filter((item) => item.review_priority === 'urgent' || item.review_priority === 'high')
    .slice(0, 12)

  return topItems.map((item, index) => ({
    wave_id: index < 6 ? 'pilot_triage_wave_1' : 'pilot_triage_wave_2',
    assignment_id: `pilot_triage_${String(index + 1).padStart(2, '0')}`,
    scope: 'pilot_review',
    item_id: item.item_id,
    category: item.category,
    priority: item.review_priority,
    priority_score: item.priority_score,
    signals: item.signals,
    reviewer_workbooks: byItem.get(item.item_id) || [],
    completion_gate: 'Both reviewer workbooks must complete required fields before pilot merge.',
  }))
}

function expansionAssignments(expansionReviewPreflight) {
  const categoryBuckets = new Map()
  for (const workbook of expansionReviewPreflight.workbook_summaries || []) {
    if (workbook.incomplete_rows === 0) continue
    const current = categoryBuckets.get(workbook.category) || []
    current.push(workbook)
    categoryBuckets.set(workbook.category, current)
  }

  const assignments = []
  let counter = 1
  for (const [category, workbooks] of [...categoryBuckets.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const reviewerA = workbooks.find((workbook) => workbook.reviewer_slot === 'reviewer_a') || workbooks[0]
    const reviewerB = workbooks.find((workbook) => workbook.reviewer_slot === 'reviewer_b') || workbooks[1] || workbooks[0]
    const selected = [reviewerA, reviewerB].filter(Boolean)
    assignments.push({
      wave_id: 'expansion_balance_wave_1',
      assignment_id: `expansion_balance_${String(counter).padStart(2, '0')}`,
      scope: 'expansion_review',
      category,
      reviewer_workbooks: selected.map((workbook) => ({
        workbook_id: workbook.workbook_id,
        reviewer_slot: workbook.reviewer_slot,
        incomplete_rows: workbook.incomplete_rows,
        next_item_ids: workbook.next_items.map((item) => item.item_id).slice(0, 5),
      })),
      target_rows: selected.reduce((sum, workbook) => sum + Math.min(5, workbook.incomplete_rows), 0),
      completion_gate: 'Complete category_fit, generation_defect, final_label, final_answer, citation fields, notes, and confidence for assigned rows.',
    })
    counter += 1
  }
  return assignments
}

function buildAssignments({ reviewOperations, reviewTriage, reviewPreflight, expansionReviewPreflight }) {
  const pilot = pilotAssignments(reviewPreflight, reviewTriage)
  const expansion = expansionAssignments(expansionReviewPreflight)
  const waves = [
    {
      wave_id: 'pilot_triage_wave_1',
      purpose: 'Review the six highest model-failure pilot items first.',
      assignment_count: pilot.filter((assignment) => assignment.wave_id === 'pilot_triage_wave_1').length,
    },
    {
      wave_id: 'pilot_triage_wave_2',
      purpose: 'Review the next six model-failure pilot items after wave 1 completes.',
      assignment_count: pilot.filter((assignment) => assignment.wave_id === 'pilot_triage_wave_2').length,
    },
    {
      wave_id: 'expansion_balance_wave_1',
      purpose: 'Start paper-scale expansion review with one balanced assignment per category.',
      assignment_count: expansion.length,
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_review_operations: 'generated/review-operations.json',
    source_review_triage: 'generated/review-triage.json',
    source_review_preflight: 'generated/review-preflight.json',
    source_expansion_review_preflight: 'generated/expansion-review-preflight.json',
    assignment_plan_ready: reviewOperations.review_operations_ready && reviewTriage.review_triage_ready,
    reviewer_fields_only: true,
    pilot_assignments: pilot,
    expansion_assignments: expansion,
    waves,
    totals: {
      pilot_assignment_count: pilot.length,
      expansion_assignment_count: expansion.length,
      expansion_target_rows: expansion.reduce((sum, assignment) => sum + assignment.target_rows, 0),
      pilot_review_rows_remaining: reviewPreflight.incomplete_review_rows,
      expansion_review_rows_remaining: expansionReviewPreflight.incomplete_review_rows,
    },
  }
}

function renderMarkdown(plan) {
  const waveRows = plan.waves.map((wave) => [wave.wave_id, wave.purpose, String(wave.assignment_count)])
  const pilotRows = plan.pilot_assignments.map((assignment) => [
    assignment.assignment_id,
    assignment.wave_id,
    assignment.item_id,
    assignment.category,
    assignment.priority,
    String(assignment.priority_score),
    assignment.reviewer_workbooks.map((workbook) => workbook.workbook_id).join('<br>'),
  ])
  const expansionRows = plan.expansion_assignments.map((assignment) => [
    assignment.assignment_id,
    assignment.category,
    String(assignment.target_rows),
    assignment.reviewer_workbooks.map((workbook) => `${workbook.workbook_id} (${workbook.next_item_ids.join(', ')})`).join('<br>'),
  ])

  return `# Hard Grounded Research Annotation Assignments

This generated plan converts review preflights and model-failure triage into concrete annotation waves. It does not fill reviewer fields, adjudicate disagreements, or promote gold; it defines the first review execution path.

## Summary

- Assignment plan ready: ${plan.assignment_plan_ready}
- Reviewer fields only: ${plan.reviewer_fields_only}
- Pilot assignments: ${plan.totals.pilot_assignment_count}
- Expansion assignments: ${plan.totals.expansion_assignment_count}
- Expansion target rows in first balanced wave: ${plan.totals.expansion_target_rows}
- Pilot review rows remaining: ${plan.totals.pilot_review_rows_remaining}
- Expansion review rows remaining: ${plan.totals.expansion_review_rows_remaining}

## Waves

${markdownTable(['Wave', 'Purpose', 'Assignments'], waveRows)}

## Pilot Triage Assignments

${markdownTable(['Assignment', 'Wave', 'Item', 'Category', 'Priority', 'Score', 'Reviewer workbooks'], pilotRows)}

## Expansion Balance Assignments

${markdownTable(['Assignment', 'Category', 'Target rows', 'Reviewer workbooks and first rows'], expansionRows)}
`
}

for (const path of [reviewOperationsPath, reviewTriagePath, reviewPreflightPath, expansionReviewPreflightPath]) {
  if (!existsSync(path)) throw new Error(`Missing annotation assignment input: ${path}`)
}

const assignments = buildAssignments({
  reviewOperations: readJson(reviewOperationsPath),
  reviewTriage: readJson(reviewTriagePath),
  reviewPreflight: readJson(reviewPreflightPath),
  expansionReviewPreflight: readJson(expansionReviewPreflightPath),
})
writeJson(assignmentsJsonPath, assignments)
writeText(assignmentsMarkdownPath, renderMarkdown(assignments))

console.log(`Wrote hard grounded annotation assignments JSON to ${assignmentsJsonPath}`)
console.log(`Wrote hard grounded annotation assignments report to ${assignmentsMarkdownPath}`)
