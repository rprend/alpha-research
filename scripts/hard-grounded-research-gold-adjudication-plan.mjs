import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'gold-adjudication-plan.json')
const planMarkdownPath = join(experimentDir, 'GOLD_ADJUDICATION_PLAN.md')

const inputs = {
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  reviewMerge: join(generatedDir, 'review-merge-report.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
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

function buildPlan({
  pilotSuite,
  goldSummary,
  reviewMerge,
  adjudicationReadiness,
  reviewCollectionTracker,
  annotationQualityControl,
  releaseGate,
}) {
  const itemSummaries = new Map((reviewMerge.item_summaries || []).map((item) => [item.item_id, item]))
  const pilotPackets = reviewCollectionTracker.packets.filter((packet) => packet.scope === 'pilot_review')
  const gates = ['review_preflight_ready', 'review_merge_ready', 'gold_review_complete'].map((id) => releaseCheck(releaseGate, id))
  const items = pilotSuite.items.map((item) => {
    const summary = itemSummaries.get(item.id)
    const status = summary?.merge_status || 'awaiting_double_review'
    return {
      item_id: item.id,
      category: item.category,
      construction: item.construction,
      transform: item.transform,
      review_status: item.review_status,
      expected_answer_present: item.expected_answer !== undefined && item.expected_answer !== null,
      scoring_focus: item.scoring_focus || [],
      source_dataset_ids: [...new Set((item.source_examples || []).map((source) => source.source_dataset))],
      completed_reviews: summary?.completed_reviews || 0,
      missing_reviews: Math.max(0, 2 - (summary?.completed_reviews || 0)),
      merge_status: status,
      adjudication_status:
        status === 'merge_ready'
          ? 'ready_for_gold_promotion'
          : summary?.completed_reviews > 1
            ? 'needs_adjudicator_resolution'
            : 'awaiting_reviewer_returns',
      required_adjudicator_fields: [
        'final_label',
        'final_answer',
        'required_citation_ids',
        'insufficient_or_conflicting_evidence',
        'notes',
      ],
    }
  })
  const byCategory = Object.fromEntries([...new Set(items.map((item) => item.category))].map((category) => {
    const scoped = items.filter((item) => item.category === category)
    return [category, {
      items: scoped.length,
      completed_reviews: scoped.reduce((sum, item) => sum + item.completed_reviews, 0),
      missing_reviews: scoped.reduce((sum, item) => sum + item.missing_reviews, 0),
      promotion_ready_items: scoped.filter((item) => item.adjudication_status === 'ready_for_gold_promotion').length,
    }]
  }))
  const checks = [
    {
      id: 'pilot_items_loaded',
      passed: items.length === goldSummary.total_items && items.length === 30,
      detail: `${items.length}/${goldSummary.total_items} pilot items planned`,
    },
    {
      id: 'all_categories_covered',
      passed: Object.keys(byCategory).length === 10 && Object.values(byCategory).every((row) => row.items === 3),
      detail: `${Object.keys(byCategory).length} categories; ${Object.values(byCategory).map((row) => row.items).join('/')} items per category`,
    },
    {
      id: 'review_collection_linked',
      passed: reviewCollectionTracker.review_collection_tracker_ready === true && pilotPackets.length === 10,
      detail: `${pilotPackets.length} pilot return packets; ${reviewCollectionTracker.summary.pilot_missing_packets} missing`,
    },
    {
      id: 'quality_controls_linked',
      passed:
        annotationQualityControl.annotation_quality_control_ready === true &&
        annotationQualityControl.thresholds?.required_reviews_per_item === 2,
      detail: `${annotationQualityControl.thresholds?.required_reviews_per_item ?? 'unknown'} required reviews per item`,
    },
    {
      id: 'gold_promotion_still_blocked',
      passed: goldSummary.gold_ready === false && gates.some((gate) => gate.id === 'gold_review_complete' && gate.passed === false),
      detail: `${goldSummary.valid_reviewed_items}/${goldSummary.total_items} valid reviewed items`,
    },
  ]

  return {
    gold_adjudication_plan_ready: checks.every((check) => check.passed),
    version: 'gold-adjudication-plan-v1',
    completion_claim_allowed: false,
    generated_from: {
      pilot_suite: 'generated/pilot-suite.json',
      gold_summary: 'generated/gold-suite-summary.json',
      review_merge: 'generated/review-merge-report.json',
      adjudication_readiness: 'generated/adjudication-readiness.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    gates: gates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    by_category: byCategory,
    items,
    adjudication_steps: [
      'Collect both reviewer returns for every pilot item using REVIEW_COLLECTION_TRACKER.md.',
      'Run annotation import dry-run and apply only after immutable fields and reviewer fields validate.',
      'Regenerate pilot review preflight and review merge.',
      'For every disagreement or invalid merge, fill required adjudicator fields before promotion.',
      'Regenerate gold summary and release gate; only promote when all 30 pilot items are valid reviewed items.',
    ],
    summary: {
      pilot_items: items.length,
      categories: Object.keys(byCategory).length,
      completed_reviews: items.reduce((sum, item) => sum + item.completed_reviews, 0),
      missing_reviews: items.reduce((sum, item) => sum + item.missing_reviews, 0),
      promotion_ready_items: items.filter((item) => item.adjudication_status === 'ready_for_gold_promotion').length,
      pilot_return_packets: pilotPackets.length,
      pilot_missing_packets: reviewCollectionTracker.summary.pilot_missing_packets,
      adjudication_queue_items: adjudicationReadiness.summary.adjudication_queue_items,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const checkRows = plan.checks.map((check) => [check.id, String(check.passed), check.detail])
  const gateRows = plan.gates.map((gate) => [gate.id, gate.passed ? 'yes' : 'no', gate.detail, gate.blocker])
  const categoryRows = Object.entries(plan.by_category).map(([category, row]) => [
    category,
    String(row.items),
    String(row.completed_reviews),
    String(row.missing_reviews),
    String(row.promotion_ready_items),
  ])
  const itemRows = plan.items.map((item) => [
    item.item_id,
    item.category,
    String(item.completed_reviews),
    String(item.missing_reviews),
    item.adjudication_status,
    item.scoring_focus.join('<br>'),
  ])
  const stepRows = plan.adjudication_steps.map((step, index) => [String(index + 1), step])

  return `# Hard Grounded Research Gold Adjudication Plan

This generated plan turns the pilot gold blocker into item-level adjudication work. It does not synthesize labels, adjudicate empty reviews, promote gold, or clear the release gate.

## Summary

- Plan ready: ${plan.gold_adjudication_plan_ready}
- Version: ${plan.version}
- Pilot items: ${plan.summary.pilot_items}
- Categories: ${plan.summary.categories}
- Completed reviews: ${plan.summary.completed_reviews}
- Missing reviews: ${plan.summary.missing_reviews}
- Promotion-ready items: ${plan.summary.promotion_ready_items}
- Pilot return packets: ${plan.summary.pilot_return_packets}
- Pilot missing packets: ${plan.summary.pilot_missing_packets}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Blocking Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Required action'], gateRows)}

## Category Coverage

${markdownTable(['Category', 'Items', 'Completed reviews', 'Missing reviews', 'Promotion-ready items'], categoryRows)}

## Adjudication Steps

${markdownTable(['#', 'Step'], stepRows)}

## Item Plan

${markdownTable(['Item', 'Category', 'Completed reviews', 'Missing reviews', 'Adjudication status', 'Scoring focus'], itemRows)}
`
}

const plan = buildPlan({
  pilotSuite: readJson(inputs.pilotSuite),
  goldSummary: readJson(inputs.goldSummary),
  reviewMerge: readJson(inputs.reviewMerge),
  adjudicationReadiness: readJson(inputs.adjudicationReadiness),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded gold adjudication plan to ${planJsonPath}`)
console.log(`Wrote hard grounded gold adjudication plan report to ${planMarkdownPath}`)
