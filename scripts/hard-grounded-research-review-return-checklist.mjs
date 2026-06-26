import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-return-checklist.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_RETURN_CHECKLIST.md')

const inputs = {
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
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

function assignmentLookup(annotationAssignments) {
  const byWorkbook = new Map()
  for (const assignment of annotationAssignments.pilot_assignments || []) {
    for (const workbook of assignment.reviewer_workbooks || []) {
      const current = byWorkbook.get(workbook.workbook_id) || []
      current.push({
        assignment_id: assignment.assignment_id,
        wave_id: assignment.wave_id,
        priority: assignment.priority,
        target_rows: 1,
      })
      byWorkbook.set(workbook.workbook_id, current)
    }
  }
  for (const assignment of annotationAssignments.expansion_assignments || []) {
    for (const workbook of assignment.reviewer_workbooks || []) {
      const current = byWorkbook.get(workbook.workbook_id) || []
      current.push({
        assignment_id: assignment.assignment_id,
        wave_id: assignment.wave_id,
        priority: 'paper_scale',
        target_rows: Math.min(5, workbook.incomplete_rows || assignment.target_rows || 0),
      })
      byWorkbook.set(workbook.workbook_id, current)
    }
  }
  return byWorkbook
}

function buildChecklist({ annotationAssignments, reviewerHandoff, reviewReturnContract, reviewReturnPreflight, reviewProgress }) {
  const assignmentsByWorkbook = assignmentLookup(annotationAssignments)
  const preflightByFile = new Map(reviewReturnPreflight.expected_files.map((file) => [file.expected_return_file, file]))
  const packets = reviewReturnContract.expected_files.map((file) => {
    const assignments = assignmentsByWorkbook.get(file.workbook_id) || []
    const preflight = preflightByFile.get(file.expected_return_file)
    const status = preflight?.present ? 'returned_pending_import' : 'awaiting_reviewer_return'
    return {
      expected_return_file: file.expected_return_file,
      export_file: file.export_file,
      scope: file.scope,
      category: file.category,
      reviewer_slot: file.reviewer_slot,
      workbook_id: file.workbook_id,
      expected_rows: file.expected_rows,
      assignment_ids: assignments.map((assignment) => assignment.assignment_id),
      wave_ids: [...new Set(assignments.map((assignment) => assignment.wave_id))],
      priorities: [...new Set(assignments.map((assignment) => assignment.priority))],
      required_reviewer_fields: file.required_reviewer_fields,
      expansion_required_fields: file.expansion_required_fields,
      present: Boolean(preflight?.present),
      status,
      next_action: preflight?.present
        ? 'Run annotation import dry-run and apply only after all files are clean.'
        : 'Collect this exact returned JSONL from the assigned reviewer.',
    }
  })
  const byScope = Object.fromEntries(['pilot_review', 'expansion_review'].map((scope) => {
    const scoped = packets.filter((packet) => packet.scope === scope)
    return [scope, {
      packets: scoped.length,
      rows: scoped.reduce((sum, packet) => sum + packet.expected_rows, 0),
      present_packets: scoped.filter((packet) => packet.present).length,
      missing_packets: scoped.filter((packet) => !packet.present).length,
    }]
  }))
  const checks = [
    {
      id: 'handoff_ready',
      passed: Boolean(reviewerHandoff.handoff_ready),
      detail: `${reviewerHandoff.totals.export_files} export files; ${reviewerHandoff.totals.export_rows} rows`,
    },
    {
      id: 'return_contract_ready',
      passed: Boolean(reviewReturnContract.review_return_contract_ready) && reviewReturnContract.summary.finding_count === 0,
      detail: `${reviewReturnContract.summary.expected_return_files} files; findings=${reviewReturnContract.summary.finding_count}`,
    },
    {
      id: 'preflight_ready',
      passed: Boolean(reviewReturnPreflight.review_return_preflight_ready),
      detail: `${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files} returned files present`,
    },
    {
      id: 'packet_count_matches_contract',
      passed: packets.length === reviewReturnContract.summary.expected_return_files,
      detail: `${packets.length}/${reviewReturnContract.summary.expected_return_files} packets`,
    },
    {
      id: 'packet_rows_match_contract',
      passed: packets.reduce((sum, packet) => sum + packet.expected_rows, 0) === reviewReturnContract.summary.expected_return_rows,
      detail: `${packets.reduce((sum, packet) => sum + packet.expected_rows, 0)}/${reviewReturnContract.summary.expected_return_rows} rows`,
    },
  ]

  return {
    review_return_checklist_ready: checks.every((check) => check.passed),
    version: 'review-return-checklist-v1',
    completion_claim_allowed: false,
    generated_from: {
      annotation_assignments: 'generated/annotation-assignments.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      review_return_contract: 'generated/review-return-contract.json',
      review_return_preflight: 'generated/review-return-preflight.json',
      review_progress: 'generated/review-progress.json',
    },
    commands: {
      dry_run: reviewReturnContract.return_contract.dry_run_command,
      apply_after_clean_dry_run: reviewReturnContract.return_contract.apply_command,
    },
    checks,
    by_scope: byScope,
    packets,
    paper_blockers: reviewProgress.blockers,
    summary: {
      packets: packets.length,
      expected_rows: packets.reduce((sum, packet) => sum + packet.expected_rows, 0),
      present_packets: packets.filter((packet) => packet.present).length,
      missing_packets: packets.filter((packet) => !packet.present).length,
      pilot_packets: byScope.pilot_review.packets,
      pilot_rows: byScope.pilot_review.rows,
      expansion_packets: byScope.expansion_review.packets,
      expansion_rows: byScope.expansion_review.rows,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(checklist) {
  const checkRows = checklist.checks.map((check) => [check.id, String(check.passed), check.detail])
  const scopeRows = Object.entries(checklist.by_scope).map(([scope, row]) => [
    scope,
    String(row.packets),
    String(row.rows),
    String(row.present_packets),
    String(row.missing_packets),
  ])
  const packetRows = checklist.packets.map((packet) => [
    packet.expected_return_file,
    packet.scope,
    packet.category,
    packet.reviewer_slot,
    String(packet.expected_rows),
    packet.wave_ids.join('<br>') || 'unassigned',
    packet.status,
  ])

  return `# Hard Grounded Research Review Return Checklist

This generated checklist converts the first-wave review handoff into exact returned-packet work units. It does not contain human labels, apply returned labels, merge reviews, promote gold, or clear paper-scale review blockers.

## Summary

- Review return checklist ready: ${checklist.review_return_checklist_ready}
- Version: ${checklist.version}
- Packets: ${checklist.summary.packets}
- Expected rows: ${checklist.summary.expected_rows}
- Present packets: ${checklist.summary.present_packets}
- Missing packets: ${checklist.summary.missing_packets}
- Pilot packets/rows: ${checklist.summary.pilot_packets}/${checklist.summary.pilot_rows}
- Expansion packets/rows: ${checklist.summary.expansion_packets}/${checklist.summary.expansion_rows}
- Completion claim allowed: ${checklist.summary.completion_claim_allowed}

## Commands

- Dry run: \`${checklist.commands.dry_run}\`
- Apply after clean dry run: \`${checklist.commands.apply_after_clean_dry_run}\`

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Scope Summary

${markdownTable(['Scope', 'Packets', 'Rows', 'Present', 'Missing'], scopeRows)}

## Return Packet Checklist

${markdownTable(['Return file', 'Scope', 'Category', 'Reviewer', 'Rows', 'Wave', 'Status'], packetRows)}
`
}

const checklist = buildChecklist({
  annotationAssignments: readJson(inputs.annotationAssignments),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  reviewReturnPreflight: readJson(inputs.reviewReturnPreflight),
  reviewProgress: readJson(inputs.reviewProgress),
})

writeJson(reportJsonPath, checklist)
writeText(reportMarkdownPath, renderMarkdown(checklist))

console.log(`Wrote hard grounded review return checklist to ${reportJsonPath}`)
console.log(`Wrote hard grounded review return checklist report to ${reportMarkdownPath}`)
