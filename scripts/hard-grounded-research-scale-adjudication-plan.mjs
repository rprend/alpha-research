import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'scale-adjudication-plan.json')
const planMarkdownPath = join(experimentDir, 'SCALE_ADJUDICATION_PLAN.md')

const inputs = {
  scalePlan: join(generatedDir, 'scale-plan.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  expansionReviewMerge: join(generatedDir, 'expansion-review-merge-report.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || {
    id,
    passed: false,
    detail: 'missing release check',
    blocker: 'missing release check',
  }
}

function batchNumber(batchId) {
  const match = String(batchId).match(/(\d+)$/)
  return match ? Number(match[1]) : 0
}

function buildPlan({
  scalePlan,
  powerPlan,
  expansionReviewPreflight,
  expansionReviewMerge,
  reviewCollectionTracker,
  sourceAcquisitionCandidates,
  releaseGate,
}) {
  const itemSummaries = expansionReviewMerge.item_summaries || []
  const firstWavePackets = reviewCollectionTracker.packets.filter((packet) => packet.scope === 'expansion_review')
  const firstWaveBatchIds = new Set(firstWavePackets.map((packet) => packet.expected_return_file.match(/hgr_scale_batch_\d+/)?.[0]).filter(Boolean))
  const byCategory = Object.fromEntries(scalePlan.expansion_batches.reduce((entries, batch) => {
    const current = entries.get(batch.category) || {
      category: batch.category,
      batches: 0,
      candidate_items: 0,
      review_rows_required: 0,
      first_wave_batches: 0,
      merge_ready_items: 0,
      missing_reviews: 0,
      source_datasets: new Set(),
    }
    const summaries = itemSummaries.filter((item) => item.category === batch.category && item.item_id.startsWith(batch.batch_id))
    current.batches += 1
    current.candidate_items += batch.target_new_items
    current.review_rows_required += batch.review_rows_required
    current.first_wave_batches += firstWaveBatchIds.has(batch.batch_id) ? 1 : 0
    current.merge_ready_items += summaries.filter((item) => item.completed_reviews >= 2 && item.missing_reviews === 0 && !item.has_disagreement).length
    current.missing_reviews += summaries.reduce((sum, item) => sum + item.missing_reviews, 0)
    for (const dataset of batch.source_datasets || []) current.source_datasets.add(dataset)
    entries.set(batch.category, current)
    return entries
  }, new Map()).entries())
  const categoryRows = Object.fromEntries(Object.entries(byCategory).map(([category, row]) => [
    category,
    {
      ...row,
      source_datasets: [...row.source_datasets],
      target_reviewed_items: powerPlan.assumptions.target_reviewed_items_per_category,
      current_merge_ready_items: row.merge_ready_items,
      remaining_items_to_scale_target: Math.max(0, powerPlan.assumptions.target_reviewed_items_per_category - row.merge_ready_items),
    },
  ]))
  const batchPlans = scalePlan.expansion_batches.map((batch) => {
    const summaries = itemSummaries.filter((item) => item.item_id.startsWith(batch.batch_id))
    const missingReviews = summaries.reduce((sum, item) => sum + item.missing_reviews, 0)
    return {
      batch_id: batch.batch_id,
      category: batch.category,
      batch_number: batchNumber(batch.batch_id),
      target_new_items: batch.target_new_items,
      review_rows_required: batch.review_rows_required,
      first_wave_exported: firstWaveBatchIds.has(batch.batch_id),
      source_datasets: batch.source_datasets,
      completed_reviews: summaries.reduce((sum, item) => sum + item.completed_reviews, 0),
      missing_reviews: missingReviews || batch.review_rows_required,
      merge_ready_items: summaries.filter((item) => item.completed_reviews >= 2 && item.missing_reviews === 0 && !item.has_disagreement).length,
      adjudication_status:
        missingReviews === 0 && summaries.length > 0
          ? 'ready_for_merge_or_resolution'
          : firstWaveBatchIds.has(batch.batch_id)
            ? 'awaiting_first_wave_returns'
            : 'awaiting_later_wave_export',
      required_adjudicator_fields: [
        'final_label',
        'final_answer',
        'required_citation_ids',
        'insufficient_or_conflicting_evidence',
        'category_fit',
        'generation_defect',
        'notes',
      ],
    }
  })
  const gates = ['expansion_review_preflight_ready', 'expansion_review_merge_ready', 'category_scale_ready'].map((id) => releaseCheck(releaseGate, id))
  const checks = [
    {
      id: 'scale_batches_loaded',
      passed: batchPlans.length === scalePlan.expansion_batch_count && batchPlans.length === 30,
      detail: `${batchPlans.length}/${scalePlan.expansion_batch_count} scale batches planned`,
    },
    {
      id: 'category_targets_loaded',
      passed:
        Object.keys(categoryRows).length === scalePlan.category_count &&
        Object.values(categoryRows).every((row) => row.target_reviewed_items === scalePlan.target_reviewed_items_per_category),
      detail: `${Object.keys(categoryRows).length}/${scalePlan.category_count} categories; target=${scalePlan.target_reviewed_items_per_category}`,
    },
    {
      id: 'review_workload_matches_scale_plan',
      passed:
        expansionReviewPreflight.candidate_count === scalePlan.planned_new_items &&
        expansionReviewPreflight.total_review_rows === scalePlan.planned_review_rows,
      detail: `${expansionReviewPreflight.candidate_count}/${scalePlan.planned_new_items} candidates; ${expansionReviewPreflight.total_review_rows}/${scalePlan.planned_review_rows} review rows`,
    },
    {
      id: 'first_wave_collection_linked',
      passed: firstWavePackets.length === 20 && reviewCollectionTracker.summary.expansion_missing_packets === 20,
      detail: `${firstWavePackets.length} first-wave expansion packets; ${reviewCollectionTracker.summary.expansion_missing_packets} missing`,
    },
    {
      id: 'source_acquisition_gap_visible',
      passed: sourceAcquisitionCandidates.summary?.candidates > 0 || sourceAcquisitionCandidates.candidates > 0,
      detail: `${sourceAcquisitionCandidates.summary?.candidates ?? sourceAcquisitionCandidates.candidates} source-acquisition candidates tracked separately`,
    },
    {
      id: 'scale_promotion_still_blocked',
      passed: scalePlan.scale_ready === false && gates.some((gate) => gate.id === 'category_scale_ready' && gate.passed === false),
      detail: `${scalePlan.current_valid_reviewed_items}/${scalePlan.total_target_reviewed_items} reviewed target items`,
    },
  ]

  return {
    scale_adjudication_plan_ready: checks.every((check) => check.passed),
    version: 'scale-adjudication-plan-v1',
    completion_claim_allowed: false,
    generated_from: {
      scale_plan: 'generated/scale-plan.json',
      power_plan: 'generated/power-plan.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge: 'generated/expansion-review-merge-report.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    gates: gates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    by_category: categoryRows,
    batches: batchPlans,
    adjudication_steps: [
      'Collect first-wave expansion return packets and import only after dry-run validation is clean.',
      'Export or collect later-wave expansion batches until every category has 30 reviewed target items.',
      'Run expansion preflight and merge after each wave; adjudicate disagreements with category_fit and generation_defect fields.',
      'Regenerate scale plan, power plan, review progress, paper tables, and release gate after each applied review wave.',
      'Keep category-level paper claims blocked until category_scale_ready and novelty_audit_final both pass.',
    ],
    summary: {
      expansion_batches: batchPlans.length,
      categories: Object.keys(categoryRows).length,
      planned_new_items: scalePlan.planned_new_items,
      planned_review_rows: scalePlan.planned_review_rows,
      complete_review_rows: expansionReviewPreflight.complete_review_rows,
      missing_review_rows: expansionReviewPreflight.incomplete_review_rows,
      merge_ready_items: expansionReviewMerge.merge_ready_items,
      first_wave_expansion_packets: firstWavePackets.length,
      first_wave_expansion_missing_packets: reviewCollectionTracker.summary.expansion_missing_packets,
      source_acquisition_candidates: sourceAcquisitionCandidates.summary?.candidates ?? sourceAcquisitionCandidates.candidates,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const checkRows = plan.checks.map((check) => [check.id, String(check.passed), check.detail])
  const gateRows = plan.gates.map((gate) => [gate.id, gate.passed ? 'yes' : 'no', gate.detail, gate.blocker])
  const categoryRows = Object.entries(plan.by_category).map(([category, row]) => [
    category,
    String(row.batches),
    String(row.candidate_items),
    String(row.review_rows_required),
    String(row.first_wave_batches),
    String(row.current_merge_ready_items),
    String(row.remaining_items_to_scale_target),
    row.source_datasets.join('<br>'),
  ])
  const batchRows = plan.batches.map((batch) => [
    batch.batch_id,
    batch.category,
    String(batch.target_new_items),
    String(batch.review_rows_required),
    batch.first_wave_exported ? 'yes' : 'no',
    String(batch.missing_reviews),
    batch.adjudication_status,
  ])
  const stepRows = plan.adjudication_steps.map((step, index) => [String(index + 1), step])

  return `# Hard Grounded Research Scale Adjudication Plan

This generated plan turns the category-scale blocker into batch-level adjudication work. It does not synthesize labels, complete expansion review, promote scaled gold, or clear category-level claims.

## Summary

- Plan ready: ${plan.scale_adjudication_plan_ready}
- Version: ${plan.version}
- Expansion batches: ${plan.summary.expansion_batches}
- Categories: ${plan.summary.categories}
- Planned new items: ${plan.summary.planned_new_items}
- Planned review rows: ${plan.summary.planned_review_rows}
- Complete review rows: ${plan.summary.complete_review_rows}
- Missing review rows: ${plan.summary.missing_review_rows}
- Merge-ready items: ${plan.summary.merge_ready_items}
- First-wave expansion packets: ${plan.summary.first_wave_expansion_packets}
- First-wave expansion missing packets: ${plan.summary.first_wave_expansion_missing_packets}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Blocking Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Required action'], gateRows)}

## Category Scale Plan

${markdownTable(['Category', 'Batches', 'Candidate items', 'Review rows', 'First-wave batches', 'Merge-ready', 'Remaining to target', 'Source datasets'], categoryRows)}

## Adjudication Steps

${markdownTable(['#', 'Step'], stepRows)}

## Batch Plan

${markdownTable(['Batch', 'Category', 'Items', 'Review rows', 'First wave', 'Missing reviews', 'Status'], batchRows)}
`
}

const plan = buildPlan({
  scalePlan: readJson(inputs.scalePlan),
  powerPlan: readJson(inputs.powerPlan),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  expansionReviewMerge: readJson(inputs.expansionReviewMerge),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded scale adjudication plan to ${planJsonPath}`)
console.log(`Wrote hard grounded scale adjudication plan report to ${planMarkdownPath}`)
