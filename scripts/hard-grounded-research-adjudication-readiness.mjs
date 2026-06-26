import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'adjudication-readiness.json')
const reportMarkdownPath = join(experimentDir, 'ADJUDICATION_READINESS.md')

const inputs = {
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  adjudicationSummary: join(generatedDir, 'adjudication-summary.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  reviewMerge: join(generatedDir, 'review-merge-report.json'),
  reviewResolutionQueue: join(generatedDir, 'review-resolution-queue.jsonl'),
  expansionReviewMerge: join(generatedDir, 'expansion-review-merge-report.json'),
  expansionReviewResolutionQueue: join(generatedDir, 'expansion-review-resolution-queue.jsonl'),
}

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

function summarizeTrack({ track, mergeReport, resolutionQueue, requiredFields, extraFields = [] }) {
  const queueStatus =
    resolutionQueue.length === 0 && mergeReport.completed_reviews === 0
      ? 'empty_before_review'
      : resolutionQueue.length === 0
        ? 'empty_after_current_merge'
        : 'needs_adjudication'

  return {
    track,
    unique_items: mergeReport.unique_items,
    completed_reviews: mergeReport.completed_reviews,
    merge_ready_items: mergeReport.merge_ready_items,
    merge_ready: Boolean(mergeReport.merge_ready),
    missing_review_items: mergeReport.missing_review_items,
    disagreement_items: mergeReport.disagreement_items,
    resolution_queue_count: resolutionQueue.length,
    resolution_queue_status: queueStatus,
    required_adjudicator_fields: [...requiredFields, ...extraFields],
  }
}

function buildReadiness({
  goldSummary,
  adjudicationSummary,
  reviewProgress,
  reviewMerge,
  reviewResolutionQueue,
  expansionReviewMerge,
  expansionReviewResolutionQueue,
}) {
  const baseFields = [
    'final_label',
    'final_answer',
    'required_citation_ids',
    'insufficient_or_conflicting_evidence',
    'notes',
  ]
  const pilot = summarizeTrack({
    track: 'pilot_gold',
    mergeReport: reviewMerge,
    resolutionQueue: reviewResolutionQueue,
    requiredFields: baseFields,
  })
  const expansion = summarizeTrack({
    track: 'scaled_expansion',
    mergeReport: expansionReviewMerge,
    resolutionQueue: expansionReviewResolutionQueue,
    requiredFields: baseFields,
    extraFields: ['category_fit', 'generation_defect'],
  })
  const promotionPreconditions = [
    {
      id: 'pilot_double_review_complete',
      passed: reviewMerge.missing_review_items === 0,
      detail: `${reviewMerge.unique_items - reviewMerge.missing_review_items}/${reviewMerge.unique_items} pilot items have two complete reviews`,
    },
    {
      id: 'pilot_disagreements_resolved',
      passed: reviewMerge.disagreement_items === 0 && reviewResolutionQueue.length === 0,
      detail: `${reviewMerge.disagreement_items} pilot disagreement items; queue=${reviewResolutionQueue.length}`,
    },
    {
      id: 'expansion_double_review_complete',
      passed: expansionReviewMerge.missing_review_items === 0,
      detail: `${expansionReviewMerge.unique_items - expansionReviewMerge.missing_review_items}/${expansionReviewMerge.unique_items} expansion items have two complete reviews`,
    },
    {
      id: 'expansion_disagreements_resolved',
      passed: expansionReviewMerge.disagreement_items === 0 && expansionReviewResolutionQueue.length === 0,
      detail: `${expansionReviewMerge.disagreement_items} expansion disagreement items; queue=${expansionReviewResolutionQueue.length}`,
    },
    {
      id: 'gold_summary_ready',
      passed: Boolean(goldSummary.gold_ready),
      detail: `${goldSummary.valid_reviewed_items}/${goldSummary.total_items} valid reviewed pilot items`,
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    adjudication_readiness_ready: true,
    generated_from: {
      gold_summary: 'generated/gold-suite-summary.json',
      adjudication_summary: 'generated/adjudication-summary.json',
      review_progress: 'generated/review-progress.json',
      review_merge: 'generated/review-merge-report.json',
      review_resolution_queue: 'generated/review-resolution-queue.jsonl',
      expansion_review_merge: 'generated/expansion-review-merge-report.json',
      expansion_review_resolution_queue: 'generated/expansion-review-resolution-queue.jsonl',
    },
    summary: {
      gold_ready: Boolean(goldSummary.gold_ready),
      pilot_reviewed_items: goldSummary.valid_reviewed_items,
      pilot_total_items: goldSummary.total_items,
      pilot_resolution_queue_items: reviewResolutionQueue.length,
      expansion_resolution_queue_items: expansionReviewResolutionQueue.length,
      reviewed_items_remaining: reviewProgress.summary.reviewed_items_remaining,
      adjudication_queue_items: adjudicationSummary.item_count,
      adjudication_queue_reviewed: adjudicationSummary.review_status_counts.reviewed || 0,
    },
    pilot,
    expansion,
    promotion_preconditions: promotionPreconditions,
    release_promotion_allowed: promotionPreconditions.every((condition) => condition.passed),
    next_actions: [
      'Complete independent pilot and expansion reviewer workbooks.',
      'Run strict preflight and merge for both pilot and expansion review tracks.',
      'Resolve any non-empty resolution queue with the required adjudicator fields.',
      'Rerun adjudication and release-gate generators before making paper claims.',
    ],
  }
}

function renderMarkdown(readiness) {
  const trackRows = [readiness.pilot, readiness.expansion].map((track) => [
    track.track,
    `${track.merge_ready_items}/${track.unique_items}`,
    String(track.completed_reviews),
    String(track.missing_review_items),
    String(track.disagreement_items),
    String(track.resolution_queue_count),
    track.resolution_queue_status,
  ])
  const preconditionRows = readiness.promotion_preconditions.map((condition) => [
    condition.id,
    condition.passed ? 'yes' : 'no',
    condition.detail,
  ])
  const fieldRows = [readiness.pilot, readiness.expansion].map((track) => [
    track.track,
    track.required_adjudicator_fields.map((field) => `\`${field}\``).join(', '),
  ])

  return `# Hard Grounded Research Adjudication Readiness

This generated report ties pilot and expansion merge outputs to their resolution queues. Empty queues do not imply adjudication is complete when reviewer workbooks are still blank; they only mean no completed double-review disagreements have been produced yet.

## Summary

- Adjudication readiness report ready: ${readiness.adjudication_readiness_ready}
- Gold ready: ${readiness.summary.gold_ready}
- Pilot resolution queue items: ${readiness.summary.pilot_resolution_queue_items}
- Expansion resolution queue items: ${readiness.summary.expansion_resolution_queue_items}
- Reviewed target items remaining: ${readiness.summary.reviewed_items_remaining}
- Release promotion allowed: ${readiness.release_promotion_allowed}

## Tracks

${markdownTable(['Track', 'Merge-ready items', 'Completed reviews', 'Missing-review items', 'Disagreement items', 'Resolution queue', 'Queue status'], trackRows)}

## Required Adjudicator Fields

${markdownTable(['Track', 'Fields'], fieldRows)}

## Promotion Preconditions

${markdownTable(['Precondition', 'Passed', 'Detail'], preconditionRows)}

## Next Actions

${readiness.next_actions.map((action) => `- ${action}`).join('\n')}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing adjudication readiness input ${name}: ${path}`)
}

const readiness = buildReadiness({
  goldSummary: readJson(inputs.goldSummary),
  adjudicationSummary: readJson(inputs.adjudicationSummary),
  reviewProgress: readJson(inputs.reviewProgress),
  reviewMerge: readJson(inputs.reviewMerge),
  reviewResolutionQueue: readJsonl(inputs.reviewResolutionQueue),
  expansionReviewMerge: readJson(inputs.expansionReviewMerge),
  expansionReviewResolutionQueue: readJsonl(inputs.expansionReviewResolutionQueue),
})

writeJson(reportJsonPath, readiness)
writeText(reportMarkdownPath, renderMarkdown(readiness))
console.log(`Wrote hard grounded adjudication readiness to ${reportJsonPath}`)
console.log(`Wrote hard grounded adjudication readiness report to ${reportMarkdownPath}`)
