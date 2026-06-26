import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'review-assignment-audit.json')
const reportMarkdownPath = join(experimentDir, 'REVIEW_ASSIGNMENT_AUDIT.md')

const inputs = {
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
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

function auditAssignment(assignment) {
  const reviewerSlots = assignment.reviewer_workbooks.map((workbook) => workbook.reviewer_slot)
  const workbookIds = assignment.reviewer_workbooks.map((workbook) => workbook.workbook_id)
  const distinctSlots = new Set(reviewerSlots)
  return {
    assignment_id: assignment.assignment_id,
    wave_id: assignment.wave_id,
    scope: assignment.scope,
    category: assignment.category,
    item_id: assignment.item_id || null,
    reviewer_slots: reviewerSlots,
    workbook_ids: workbookIds,
    double_review_assigned: distinctSlots.has('reviewer_a') && distinctSlots.has('reviewer_b'),
    distinct_reviewer_slots: distinctSlots.size,
    reviewer_field_only_policy: true,
    status:
      distinctSlots.has('reviewer_a') && distinctSlots.has('reviewer_b')
        ? 'assignment_ready_for_blind_double_review'
        : 'blocked_missing_distinct_reviewer_slots',
  }
}

function buildAudit({ annotationAssignments, reviewPacketAudit, reviewReturnContract }) {
  const pilotRows = annotationAssignments.pilot_assignments.map(auditAssignment)
  const expansionRows = annotationAssignments.expansion_assignments.map(auditAssignment)
  const allRows = [...pilotRows, ...expansionRows]
  const blockedRows = allRows.filter((row) => row.status !== 'assignment_ready_for_blind_double_review')
  const checks = [
    {
      id: 'assignment_plan_loaded',
      passed: annotationAssignments.assignment_plan_ready === true,
      detail: `${annotationAssignments.totals.pilot_assignment_count} pilot assignments; ${annotationAssignments.totals.expansion_assignment_count} expansion assignments`,
    },
    {
      id: 'review_packet_audit_clean',
      passed: reviewPacketAudit.review_packet_audit_ready === true && reviewPacketAudit.summary.finding_count === 0,
      detail: `${reviewPacketAudit.summary.files_checked} packet files; findings=${reviewPacketAudit.summary.finding_count}`,
    },
    {
      id: 'return_contract_enforces_reviewer_fields_only',
      passed:
        reviewReturnContract.review_return_contract_ready === true &&
        reviewReturnContract.return_contract.reviewer_must_not_edit.length > 0 &&
        annotationAssignments.reviewer_fields_only === true,
      detail: `${reviewReturnContract.return_contract.reviewer_must_not_edit.length} immutable fields`,
    },
    {
      id: 'all_assignments_have_distinct_reviewer_slots',
      passed: blockedRows.length === 0 && allRows.length > 0,
      detail: `${allRows.length - blockedRows.length}/${allRows.length} assignments have reviewer_a and reviewer_b`,
    },
    {
      id: 'completion_still_blocked',
      passed: true,
      detail: 'assignment audit does not fill reviewer fields or promote gold',
    },
  ]

  return {
    review_assignment_audit_ready: checks.every((check) => check.passed),
    version: 'review-assignment-audit-v1',
    completion_claim_allowed: false,
    generated_from: {
      annotation_assignments: 'generated/annotation-assignments.json',
      review_packet_audit: 'generated/review-packet-audit.json',
      review_return_contract: 'generated/review-return-contract.json',
    },
    checks,
    pilot_assignments: pilotRows,
    expansion_assignments: expansionRows,
    blocked_assignments: blockedRows,
    summary: {
      total_assignments: allRows.length,
      pilot_assignments: pilotRows.length,
      expansion_assignments: expansionRows.length,
      double_review_assignments: allRows.filter((row) => row.double_review_assigned).length,
      blocked_assignments: blockedRows.length,
      immutable_fields: reviewReturnContract.return_contract.reviewer_must_not_edit.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(audit) {
  const checkRows = audit.checks.map((check) => [check.id, String(check.passed), check.detail])
  const assignmentRows = [...audit.pilot_assignments, ...audit.expansion_assignments].map((assignment) => [
    assignment.assignment_id,
    assignment.wave_id,
    assignment.scope,
    assignment.category,
    assignment.reviewer_slots.join('<br>'),
    assignment.status,
  ])

  return `# Hard Grounded Research Review Assignment Audit

This generated audit checks that assigned work is ready for blind double review with distinct reviewer slots and reviewer-field-only constraints. It does not fill labels, resolve disagreements, or clear gold, scale, novelty, or completion gates.

## Summary

- Assignment audit ready: ${audit.review_assignment_audit_ready}
- Version: ${audit.version}
- Total assignments: ${audit.summary.total_assignments}
- Pilot assignments: ${audit.summary.pilot_assignments}
- Expansion assignments: ${audit.summary.expansion_assignments}
- Double-review assignments: ${audit.summary.double_review_assignments}
- Blocked assignments: ${audit.summary.blocked_assignments}
- Immutable fields: ${audit.summary.immutable_fields}
- Completion claim allowed: ${audit.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Assignment Rows

${markdownTable(['Assignment', 'Wave', 'Scope', 'Category', 'Reviewer slots', 'Status'], assignmentRows)}
`
}

const audit = buildAudit({
  annotationAssignments: readJson(inputs.annotationAssignments),
  reviewPacketAudit: readJson(inputs.reviewPacketAudit),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
})

writeJson(reportJsonPath, audit)
writeText(reportMarkdownPath, renderMarkdown(audit))

console.log(`Wrote hard grounded review assignment audit to ${reportJsonPath}`)
console.log(`Wrote hard grounded review assignment audit report to ${reportMarkdownPath}`)
