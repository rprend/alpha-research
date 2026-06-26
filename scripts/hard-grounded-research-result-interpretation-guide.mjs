import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const guideJsonPath = join(generatedDir, 'result-interpretation-guide.json')
const guideMarkdownPath = join(experimentDir, 'RESULT_INTERPRETATION_GUIDE.md')

const inputs = {
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
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

function buildGuide({ hypothesisTestMatrix, powerPlan, baselineUncertainty, paperClaimLedger, releaseGate }) {
  const claimGates = ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const rows = hypothesisTestMatrix.rows.map((row) => ({
    category: row.category,
    hypothesis: row.hypothesis,
    contrast: row.contrast,
    primary_metrics: row.primary_metrics,
    confirm_rule:
      `After reviewed scale clears, confirm only if the category shows a deficit on at least two primary metrics for ${row.contrast} and the expected failure signature appears in reviewed errors.`,
    partial_rule:
      'Treat as partial support if metric deficits appear but failure signatures are mixed, or if failure signatures appear without a stable metric deficit.',
    falsify_rule:
      'Treat as falsified or requiring revision if reviewed systems do not show the expected failure signature and primary metrics are indistinguishable from easier lookup-style controls.',
    minimum_evidence: [
      `${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items in the category`,
      'two or more eligible model baselines scored on the same reviewed source',
      'reviewed error codes aligned to expected failure signatures',
      'final novelty audit allowing the claim boundary',
    ],
    current_status: row.claim_status,
  }))
  const checks = [
    {
      id: 'all_hypotheses_have_interpretation_rules',
      passed: rows.length === hypothesisTestMatrix.summary.categories && rows.every((row) => row.confirm_rule && row.partial_rule && row.falsify_rule),
      detail: `${rows.length}/${hypothesisTestMatrix.summary.categories} hypotheses mapped to confirm/partial/falsify rules`,
    },
    {
      id: 'minimum_evidence_matches_power_plan',
      passed:
        rows.every((row) => row.minimum_evidence.join(' ').includes(String(powerPlan.assumptions.target_reviewed_items_per_category))) &&
        powerPlan.assumptions.target_reviewed_items_total >= 300,
      detail: `${powerPlan.assumptions.target_reviewed_items_per_category} reviewed items/category; ${powerPlan.assumptions.target_reviewed_items_total} total target`,
    },
    {
      id: 'uncertainty_reporting_required',
      passed: Boolean(baselineUncertainty.uncertainty_ready) && baselineUncertainty.system_count >= 5,
      detail: `${baselineUncertainty.system_count} pilot systems with uncertainty summaries`,
    },
    {
      id: 'claims_remain_gated',
      passed:
        claimGates.some((gate) => !gate.passed) &&
        paperClaimLedger.completion_claim_allowed === false &&
        rows.every((row) => row.current_status.startsWith('diagnostic_only')),
      detail: `${claimGates.filter((gate) => !gate.passed).length}/${claimGates.length} claim gates blocked; completion_claim_allowed=${paperClaimLedger.completion_claim_allowed}`,
    },
  ]

  return {
    result_interpretation_guide_ready: checks.every((check) => check.passed),
    version: 'result-interpretation-guide-v1',
    completion_claim_allowed: false,
    generated_from: {
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      power_plan: 'generated/power-plan.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    claim_gates: claimGates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    rows,
    summary: {
      categories: rows.length,
      interpretation_rules: rows.length * 3,
      reviewed_items_per_category_target: powerPlan.assumptions.target_reviewed_items_per_category,
      reviewed_items_total_target: powerPlan.assumptions.target_reviewed_items_total,
      blocked_claim_gates: claimGates.filter((gate) => !gate.passed).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(guide) {
  const checkRows = guide.checks.map((check) => [check.id, String(check.passed), check.detail])
  const guideRows = guide.rows.map((row) => [
    row.category,
    row.contrast,
    row.primary_metrics.join('<br>'),
    row.confirm_rule,
    row.partial_rule,
    row.falsify_rule,
    row.current_status,
  ])
  const gateRows = guide.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Result Interpretation Guide

This generated guide pre-registers how reviewed benchmark results should be interpreted. It prevents the paper from treating pilot diagnostics as confirmed mechanism claims and defines what would count as support, partial support, or falsification for each category hypothesis.

## Summary

- Guide ready: ${guide.result_interpretation_guide_ready}
- Version: ${guide.version}
- Categories: ${guide.summary.categories}
- Interpretation rules: ${guide.summary.interpretation_rules}
- Reviewed items/category target: ${guide.summary.reviewed_items_per_category_target}
- Reviewed items total target: ${guide.summary.reviewed_items_total_target}
- Blocked claim gates: ${guide.summary.blocked_claim_gates}
- Completion claim allowed: ${guide.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Interpretation Rules

${markdownTable(['Category', 'Registered contrast', 'Primary metrics', 'Confirm', 'Partial support', 'Falsify or revise', 'Current status'], guideRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const guide = buildGuide({
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  powerPlan: readJson(inputs.powerPlan),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(guideJsonPath, guide)
writeText(guideMarkdownPath, renderMarkdown(guide))

console.log(`Wrote hard grounded result interpretation guide to ${guideJsonPath}`)
console.log(`Wrote hard grounded result interpretation guide report to ${guideMarkdownPath}`)
