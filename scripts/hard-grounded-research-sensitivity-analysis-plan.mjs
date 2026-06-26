import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'sensitivity-analysis-plan.json')
const planMarkdownPath = join(experimentDir, 'SENSITIVITY_ANALYSIS_PLAN.md')

const inputs = {
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  estimandRegistry: join(generatedDir, 'estimand-registry.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
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

function buildPlan({ scoringContract, modelReportingCard, estimandRegistry, analysisPlan, powerPlan, paperClaimLedger, releaseGate }) {
  const claimGates = ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const checks = [
    {
      id: 'metric_strictness',
      perturbation: 'Recompute headline and category metrics under strict citation faithfulness: any unsupported cited sentence sets citation_faithfulness and conclusion_support to 0.',
      affected_metrics: ['citation_faithfulness', 'conclusion_support'],
      estimand_link: 'All category estimands with citation or conclusion metrics.',
      decision_rule: 'If a qualitative conclusion changes sign or interval interpretation under strict support, report the claim as sensitivity-dependent.',
    },
    {
      id: 'abstention_policy',
      perturbation: 'Score false abstentions as answer errors and compare with a lenient policy that gives partial credit only on reviewed insufficiency or irreconcilable conflict items.',
      affected_metrics: ['answer_correctness', 'abstention_quality'],
      estimand_link: 'Evidence insufficiency, cross-document contradiction, and temporal estimands.',
      decision_rule: 'Claims about abstention quality require the same direction under strict and lenient policies.',
    },
    {
      id: 'aggregation_weighting',
      perturbation: 'Compare unweighted category macro averages with item-weighted overall averages and source-dataset stratified averages.',
      affected_metrics: scoringContract.required_metric_ids,
      estimand_link: 'All benchmark-level and category-level estimands.',
      decision_rule: 'Benchmark-level claims must disclose when category weighting changes model ordering or effect magnitude by more than the planned uncertainty interval.',
    },
    {
      id: 'model_eligibility',
      perturbation: 'Run headline contrasts on eligible external model baselines only, then separately on all diagnostic systems.',
      affected_metrics: scoringContract.required_metric_ids,
      estimand_link: 'System comparison estimands and reporting-card claims.',
      decision_rule: 'Do not promote a model comparison claim if it appears only after adding diagnostic systems excluded by the reporting card.',
    },
    {
      id: 'missing_review_data',
      perturbation: 'Treat missing or non-merge-ready reviewed items as excluded in the primary analysis and as worst-case failures in a conservative bound.',
      affected_metrics: scoringContract.required_metric_ids,
      estimand_link: 'All confirmatory reviewed-data estimands.',
      decision_rule: 'No category claim is allowed when worst-case missing-review bounds cross the null or contradict the primary direction.',
    },
    {
      id: 'multiple_testing',
      perturbation: 'Report unadjusted intervals plus family-level false-discovery or Holm-style sensitivity for the ten category hypotheses.',
      affected_metrics: analysisPlan.response_metrics,
      estimand_link: 'All category hypotheses in the estimand registry.',
      decision_rule: 'Treat claims that survive only unadjusted intervals as exploratory, not confirmatory.',
    },
  ]

  const readinessChecks = [
    {
      id: 'all_required_metric_families_have_sensitivity_checks',
      passed:
        scoringContract.required_metric_ids.every((metric) =>
          checks.some((check) => check.affected_metrics.includes(metric)),
        ) && checks.length >= 6,
      detail: `${scoringContract.required_metric_ids.length} required metrics covered across ${checks.length} sensitivity checks`,
    },
    {
      id: 'estimands_linked_to_sensitivity_checks',
      passed:
        estimandRegistry.estimand_registry_ready &&
        estimandRegistry.summary.estimands === 10 &&
        checks.every((check) => check.estimand_link),
      detail: `${estimandRegistry.summary.estimands} estimands; ${checks.length} checks with estimand links`,
    },
    {
      id: 'model_reporting_limits_respected',
      passed:
        modelReportingCard.model_reporting_card_ready &&
        modelReportingCard.claim_limits.public_leaderboard_allowed === false &&
        checks.some((check) => check.id === 'model_eligibility'),
      detail: `${modelReportingCard.summary.eligible_model_baselines} eligible baselines; public_leaderboard_allowed=${modelReportingCard.claim_limits.public_leaderboard_allowed}`,
    },
    {
      id: 'claims_remain_gated',
      passed:
        claimGates.some((gate) => !gate.passed) &&
        paperClaimLedger.completion_claim_allowed === false &&
        powerPlan.current_state.current_valid_reviewed_items < powerPlan.assumptions.target_reviewed_items_total,
      detail: `${claimGates.filter((gate) => !gate.passed).length}/${claimGates.length} confirmatory gates blocked; reviewed=${powerPlan.current_state.current_valid_reviewed_items}/${powerPlan.assumptions.target_reviewed_items_total}`,
    },
  ]

  return {
    sensitivity_analysis_plan_ready: readinessChecks.every((check) => check.passed),
    version: 'sensitivity-analysis-plan-v1',
    completion_claim_allowed: false,
    generated_from: {
      scoring_contract: 'generated/scoring-contract.json',
      model_reporting_card: 'generated/model-reporting-card.json',
      estimand_registry: 'generated/estimand-registry.json',
      analysis_plan: 'generated/analysis-plan.json',
      power_plan: 'generated/power-plan.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      release_gate: 'generated/release-gate.json',
    },
    checks: readinessChecks,
    sensitivity_checks: checks,
    claim_gates: claimGates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    summary: {
      sensitivity_checks: checks.length,
      required_metrics: scoringContract.required_metric_ids.length,
      estimands: estimandRegistry.summary.estimands,
      eligible_model_baselines: modelReportingCard.summary.eligible_model_baselines,
      blocked_claim_gates: claimGates.filter((gate) => !gate.passed).length,
      reviewed_items_current: powerPlan.current_state.current_valid_reviewed_items,
      reviewed_items_target: powerPlan.assumptions.target_reviewed_items_total,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(plan) {
  const checkRows = plan.checks.map((check) => [check.id, String(check.passed), check.detail])
  const sensitivityRows = plan.sensitivity_checks.map((check) => [
    check.id,
    check.perturbation,
    check.affected_metrics.join('<br>'),
    check.estimand_link,
    check.decision_rule,
  ])
  const gateRows = plan.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Sensitivity Analysis Plan

This generated plan pre-registers robustness checks for paper results. It defines how conclusions should change, narrow, or remain exploratory when metric strictness, abstention policy, aggregation, model eligibility, missing reviews, or multiple testing assumptions change.

## Summary

- Plan ready: ${plan.sensitivity_analysis_plan_ready}
- Version: ${plan.version}
- Sensitivity checks: ${plan.summary.sensitivity_checks}
- Required metrics covered: ${plan.summary.required_metrics}
- Estimands: ${plan.summary.estimands}
- Eligible model baselines: ${plan.summary.eligible_model_baselines}
- Blocked claim gates: ${plan.summary.blocked_claim_gates}
- Reviewed items: ${plan.summary.reviewed_items_current}/${plan.summary.reviewed_items_target}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Readiness Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Sensitivity Checks

${markdownTable(['ID', 'Perturbation', 'Affected metrics', 'Estimand link', 'Decision rule'], sensitivityRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const plan = buildPlan({
  scoringContract: readJson(inputs.scoringContract),
  modelReportingCard: readJson(inputs.modelReportingCard),
  estimandRegistry: readJson(inputs.estimandRegistry),
  analysisPlan: readJson(inputs.analysisPlan),
  powerPlan: readJson(inputs.powerPlan),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded sensitivity analysis plan to ${planJsonPath}`)
console.log(`Wrote hard grounded sensitivity analysis plan report to ${planMarkdownPath}`)
