import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const trackerJsonPath = join(generatedDir, 'review-collection-tracker.json')
const trackerMarkdownPath = join(experimentDir, 'REVIEW_COLLECTION_TRACKER.md')

const inputs = {
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
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

function gateDetail(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || { id, passed: false, detail: 'missing', blocker: 'missing' }
}

function buildTracker({ reviewReturnChecklist, reviewExecutionPlan, reviewProgress, annotationQualityControl, releaseGate }) {
  const packetRows = reviewReturnChecklist.packets.map((packet) => ({
    packet_id: packet.expected_return_file.replace(/\.jsonl$/, ''),
    expected_return_file: packet.expected_return_file,
    scope: packet.scope,
    category: packet.category,
    reviewer_slot: packet.reviewer_slot,
    expected_rows: packet.expected_rows,
    wave_ids: packet.wave_ids,
    priority:
      packet.scope === 'pilot_review'
        ? 'pilot_gold_first'
        : packet.expected_rows >= 5
          ? 'scale_first_wave'
          : 'scale_followup',
    status: packet.present ? 'returned_pending_import' : 'missing_return',
    gate_ids:
      packet.scope === 'pilot_review'
        ? ['review_preflight_ready', 'review_merge_ready', 'gold_review_complete']
        : ['expansion_review_preflight_ready', 'expansion_review_merge_ready', 'category_scale_ready'],
    next_action: packet.present
      ? 'Run the annotation import dry run, then apply only after validation is clean.'
      : 'Collect the exact returned JSONL file named here; do not rename or alter immutable fields.',
  }))
  const missingPackets = packetRows.filter((packet) => packet.status === 'missing_return')
  const returnedPackets = packetRows.filter((packet) => packet.status === 'returned_pending_import')
  const byPriority = Object.fromEntries(['pilot_gold_first', 'scale_first_wave', 'scale_followup'].map((priority) => {
    const packets = packetRows.filter((packet) => packet.priority === priority)
    return [priority, {
      packets: packets.length,
      rows: packets.reduce((sum, packet) => sum + packet.expected_rows, 0),
      missing_packets: packets.filter((packet) => packet.status === 'missing_return').length,
      returned_packets: packets.filter((packet) => packet.status === 'returned_pending_import').length,
    }]
  }))
  const blockingGates = [
    'review_preflight_ready',
    'review_merge_ready',
    'gold_review_complete',
    'expansion_review_preflight_ready',
    'expansion_review_merge_ready',
    'category_scale_ready',
  ].map((id) => gateDetail(releaseGate, id))
  const checks = [
    {
      id: 'return_checklist_ready',
      passed: reviewReturnChecklist.review_return_checklist_ready === true,
      detail: `${reviewReturnChecklist.summary.packets} packets; ${reviewReturnChecklist.summary.expected_rows} first-wave rows`,
    },
    {
      id: 'execution_plan_ready',
      passed: reviewExecutionPlan.review_execution_plan_ready === true,
      detail: `${reviewExecutionPlan.summary.total_rows_remaining} total review rows remaining`,
    },
    {
      id: 'tracker_covers_all_expected_packets',
      passed: packetRows.length === reviewReturnChecklist.summary.packets,
      detail: `${packetRows.length}/${reviewReturnChecklist.summary.packets} packets tracked`,
    },
    {
      id: 'missing_returns_explicit',
      passed: missingPackets.length === reviewReturnChecklist.summary.missing_packets,
      detail: `${missingPackets.length}/${reviewReturnChecklist.summary.missing_packets} missing packets`,
    },
    {
      id: 'quality_controls_attached',
      passed: annotationQualityControl.annotation_quality_control_ready === true && annotationQualityControl.qa_rules.length >= 5,
      detail: `${annotationQualityControl.qa_rules.length} QA rules attached to collection workflow`,
    },
  ]

  return {
    review_collection_tracker_ready: checks.every((check) => check.passed),
    version: 'review-collection-tracker-v1',
    completion_claim_allowed: false,
    generated_from: {
      review_return_checklist: 'generated/review-return-checklist.json',
      review_execution_plan: 'generated/review-execution-plan.json',
      review_progress: 'generated/review-progress.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      release_gate: 'generated/release-gate.json',
    },
    collection_commands: {
      dry_run: reviewReturnChecklist.commands.dry_run,
      apply_after_clean_dry_run: reviewReturnChecklist.commands.apply_after_clean_dry_run,
      refresh_tracker: 'node scripts/hard-grounded-research-review-collection-tracker.mjs',
    },
    checks,
    by_priority: byPriority,
    blocking_gates: blockingGates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    packets: packetRows,
    next_collection_actions: [
      'Collect all pilot_gold_first packets before attempting pilot review preflight or gold promotion.',
      'Collect scale_first_wave packets in category order to preserve balanced first-wave expansion coverage.',
      'Run the dry-run importer after every packet drop; only apply after the dry run is clean.',
      'Regenerate review preflight, review merge, expansion preflight, expansion merge, review progress, and release gate after applying real returns.',
    ],
    summary: {
      packets: packetRows.length,
      first_wave_rows: packetRows.reduce((sum, packet) => sum + packet.expected_rows, 0),
      missing_packets: missingPackets.length,
      returned_packets: returnedPackets.length,
      pilot_missing_packets: missingPackets.filter((packet) => packet.scope === 'pilot_review').length,
      expansion_missing_packets: missingPackets.filter((packet) => packet.scope === 'expansion_review').length,
      total_review_rows_remaining: reviewProgress.summary.reviewed_items_remaining * 2,
      execution_plan_rows_remaining: reviewExecutionPlan.summary.total_rows_remaining,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(tracker) {
  const checkRows = tracker.checks.map((check) => [check.id, String(check.passed), check.detail])
  const priorityRows = Object.entries(tracker.by_priority).map(([priority, row]) => [
    priority,
    String(row.packets),
    String(row.rows),
    String(row.missing_packets),
    String(row.returned_packets),
  ])
  const gateRows = tracker.blocking_gates.map((gate) => [
    gate.id,
    gate.passed ? 'yes' : 'no',
    gate.detail,
    gate.blocker,
  ])
  const packetRows = tracker.packets.map((packet) => [
    packet.expected_return_file,
    packet.priority,
    packet.scope,
    packet.category,
    packet.reviewer_slot,
    String(packet.expected_rows),
    packet.status,
  ])
  const actionRows = tracker.next_collection_actions.map((action, index) => [String(index + 1), action])

  return `# Hard Grounded Research Review Collection Tracker

This generated tracker converts missing reviewer-return files into an auditable collection queue. It does not synthesize labels, apply returns, merge reviews, promote gold, or clear paper-readiness gates.

## Summary

- Tracker ready: ${tracker.review_collection_tracker_ready}
- Version: ${tracker.version}
- Packets: ${tracker.summary.packets}
- First-wave rows: ${tracker.summary.first_wave_rows}
- Missing packets: ${tracker.summary.missing_packets}
- Returned packets: ${tracker.summary.returned_packets}
- Pilot missing packets: ${tracker.summary.pilot_missing_packets}
- Expansion missing packets: ${tracker.summary.expansion_missing_packets}
- Execution-plan rows remaining: ${tracker.summary.execution_plan_rows_remaining}
- Completion claim allowed: ${tracker.summary.completion_claim_allowed}

## Commands

- Dry run: \`${tracker.collection_commands.dry_run}\`
- Apply after clean dry run: \`${tracker.collection_commands.apply_after_clean_dry_run}\`
- Refresh tracker: \`${tracker.collection_commands.refresh_tracker}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Priority Summary

${markdownTable(['Priority', 'Packets', 'Rows', 'Missing', 'Returned'], priorityRows)}

## Blocking Review Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Required action'], gateRows)}

## Next Collection Actions

${markdownTable(['#', 'Action'], actionRows)}

## Packet Queue

${markdownTable(['Return file', 'Priority', 'Scope', 'Category', 'Reviewer', 'Rows', 'Status'], packetRows)}
`
}

const tracker = buildTracker({
  reviewReturnChecklist: readJson(inputs.reviewReturnChecklist),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  reviewProgress: readJson(inputs.reviewProgress),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(trackerJsonPath, tracker)
writeText(trackerMarkdownPath, renderMarkdown(tracker))

console.log(`Wrote hard grounded review collection tracker to ${trackerJsonPath}`)
console.log(`Wrote hard grounded review collection tracker report to ${trackerMarkdownPath}`)
