import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'review-execution-plan.json')
const planMarkdownPath = join(experimentDir, 'REVIEW_EXECUTION_PLAN.md')

const inputs = {
  reviewProgress: join(generatedDir, 'review-progress.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
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

function round(value) {
  return Math.round(value * 10) / 10
}

function buildPlan({
  reviewProgress,
  reviewerHandoff,
  annotationQualityControl,
  annotatorAgreement,
  adjudicationReadiness,
  powerPlan,
  releaseGate,
}) {
  const blockingReviewChecks = releaseGate.checks
    .filter((check) => !check.passed)
    .filter((check) => ['gold_review_complete', 'review_preflight_ready', 'expansion_review_preflight_ready', 'expansion_review_merge_ready', 'review_merge_ready', 'category_scale_ready'].includes(check.id))
  const pilotRowsRemaining = reviewProgress.summary.pilot_total_review_rows - reviewProgress.summary.pilot_complete_review_rows
  const expansionRowsRemaining = reviewProgress.summary.expansion_total_review_rows - reviewProgress.summary.expansion_complete_review_rows
  const totalRowsRemaining = pilotRowsRemaining + expansionRowsRemaining
  const minutesPerPilotRow = 8
  const minutesPerExpansionRow = 6
  const adjudicationReservePercent = 0.2
  const reviewMinutes = pilotRowsRemaining * minutesPerPilotRow + expansionRowsRemaining * minutesPerExpansionRow
  const adjudicationReserveMinutes = reviewMinutes * adjudicationReservePercent

  const waves = [
    {
      id: 'pilot_triage_completion',
      scope: 'pilot_review',
      rows_remaining: pilotRowsRemaining,
      target_items: 30,
      acceptance_gate_ids: ['review_preflight_ready', 'review_merge_ready', 'gold_review_complete'],
    },
    {
      id: 'expansion_scale_completion',
      scope: 'expansion_review',
      rows_remaining: expansionRowsRemaining,
      target_items: powerPlan.assumptions.target_reviewed_items_total - 30,
      acceptance_gate_ids: ['expansion_review_preflight_ready', 'expansion_review_merge_ready', 'category_scale_ready'],
    },
  ]

  return {
    review_execution_plan_ready:
      reviewProgress.review_progress_ready === true &&
      reviewerHandoff.handoff_ready === true &&
      annotationQualityControl.annotation_quality_control_ready === true &&
      adjudicationReadiness.adjudication_readiness_ready === true &&
      annotatorAgreement.annotator_agreement_ready === true &&
      blockingReviewChecks.length >= 5,
    version: 'review-execution-plan-v1',
    generated_from: {
      review_progress: 'generated/review-progress.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      annotator_agreement: 'generated/annotator-agreement.json',
      adjudication_readiness: 'generated/adjudication-readiness.json',
      power_plan: 'generated/power-plan.json',
      release_gate: 'generated/release-gate.json',
    },
    workload: {
      pilot_rows_remaining: pilotRowsRemaining,
      expansion_rows_remaining: expansionRowsRemaining,
      total_rows_remaining: totalRowsRemaining,
      target_reviewed_items_total: powerPlan.assumptions.target_reviewed_items_total,
      target_reviewed_items_per_category: powerPlan.assumptions.target_reviewed_items_per_category,
      first_wave_export_rows: reviewerHandoff.totals.export_rows,
      first_wave_export_files: reviewerHandoff.totals.export_files,
    },
    effort_estimate: {
      minutes_per_pilot_row: minutesPerPilotRow,
      minutes_per_expansion_row: minutesPerExpansionRow,
      review_minutes_remaining: reviewMinutes,
      adjudication_reserve_minutes: round(adjudicationReserveMinutes),
      total_minutes_with_reserve: round(reviewMinutes + adjudicationReserveMinutes),
      reviewer_hours_with_reserve: round((reviewMinutes + adjudicationReserveMinutes) / 60),
      assumption: 'Estimates cover reading evidence, applying rubric fields, and notes. They are planning estimates, not performance claims.',
    },
    waves,
    acceptance_gates: blockingReviewChecks.map((check) => ({
      id: check.id,
      passed: check.passed,
      detail: check.detail,
      blocker: check.blocker,
    })),
    quality_controls: annotationQualityControl.qa_rules.map((rule) => ({
      id: rule.id,
      threshold: rule.threshold,
      enforcement: rule.enforcement,
    })),
    claim_limits: {
      completion_claim_allowed: false,
      agreement_claim_allowed: annotatorAgreement.summary.agreement_claim_allowed,
      release_promotion_allowed: adjudicationReadiness.release_promotion_allowed,
    },
    summary: {
      waves: waves.length,
      total_rows_remaining: totalRowsRemaining,
      reviewer_hours_with_reserve: round((reviewMinutes + adjudicationReserveMinutes) / 60),
      blocking_review_checks: blockingReviewChecks.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const waveRows = plan.waves.map((wave) => [
    wave.id,
    wave.scope,
    String(wave.rows_remaining),
    String(wave.target_items),
    wave.acceptance_gate_ids.join('<br>'),
  ])
  const gateRows = plan.acceptance_gates.map((gate) => [
    gate.id,
    gate.passed ? 'yes' : 'no',
    gate.detail,
    gate.blocker,
  ])
  const qcRows = plan.quality_controls.map((rule) => [
    rule.id,
    rule.threshold,
    rule.enforcement,
  ])

  return `# Hard Grounded Research Review Execution Plan

This generated plan turns the remaining human review blockers into an executable workload. It does not complete review, adjudicate labels, or clear gold gates.

## Summary

- Plan ready: ${plan.review_execution_plan_ready}
- Version: ${plan.version}
- Rows remaining: ${plan.summary.total_rows_remaining}
- Estimated reviewer hours with reserve: ${plan.summary.reviewer_hours_with_reserve}
- Blocking review checks: ${plan.summary.blocking_review_checks}
- Completion claim allowed: ${plan.claim_limits.completion_claim_allowed}

## Workload

- Pilot rows remaining: ${plan.workload.pilot_rows_remaining}
- Expansion rows remaining: ${plan.workload.expansion_rows_remaining}
- Target reviewed items total: ${plan.workload.target_reviewed_items_total}
- Target reviewed items per category: ${plan.workload.target_reviewed_items_per_category}
- First-wave export rows/files: ${plan.workload.first_wave_export_rows}/${plan.workload.first_wave_export_files}

## Effort Estimate

- Minutes per pilot row: ${plan.effort_estimate.minutes_per_pilot_row}
- Minutes per expansion row: ${plan.effort_estimate.minutes_per_expansion_row}
- Review minutes remaining: ${plan.effort_estimate.review_minutes_remaining}
- Adjudication reserve minutes: ${plan.effort_estimate.adjudication_reserve_minutes}
- Total minutes with reserve: ${plan.effort_estimate.total_minutes_with_reserve}

${plan.effort_estimate.assumption}

## Review Waves

${markdownTable(['Wave', 'Scope', 'Rows remaining', 'Target items', 'Acceptance gates'], waveRows)}

## Blocking Acceptance Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}

## Quality Controls

${markdownTable(['Rule', 'Threshold', 'Enforcement'], qcRows)}
`
}

const plan = buildPlan({
  reviewProgress: readJson(inputs.reviewProgress),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  annotatorAgreement: readJson(inputs.annotatorAgreement),
  adjudicationReadiness: readJson(inputs.adjudicationReadiness),
  powerPlan: readJson(inputs.powerPlan),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))
console.log(`Wrote hard grounded review execution plan to ${planJsonPath}`)
console.log(`Wrote hard grounded review execution plan report to ${planMarkdownPath}`)
