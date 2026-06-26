import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const templateJsonPath = join(generatedDir, 'statistical-reporting-template.json')
const templateMarkdownPath = join(experimentDir, 'STATISTICAL_REPORTING_TEMPLATE.md')

const inputs = {
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  estimandRegistry: join(generatedDir, 'estimand-registry.json'),
  sensitivityAnalysisPlan: join(generatedDir, 'sensitivity-analysis-plan.json'),
  lookupContrastRegistry: join(generatedDir, 'lookup-contrast-registry.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
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

const metricAliases = {
  answer_correct: 'answer_correctness',
}

function contractMetricId(metric) {
  return metricAliases[metric] || metric
}

function categoryRow(category, estimand, lookupContrast, scoringContract, sensitivityAnalysisPlan) {
  const primaryMetrics = estimand.primary_metrics
  const metricDefinitions = primaryMetrics.map((metric) => {
    const contractId = contractMetricId(metric)
    const definition = scoringContract.metric_definitions.find((entry) => entry.id === contractId)
    return definition ? `${metric}: ${definition.formula}` : `${metric}: missing metric definition`
  })
  const sensitivityChecks = sensitivityAnalysisPlan.sensitivity_checks
    .filter((check) => check.affected_metrics.some((metric) => primaryMetrics.includes(metric) || primaryMetrics.map(contractMetricId).includes(metric)))
    .map((check) => check.id)

  return {
    category,
    estimand_id: estimand.id,
    simple_lookup_control: lookupContrast.lookup_control,
    hard_grounding_operation: lookupContrast.hard_grounding_operation,
    primary_contrast: estimand.primary_contrast,
    analysis_unit: estimand.analysis_unit,
    denominator_rule: estimand.eligible_items,
    minimum_reviewed_items: 30,
    uncertainty_method: estimand.uncertainty_method,
    primary_metrics: primaryMetrics,
    metric_definitions: metricDefinitions,
    sensitivity_checks: sensitivityChecks,
    required_columns: [
      'category',
      'system_id',
      'eligible_model_baseline',
      'reviewed_item_count',
      'merge_ready_item_count',
      ...primaryMetrics.map((metric) => `${metric}_mean`),
      ...primaryMetrics.map((metric) => `${metric}_ci95_low`),
      ...primaryMetrics.map((metric) => `${metric}_ci95_high`),
      'lookup_control_comparison',
      'sensitivity_status',
      'claim_status',
    ],
    claim_status: estimand.claim_status,
  }
}

function buildTemplate({
  scoringContract,
  estimandRegistry,
  sensitivityAnalysisPlan,
  lookupContrastRegistry,
  powerPlan,
  modelReportingCard,
  releaseGate,
  paperClaimLedger,
}) {
  const gateIds = ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final']
  const claimGates = gateIds.map((id) => releaseCheck(releaseGate, id))
  const lookupByCategory = new Map(lookupContrastRegistry.rows.map((row) => [row.category, row]))
  const estimandByCategory = new Map(estimandRegistry.estimands.map((row) => [row.category, row]))
  const reportingRows = lookupContrastRegistry.rows.map((row) =>
    categoryRow(row.category, estimandByCategory.get(row.category), lookupByCategory.get(row.category), scoringContract, sensitivityAnalysisPlan),
  )
  const requiredTableSections = [
    {
      id: 'headline_macro_table',
      purpose: 'Report macro results over merge-ready reviewed items only, with eligible model baselines separated from diagnostic systems.',
      required_columns: ['system_id', 'eligible_model_baseline', 'reviewed_item_count', ...scoringContract.required_metric_ids],
    },
    {
      id: 'category_mechanism_table',
      purpose: 'Report one row per category and system with the category estimand, lookup control contrast, primary metrics, uncertainty, and claim status.',
      required_columns: ['category', 'system_id', 'estimand_id', 'lookup_control_comparison', 'primary_metrics', 'uncertainty_method', 'claim_status'],
    },
    {
      id: 'sensitivity_summary_table',
      purpose: 'Report whether each proposed conclusion survives every pre-registered sensitivity check.',
      required_columns: ['claim_id', 'primary_result', 'sensitivity_check_id', 'decision_rule', 'sensitivity_status'],
    },
    {
      id: 'claim_gate_table',
      purpose: 'Report which paper claims are allowed, diagnostic-only, or prohibited under current review, scale, and novelty gates.',
      required_columns: ['claim_id', 'claim_status', 'supporting_artifact', 'blocking_gate'],
    },
  ]

  const checks = [
    {
      id: 'all_categories_have_reporting_rows',
      passed: reportingRows.length === estimandRegistry.summary.estimands && reportingRows.length === lookupContrastRegistry.summary.categories,
      detail: `${reportingRows.length} reporting rows for ${estimandRegistry.summary.estimands} estimands and ${lookupContrastRegistry.summary.categories} lookup contrasts`,
    },
    {
      id: 'primary_metrics_have_definitions_and_columns',
      passed: reportingRows.every((row) =>
        row.primary_metrics.every((metric) => row.required_columns.includes(`${metric}_mean`) && row.metric_definitions.some((definition) => definition.startsWith(`${metric}:`) && !definition.includes('missing metric definition'))),
      ),
      detail: `${scoringContract.required_metric_ids.length} required metrics; ${reportingRows.reduce((sum, row) => sum + row.primary_metrics.length, 0)} category primary-metric slots`,
    },
    {
      id: 'uncertainty_and_denominator_rules_present',
      passed: reportingRows.every((row) => row.uncertainty_method && row.denominator_rule && row.minimum_reviewed_items >= powerPlan.assumptions.target_reviewed_items_per_category),
      detail: `minimum reviewed items/category=${powerPlan.assumptions.target_reviewed_items_per_category}; rows with uncertainty=${reportingRows.filter((row) => row.uncertainty_method).length}`,
    },
    {
      id: 'claims_remain_gated_until_review_scale_and_novelty',
      passed:
        claimGates.some((gate) => !gate.passed) &&
        paperClaimLedger.completion_claim_allowed === false &&
        modelReportingCard.claim_limits.public_leaderboard_allowed === false,
      detail: `${claimGates.filter((gate) => !gate.passed).length}/${claimGates.length} confirmatory gates blocked; completion_claim_allowed=${paperClaimLedger.completion_claim_allowed}`,
    },
  ]

  return {
    statistical_reporting_template_ready: checks.every((check) => check.passed),
    version: 'statistical-reporting-template-v1',
    completion_claim_allowed: false,
    generated_from: {
      scoring_contract: 'generated/scoring-contract.json',
      estimand_registry: 'generated/estimand-registry.json',
      sensitivity_analysis_plan: 'generated/sensitivity-analysis-plan.json',
      lookup_contrast_registry: 'generated/lookup-contrast-registry.json',
      power_plan: 'generated/power-plan.json',
      model_reporting_card: 'generated/model-reporting-card.json',
      release_gate: 'generated/release-gate.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
    },
    checks,
    required_table_sections: requiredTableSections,
    category_reporting_rows: reportingRows,
    claim_gates: claimGates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    summary: {
      categories: reportingRows.length,
      required_table_sections: requiredTableSections.length,
      required_metrics: scoringContract.required_metric_ids.length,
      sensitivity_checks: sensitivityAnalysisPlan.summary.sensitivity_checks,
      blocked_claim_gates: claimGates.filter((gate) => !gate.passed).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(template) {
  const checkRows = template.checks.map((check) => [check.id, String(check.passed), check.detail])
  const sectionRows = template.required_table_sections.map((section) => [
    section.id,
    section.purpose,
    section.required_columns.join('<br>'),
  ])
  const categoryRows = template.category_reporting_rows.map((row) => [
    row.category,
    row.estimand_id,
    row.simple_lookup_control,
    row.hard_grounding_operation,
    row.primary_metrics.join('<br>'),
    row.uncertainty_method,
    row.claim_status,
  ])
  const gateRows = template.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Statistical Reporting Template

This generated template defines the minimum result-reporting surface for a paper submission. It prevents reviewed results from being reported as broad benchmark claims unless each category table includes the estimand, lookup contrast, denominator, uncertainty method, sensitivity status, and active claim gates.

## Summary

- Template ready: ${template.statistical_reporting_template_ready}
- Version: ${template.version}
- Categories: ${template.summary.categories}
- Required table sections: ${template.summary.required_table_sections}
- Required metrics: ${template.summary.required_metrics}
- Sensitivity checks: ${template.summary.sensitivity_checks}
- Blocked claim gates: ${template.summary.blocked_claim_gates}
- Completion claim allowed: ${template.summary.completion_claim_allowed}

## Readiness Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Required Table Sections

${markdownTable(['Section', 'Purpose', 'Required columns'], sectionRows)}

## Category Reporting Rows

${markdownTable(['Category', 'Estimand', 'Simple lookup control', 'Hard grounding operation', 'Primary metrics', 'Uncertainty', 'Claim status'], categoryRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const template = buildTemplate({
  scoringContract: readJson(inputs.scoringContract),
  estimandRegistry: readJson(inputs.estimandRegistry),
  sensitivityAnalysisPlan: readJson(inputs.sensitivityAnalysisPlan),
  lookupContrastRegistry: readJson(inputs.lookupContrastRegistry),
  powerPlan: readJson(inputs.powerPlan),
  modelReportingCard: readJson(inputs.modelReportingCard),
  releaseGate: readJson(inputs.releaseGate),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
})

writeJson(templateJsonPath, template)
writeText(templateMarkdownPath, renderMarkdown(template))

console.log(`Wrote hard grounded statistical reporting template to ${templateJsonPath}`)
console.log(`Wrote hard grounded statistical reporting template report to ${templateMarkdownPath}`)
