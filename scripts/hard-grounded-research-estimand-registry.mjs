import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const registryJsonPath = join(generatedDir, 'estimand-registry.json')
const registryMarkdownPath = join(experimentDir, 'ESTIMAND_REGISTRY.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  evidenceSufficiencyAudit: join(generatedDir, 'evidence-sufficiency-audit.json'),
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

function estimandForHypothesis(row, { spec, powerPlan, evidenceSufficiencyAudit }) {
  const categoryEvidence = evidenceSufficiencyAudit.category_rows.find((entry) => entry.category === row.category)
  return {
    id: `estimand_${row.category.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '').toLowerCase()}`,
    category: row.category,
    hypothesis: row.hypothesis,
    target_population:
      'Large-corpus grounded research QA tasks drawn from the registered Hugging Face source datasets and transformed into the specified hard-grounding category.',
    analysis_unit: 'item_system_response',
    eligible_items:
      `Reviewed gold items in category "${row.category}" with valid evidence contracts and no unresolved generation defects.`,
    eligible_systems:
      'Systems with complete predictions under the submission contract on the same reviewed item set.',
    primary_contrast: row.contrast,
    primary_metrics: row.primary_metrics,
    estimator:
      'Mean paired system-level metric difference, reported with task bootstrap confidence intervals and category descriptive intervals.',
    uncertainty_method:
      'Paired task bootstrap for current pilot diagnostics; reviewed release reports category intervals and paired system deltas with alpha=0.05.',
    minimum_sample:
      `${powerPlan.assumptions.target_reviewed_items_per_category} double-reviewed items in this category and at least two eligible model baselines.`,
    adjustment_variables: ['system_id', 'source_dataset', 'evidence_unit_count', 'challenge_type', 'review_status'],
    missing_data_policy:
      'Exclude items without valid merged reviews from confirmatory estimates; report missing review rows and blocked item counts separately.',
    multiplicity_policy:
      'Treat category hypotheses as pre-registered families; report all category estimates and avoid winner-take-all claims when intervals overlap.',
    evidence_contract:
      `${categoryEvidence?.evidence_contracts_present ?? 0}/${categoryEvidence?.item_count ?? 0} pilot contracts present; ${categoryEvidence?.distractor_or_control_items ?? 0} trap/control pilot items.`,
    claim_status: 'diagnostic_only_until_review_scale_and_novelty_clear',
  }
}

function buildRegistry({
  spec,
  analysisPlan,
  hypothesisTestMatrix,
  powerPlan,
  baselineUncertainty,
  evidenceSufficiencyAudit,
  paperClaimLedger,
  releaseGate,
}) {
  const estimands = hypothesisTestMatrix.rows.map((row) =>
    estimandForHypothesis(row, { spec, powerPlan, evidenceSufficiencyAudit }),
  )
  const claimGates = ['gold_review_complete', 'review_merge_ready', 'category_scale_ready', 'novelty_audit_final'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const checks = [
    {
      id: 'all_hypotheses_have_estimands',
      passed: estimands.length === hypothesisTestMatrix.summary.categories && estimands.every((entry) => entry.primary_metrics.length > 0),
      detail: `${estimands.length}/${hypothesisTestMatrix.summary.categories} category hypotheses have estimands`,
    },
    {
      id: 'estimands_define_population_unit_contrast_metric_estimator',
      passed: estimands.every(
        (entry) =>
          entry.target_population &&
          entry.analysis_unit &&
          entry.primary_contrast &&
          entry.primary_metrics.length &&
          entry.estimator &&
          entry.uncertainty_method,
      ),
      detail: `${estimands.length} estimands define target population, unit, contrast, metric, estimator, and uncertainty method`,
    },
    {
      id: 'estimands_match_power_and_uncertainty_plan',
      passed:
        estimands.every((entry) => entry.minimum_sample.includes(String(powerPlan.assumptions.target_reviewed_items_per_category))) &&
        baselineUncertainty.uncertainty_ready &&
        analysisPlan.summary.reviewed_items_target === powerPlan.assumptions.target_reviewed_items_total,
      detail: `${powerPlan.assumptions.target_reviewed_items_per_category} items/category target; ${baselineUncertainty.system_count} systems with pilot uncertainty`,
    },
    {
      id: 'estimands_require_evidence_contracts',
      passed:
        evidenceSufficiencyAudit.evidence_sufficiency_audit_ready &&
        evidenceSufficiencyAudit.summary.items_with_required_evidence_contract === evidenceSufficiencyAudit.summary.pilot_items,
      detail: `${evidenceSufficiencyAudit.summary.items_with_required_evidence_contract}/${evidenceSufficiencyAudit.summary.pilot_items} pilot items have evidence contracts`,
    },
    {
      id: 'claims_remain_gated',
      passed:
        claimGates.some((gate) => !gate.passed) &&
        paperClaimLedger.completion_claim_allowed === false &&
        estimands.every((entry) => entry.claim_status === 'diagnostic_only_until_review_scale_and_novelty_clear'),
      detail: `${claimGates.filter((gate) => !gate.passed).length}/${claimGates.length} confirmatory gates blocked; completion_claim_allowed=${paperClaimLedger.completion_claim_allowed}`,
    },
  ]

  return {
    estimand_registry_ready: checks.every((check) => check.passed),
    version: 'estimand-registry-v1',
    completion_claim_allowed: false,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      analysis_plan: 'generated/analysis-plan.json',
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      power_plan: 'generated/power-plan.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      evidence_sufficiency_audit: 'generated/evidence-sufficiency-audit.json',
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
    estimands,
    summary: {
      categories: spec.categories.length,
      estimands: estimands.length,
      target_reviewed_items_per_category: powerPlan.assumptions.target_reviewed_items_per_category,
      target_reviewed_items_total: powerPlan.assumptions.target_reviewed_items_total,
      pilot_systems_with_uncertainty: baselineUncertainty.system_count,
      blocked_claim_gates: claimGates.filter((gate) => !gate.passed).length,
      diagnostic_only_estimands: estimands.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(registry) {
  const checkRows = registry.checks.map((check) => [check.id, String(check.passed), check.detail])
  const estimandRows = registry.estimands.map((entry) => [
    entry.category,
    entry.analysis_unit,
    entry.primary_contrast,
    entry.primary_metrics.join('<br>'),
    entry.estimator,
    entry.minimum_sample,
    entry.claim_status,
  ])
  const gateRows = registry.claim_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Estimand Registry

This generated registry states exactly what each category hypothesis estimates. It binds the paper's mechanism claims to target populations, units, contrasts, metrics, estimators, uncertainty methods, sample requirements, and claim gates so pilot diagnostics cannot be mistaken for confirmatory results.

## Summary

- Registry ready: ${registry.estimand_registry_ready}
- Version: ${registry.version}
- Categories: ${registry.summary.categories}
- Estimands: ${registry.summary.estimands}
- Target reviewed items/category: ${registry.summary.target_reviewed_items_per_category}
- Target reviewed items total: ${registry.summary.target_reviewed_items_total}
- Pilot systems with uncertainty: ${registry.summary.pilot_systems_with_uncertainty}
- Blocked claim gates: ${registry.summary.blocked_claim_gates}
- Diagnostic-only estimands: ${registry.summary.diagnostic_only_estimands}
- Completion claim allowed: ${registry.summary.completion_claim_allowed}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Category Estimands

${markdownTable(['Category', 'Unit', 'Primary contrast', 'Primary metrics', 'Estimator', 'Minimum sample', 'Claim status'], estimandRows)}

## Claim Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const registry = buildRegistry({
  spec: readJson(inputs.spec),
  analysisPlan: readJson(inputs.analysisPlan),
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  powerPlan: readJson(inputs.powerPlan),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  evidenceSufficiencyAudit: readJson(inputs.evidenceSufficiencyAudit),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(registryJsonPath, registry)
writeText(registryMarkdownPath, renderMarkdown(registry))

console.log(`Wrote hard grounded estimand registry to ${registryJsonPath}`)
console.log(`Wrote hard grounded estimand registry report to ${registryMarkdownPath}`)
