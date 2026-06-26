import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const handoffJsonPath = join(generatedDir, 'reviewer-handoff.json')
const handoffMarkdownPath = join(experimentDir, 'REVIEWER_HANDOFF.md')

const inputs = {
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  reviewOperations: join(generatedDir, 'review-operations.json'),
  reviewTriage: join(generatedDir, 'review-triage.json'),
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
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

function byWave(assignments) {
  const waves = new Map()
  for (const assignment of assignments) {
    const current = waves.get(assignment.wave_id) || {
      wave_id: assignment.wave_id,
      scope: assignment.scope,
      assignment_count: 0,
      item_count: 0,
      categories: new Set(),
      priority_items: [],
    }
    current.assignment_count += 1
    current.item_count += 1
    current.categories.add(assignment.category)
    if (current.priority_items.length < 6) {
      current.priority_items.push(assignment.item_id)
    }
    waves.set(assignment.wave_id, current)
  }

  return [...waves.values()].map((wave) => ({
    ...wave,
    categories: [...wave.categories].sort(),
  }))
}

function expansionWave(annotationAssignments) {
  const assignments = annotationAssignments.expansion_assignments || []
  return {
    wave_id: 'expansion_balance_wave_1',
    scope: 'expansion_review',
    assignment_count: assignments.length,
    target_review_rows: assignments.reduce((sum, assignment) => sum + assignment.target_rows, 0),
    categories: assignments.map((assignment) => assignment.category).sort(),
    workbook_count: assignments.reduce((sum, assignment) => sum + assignment.reviewer_workbooks.length, 0),
  }
}

function buildHandoff({
  annotationProtocol,
  reviewOperations,
  reviewTriage,
  annotationAssignments,
  annotationExport,
  annotationImport,
  annotationImportSmoke,
  reviewPreflight,
  expansionReviewPreflight,
}) {
  const pilotWaves = byWave(annotationAssignments.pilot_assignments || [])
  const expansion = expansionWave(annotationAssignments)
  const exportFiles = annotationExport.files.map((file) => ({
    file: file.file,
    scope: file.scope,
    workbook_id: file.workbook_id,
    reviewer_slot: file.reviewer_slot,
    category: file.category,
    row_count: file.row_count,
    expected_return_row_count: file.expected_return_row_count,
    required_return_fields: file.required_return_fields,
    return_packet_checks: file.return_packet_checks,
    sha256: file.sha256,
  }))

  const commands = [
    {
      purpose: 'Dry-run returned reviewer packets without modifying workbooks',
      command:
        'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=docs/experiments/hard-grounded-research-benchmark/generated/annotation-import-smoke --allow-fixture',
    },
    {
      purpose: 'Apply real returned reviewer packets after dry-run passes',
      command:
        'node scripts/hard-grounded-research-import-annotations.mjs --input-dir=<returned-reviewer-packet-dir> --apply',
    },
    {
      purpose: 'Check pilot review completeness after imports',
      command: 'node scripts/hard-grounded-research-review-preflight.mjs',
    },
    {
      purpose: 'Check expansion review completeness after imports',
      command: 'node scripts/hard-grounded-research-expansion-review-preflight.mjs',
    },
    {
      purpose: 'Merge pilot review labels after preflight is clean',
      command: 'node scripts/hard-grounded-research-review-merge.mjs',
    },
    {
      purpose: 'Merge expansion review labels after preflight is clean',
      command: 'node scripts/hard-grounded-research-expansion-review-merge.mjs',
    },
  ]

  const acceptanceGates = [
    {
      id: 'reviewer_fields_only',
      passed: annotationExport.reviewer_fields_only && annotationImport.reviewer_fields_only_enforced,
      detail: 'Returned packets may edit only reviewer_fields.',
    },
    {
      id: 'export_complete',
      passed: Boolean(annotationExport.export_ready),
      detail: `${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} export files.`,
    },
    {
      id: 'import_smoke_clean',
      passed: Boolean(annotationImportSmoke.annotation_import_smoke_ready) && annotationImportSmoke.finding_count === 0,
      detail: `${annotationImportSmoke.rows_checked} fixture rows checked; findings=${annotationImportSmoke.finding_count}.`,
    },
    {
      id: 'import_path_ready',
      passed: Boolean(annotationImport.annotation_import_ready),
      detail: `${annotationImport.rows_importable}/${annotationImport.rows_checked} rows importable; applied=${annotationImport.applied_to_workbooks}.`,
    },
    {
      id: 'return_readiness_present',
      passed:
        Boolean(annotationExport.return_readiness?.ready) &&
        annotationExport.return_readiness.expected_files === annotationExport.totals.file_count &&
        annotationExport.return_readiness.expected_rows === annotationExport.totals.row_count,
      detail: `${annotationExport.return_readiness?.expected_files ?? 0} expected returned files; ${annotationExport.return_readiness?.expected_rows ?? 0} expected rows.`,
    },
    {
      id: 'human_labels_not_started',
      passed: !reviewPreflight.preflight_ready && !expansionReviewPreflight.preflight_ready,
      detail: `${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows} pilot rows complete; ${expansionReviewPreflight.complete_review_rows}/${expansionReviewPreflight.total_review_rows} expansion rows complete.`,
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    handoff_ready: acceptanceGates.every((gate) => gate.passed),
    generated_from: {
      annotation_protocol: 'generated/annotation-protocol.json',
      review_operations: 'generated/review-operations.json',
      review_triage: 'generated/review-triage.json',
      annotation_assignments: 'generated/annotation-assignments.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      annotation_import: 'generated/annotation-import/report.json',
      annotation_import_smoke: 'generated/annotation-import-smoke/report.json',
      review_preflight: 'generated/review-preflight.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
    },
    editable_path: annotationExport.import_contract.editable_path,
    required_reviewer_fields: annotationProtocol.required_reviewer_fields,
    expansion_only_fields: annotationProtocol.expansion_only_fields,
    reviewer_must_not_edit: annotationExport.import_contract.reviewer_must_not_edit,
    return_readiness: annotationExport.return_readiness,
    totals: {
      export_files: annotationExport.totals.file_count,
      export_rows: annotationExport.totals.row_count,
      pilot_export_rows: annotationExport.totals.pilot_rows,
      expansion_export_rows: annotationExport.totals.expansion_rows,
      pilot_incomplete_rows: reviewOperations.pilot_review.incomplete_review_rows,
      expansion_incomplete_rows: reviewOperations.expansion_review.incomplete_review_rows,
      urgent_or_high_pilot_items: reviewTriage.urgent_or_high_items,
    },
    review_waves: [...pilotWaves, expansion],
    export_files: exportFiles,
    commands,
    acceptance_gates: acceptanceGates,
  }
}

function renderMarkdown(handoff) {
  const waveRows = handoff.review_waves.map((wave) => [
    wave.wave_id,
    wave.scope,
    String(wave.assignment_count),
    String(wave.item_count || wave.target_review_rows),
    wave.categories.join('<br>'),
  ])
  const fileRows = handoff.export_files.map((file) => [
    file.file,
    file.scope,
    file.workbook_id,
    file.category,
    `${file.row_count}/${file.expected_return_row_count}`,
    file.sha256,
  ])
  const returnChecklistRows = handoff.return_readiness.packet_checklist.map((item, index) => [
    String(index + 1),
    item,
  ])
  const commandRows = handoff.commands.map((command) => [command.purpose, `\`${command.command}\``])
  const gateRows = handoff.acceptance_gates.map((gate) => [
    gate.id,
    gate.passed ? 'yes' : 'no',
    gate.detail,
  ])

  return `# Hard Grounded Research Reviewer Handoff

This generated packet is the reviewer-facing handoff contract for the current first-wave annotation export. It does not contain completed labels and does not clear gold review blockers.

## Summary

- Handoff ready: ${handoff.handoff_ready}
- Editable path: \`${handoff.editable_path}\`
- Export files: ${handoff.totals.export_files}
- Export rows: ${handoff.totals.export_rows}
- Pilot export rows: ${handoff.totals.pilot_export_rows}
- Expansion export rows: ${handoff.totals.expansion_export_rows}
- Urgent/high pilot items represented in triage: ${handoff.totals.urgent_or_high_pilot_items}
- Remaining pilot review rows: ${handoff.totals.pilot_incomplete_rows}
- Remaining expansion review rows: ${handoff.totals.expansion_incomplete_rows}
- Return readiness: ${handoff.return_readiness.ready}
- Expected returned files: ${handoff.return_readiness.expected_files}
- Expected returned rows: ${handoff.return_readiness.expected_rows}

## Reviewer Field Contract

Reviewers may edit only \`${handoff.editable_path}\`.

Required reviewer fields: ${handoff.required_reviewer_fields.map((field) => `\`${field}\``).join(', ')}.

Expansion-only fields: ${handoff.expansion_only_fields.map((field) => `\`${field}\``).join(', ')}.

Reviewers must not edit: ${handoff.reviewer_must_not_edit.map((field) => `\`${field}\``).join(', ')}.

## Review Waves

${markdownTable(['Wave', 'Scope', 'Assignments', 'Rows or items', 'Categories'], waveRows)}

## Acceptance Gates

${markdownTable(['Gate', 'Passed', 'Detail'], gateRows)}

## Return Readiness Checklist

${markdownTable(['Step', 'Requirement'], returnChecklistRows)}

Dry-run command: \`${handoff.return_readiness.dry_run_command}\`

Apply command: \`${handoff.return_readiness.apply_command}\`

## Import And Merge Commands

${markdownTable(['Purpose', 'Command'], commandRows)}

## Export Files

${markdownTable(['File', 'Scope', 'Workbook', 'Category', 'Rows exported/expected return', 'SHA-256'], fileRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing reviewer handoff input ${name}: ${path}`)
}

const handoff = buildHandoff({
  annotationProtocol: readJson(inputs.annotationProtocol),
  reviewOperations: readJson(inputs.reviewOperations),
  reviewTriage: readJson(inputs.reviewTriage),
  annotationAssignments: readJson(inputs.annotationAssignments),
  annotationExport: readJson(inputs.annotationExport),
  annotationImport: readJson(inputs.annotationImport),
  annotationImportSmoke: readJson(inputs.annotationImportSmoke),
  reviewPreflight: readJson(inputs.reviewPreflight),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
})

writeJson(handoffJsonPath, handoff)
writeText(handoffMarkdownPath, renderMarkdown(handoff))

console.log(`Wrote hard grounded research reviewer handoff JSON to ${handoffJsonPath}`)
console.log(`Wrote hard grounded research reviewer handoff report to ${handoffMarkdownPath}`)
