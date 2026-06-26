import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-wave-schedule.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_WAVE_SCHEDULE.md')

const inputs = {
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
}

const scheduleOrder = {
  pilot_gold_first: 1,
  scale_first_wave: 2,
  scale_followup: 3,
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

function gateIdsForScope(scope) {
  return scope === 'pilot_review'
    ? ['review_preflight_ready', 'review_merge_ready', 'gold_review_complete']
    : ['expansion_review_preflight_ready', 'expansion_review_merge_ready', 'category_scale_ready']
}

function buildSchedule({ reviewReturnChecklist, reviewCollectionTracker, reviewExecutionPlan, annotationQualityControl }) {
  const trackerByFile = new Map(reviewCollectionTracker.packets.map((packet) => [packet.expected_return_file, packet]))
  const packets = reviewReturnChecklist.packets.map((packet) => {
    const tracker = trackerByFile.get(packet.expected_return_file)
    const priority = tracker?.priority || (packet.scope === 'pilot_review' ? 'pilot_gold_first' : 'scale_first_wave')
    return {
      schedule_id: packet.expected_return_file.replace(/\.jsonl$/, ''),
      expected_return_file: packet.expected_return_file,
      export_file: packet.export_file,
      scope: packet.scope,
      category: packet.category,
      reviewer_slot: packet.reviewer_slot,
      workbook_id: packet.workbook_id,
      priority,
      schedule_order: scheduleOrder[priority] || 99,
      expected_rows: packet.expected_rows,
      wave_ids: packet.wave_ids,
      status: packet.present ? 'returned_pending_import' : 'scheduled_for_collection',
      gate_ids: gateIdsForScope(packet.scope),
      acceptance_criteria: [
        'Returned file name exactly matches expected_return_file.',
        'Immutable fields are unchanged from export file.',
        'All required reviewer fields are present for every row.',
        'Dry-run import completes without validation errors before apply.',
      ],
    }
  }).sort((a, b) => a.schedule_order - b.schedule_order || a.category.localeCompare(b.category) || a.reviewer_slot.localeCompare(b.reviewer_slot))

  const waveGroups = []
  for (const priority of ['pilot_gold_first', 'scale_first_wave', 'scale_followup']) {
    const scoped = packets.filter((packet) => packet.priority === priority)
    if (!scoped.length) continue
    waveGroups.push({
      priority,
      schedule_order: scheduleOrder[priority],
      packets: scoped.length,
      rows: scoped.reduce((sum, packet) => sum + packet.expected_rows, 0),
      categories: [...new Set(scoped.map((packet) => packet.category))].sort(),
      gate_ids: [...new Set(scoped.flatMap((packet) => packet.gate_ids))],
      status: scoped.every((packet) => packet.status === 'returned_pending_import') ? 'ready_for_import_preflight' : 'awaiting_collection',
      packet_ids: scoped.map((packet) => packet.schedule_id),
    })
  }

  const checks = [
    {
      id: 'return_packets_loaded',
      passed: packets.length === reviewReturnChecklist.summary.packets,
      detail: `${packets.length}/${reviewReturnChecklist.summary.packets} return packets scheduled`,
    },
    {
      id: 'collection_tracker_aligned',
      passed: packets.length === reviewCollectionTracker.summary.packets,
      detail: `${packets.length}/${reviewCollectionTracker.summary.packets} tracker packets aligned`,
    },
    {
      id: 'pilot_first_wave_present',
      passed: waveGroups.some((wave) => wave.priority === 'pilot_gold_first' && wave.packets === reviewCollectionTracker.summary.pilot_missing_packets),
      detail: `${reviewCollectionTracker.summary.pilot_missing_packets} pilot packets scheduled first`,
    },
    {
      id: 'qa_policy_attached',
      passed: annotationQualityControl.annotation_quality_control_ready === true && annotationQualityControl.qa_rules.length >= 5,
      detail: `${annotationQualityControl.qa_rules.length} QA rules govern returned review rows`,
    },
    {
      id: 'completion_still_blocked',
      passed: reviewExecutionPlan.claim_limits?.completion_claim_allowed === false,
      detail: `completion_claim_allowed=${reviewExecutionPlan.claim_limits?.completion_claim_allowed}`,
    },
  ]

  return {
    review_wave_schedule_ready: checks.every((check) => check.passed),
    version: 'review-wave-schedule-v1',
    completion_claim_allowed: false,
    generated_from: {
      review_return_checklist: 'generated/review-return-checklist.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      review_execution_plan: 'generated/review-execution-plan.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
    },
    collection_commands: {
      dry_run: reviewReturnChecklist.commands.dry_run,
      apply_after_clean_dry_run: reviewReturnChecklist.commands.apply_after_clean_dry_run,
      refresh_schedule: 'node scripts/hard-grounded-research-review-wave-schedule.mjs',
    },
    checks,
    waves: waveGroups,
    packets,
    summary: {
      packets: packets.length,
      waves: waveGroups.length,
      first_wave_rows: packets.reduce((sum, packet) => sum + packet.expected_rows, 0),
      scheduled_missing_packets: packets.filter((packet) => packet.status === 'scheduled_for_collection').length,
      returned_pending_import_packets: packets.filter((packet) => packet.status === 'returned_pending_import').length,
      pilot_packets: packets.filter((packet) => packet.scope === 'pilot_review').length,
      expansion_packets: packets.filter((packet) => packet.scope === 'expansion_review').length,
      total_review_rows_remaining: reviewExecutionPlan.summary.total_rows_remaining,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(schedule) {
  const checkRows = schedule.checks.map((check) => [check.id, String(check.passed), check.detail])
  const waveRows = schedule.waves.map((wave) => [
    wave.priority,
    String(wave.schedule_order),
    String(wave.packets),
    String(wave.rows),
    wave.categories.join('<br>'),
    wave.gate_ids.join('<br>'),
    wave.status,
  ])
  const packetRows = schedule.packets.map((packet) => [
    packet.expected_return_file,
    packet.priority,
    packet.scope,
    packet.category,
    packet.reviewer_slot,
    String(packet.expected_rows),
    packet.status,
  ])

  return `# Hard Grounded Research Review Wave Schedule

This generated schedule converts missing returned-review files into an ordered collection plan. It does not synthesize labels, mark reviews complete, merge items, promote gold, or clear review gates.

## Summary

- Schedule ready: ${schedule.review_wave_schedule_ready}
- Version: ${schedule.version}
- Packets: ${schedule.summary.packets}
- Waves: ${schedule.summary.waves}
- First-wave rows: ${schedule.summary.first_wave_rows}
- Scheduled missing packets: ${schedule.summary.scheduled_missing_packets}
- Returned pending import packets: ${schedule.summary.returned_pending_import_packets}
- Pilot packets: ${schedule.summary.pilot_packets}
- Expansion packets: ${schedule.summary.expansion_packets}
- Total review rows remaining: ${schedule.summary.total_review_rows_remaining}
- Completion claim allowed: ${schedule.summary.completion_claim_allowed}

## Commands

- Dry run: \`${schedule.collection_commands.dry_run}\`
- Apply after clean dry run: \`${schedule.collection_commands.apply_after_clean_dry_run}\`
- Refresh schedule: \`${schedule.collection_commands.refresh_schedule}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Waves

${markdownTable(['Priority', 'Order', 'Packets', 'Rows', 'Categories', 'Gate ids', 'Status'], waveRows)}

## Packet Schedule

${markdownTable(['Expected return file', 'Priority', 'Scope', 'Category', 'Reviewer', 'Rows', 'Status'], packetRows)}
`
}

const schedule = buildSchedule({
  reviewReturnChecklist: readJson(inputs.reviewReturnChecklist),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
})

writeJson(reportJsonPath, schedule)
writeText(reportMarkdownPath, renderMarkdown(schedule))

console.log(`Wrote hard grounded review wave schedule to ${reportJsonPath}`)
console.log(`Wrote hard grounded review wave schedule report to ${reportMarkdownPath}`)
