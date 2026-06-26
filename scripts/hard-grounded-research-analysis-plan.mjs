import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const analysisPlanJsonPath = join(generatedDir, 'analysis-plan.json')
const analysisPlanMarkdownPath = join(experimentDir, 'ANALYSIS_PLAN.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || { id, passed: false, detail: 'missing release check' }
}

function buildAnalysisPlan({
  spec,
  constructMap,
  baselineAnalysis,
  baselineUncertainty,
  failureAtlas,
  paperTables,
  powerPlan,
  releaseGate,
}) {
  const releaseBlockers = releaseGate.checks.filter((check) => !check.passed)
  const challengeTypes = [
    ...new Set(
      baselineAnalysis.systems.flatMap((system) => Object.keys(system.by_challenge_type || {})),
    ),
  ].sort()
  const targetMetrics = [
    'answer_correct',
    'evidence_recall',
    'citation_faithfulness',
    'conclusion_support',
    'abstention_quality',
  ]

  const hypotheses = [
    {
      id: 'h1_non_lookup_tasks_reduce_grounded_accuracy',
      claim: 'Hard-grounded challenge types reduce answer correctness and citation faithfulness relative to native-row lookup-style tasks.',
      primary_metrics: ['answer_correct', 'citation_faithfulness'],
      primary_contrasts: ['native_row_vs_challenge_type', 'native_row_vs_category'],
      minimum_evidence: 'At least 30 HF-derived paper-eligible items per category and two eligible model baselines over the same derived source.',
    },
    {
      id: 'h2_support_is_not_equivalent_to_citation_overlap',
      claim: 'Citation overlap is insufficient: systems can cite relevant facts while failing conclusion support.',
      primary_metrics: ['conclusion_support', 'citation_precision', 'citation_faithfulness'],
      primary_contrasts: ['citation_overreach_probe_vs_native_row', 'conclusion_support_delta_by_system'],
      minimum_evidence: 'HF-derived citation-overreach items with deterministic premise/conclusion separation and optional audit review.',
    },
    {
      id: 'h3_temporal_authority_and_contradiction_failures_are_distinct',
      claim: 'Temporal, source-authority, and contradiction tasks produce separable failure signatures rather than one generic retrieval failure.',
      primary_metrics: ['answer_correct', 'abstention_quality', 'conclusion_support'],
      primary_contrasts: ['as_of_date_vs_authority_conflict', 'authority_conflict_vs_cross_document_contradiction'],
      minimum_evidence: 'Reviewed items in all three constructs plus per-system challenge-type diagnostics.',
    },
    {
      id: 'h4_verification_trades_answer_coverage_for_groundedness',
      claim: 'Citation-aware verification improves conclusion support or citation faithfulness while reducing answer coverage on some challenge types.',
      primary_metrics: ['answer_correct', 'citation_faithfulness', 'conclusion_support', 'abstention_quality'],
      primary_contrasts: ['citation_aware_verifier_vs_lexical_baseline', 'external_model_vs_verifier_by_challenge'],
      minimum_evidence: 'Paired system outputs on identical reviewed tasks with uncertainty intervals.',
    },
  ]

  const modelFamilies = [
    {
      id: 'paired_task_bootstrap',
      purpose: 'Estimate paired deltas between systems and challenge types without assuming normal task-level errors.',
      unit: 'task',
      outputs: ['mean_delta', 'ci95_low', 'ci95_high'],
      current_status: baselineUncertainty.system_count >= 5 ? 'pilot_available' : 'missing_pilot_inputs',
    },
    {
      id: 'category_level_descriptive_intervals',
      purpose: 'Report category means and conservative intervals once each category reaches the reviewed item target.',
      unit: 'category',
      outputs: ['category_mean', 'worst_case_half_width', 'reviewed_n'],
      current_status: powerPlan.current_state.current_valid_reviewed_items > 0 ? 'review_started' : 'blocked_on_human_review',
    },
    {
      id: 'mixed_effects_logistic_or_beta_model',
      purpose: 'Separate effects of system, challenge type, category, and item source when reviewed scale is available.',
      unit: 'task_system_score',
      outputs: ['system_effect', 'challenge_effect', 'category_effect', 'source_dataset_effect'],
      current_status: powerPlan.assumptions.target_reviewed_items_total >= 300 ? 'specified_not_estimable_yet' : 'underspecified',
    },
    {
      id: 'failure_mode_enrichment',
      purpose: 'Test whether observed failure modes concentrate in the intended constructs.',
      unit: 'failure_case',
      outputs: ['failure_mode_rate', 'category_enrichment', 'challenge_enrichment'],
      current_status: failureAtlas.summary.failure_mode_count >= 5 ? 'pilot_available' : 'missing_failure_atlas',
    },
  ]

  const covariates = [
    { id: 'category', source: 'construct_map', required: true },
    { id: 'challenge_type', source: 'baseline_analysis.by_challenge_type', required: true },
    { id: 'source_dataset', source: 'benchmark_spec.datasets', required: true },
    { id: 'system_id', source: 'baseline_analysis.systems', required: true },
    { id: 'evidence_unit_count', source: 'pilot_or_gold_suite', required: true },
    { id: 'required_citation_count', source: 'pilot_or_gold_suite', required: true },
    { id: 'review_status', source: 'release_gate_and_review_reports', required: true },
  ]

  const claimGates = [
    {
      claim_scope: 'pilot diagnostics',
      allowed_now: true,
      requirements: ['scored pilot systems', 'failure atlas', 'paper tables'],
      current_evidence: `${baselineAnalysis.systems.length} systems; ${failureAtlas.summary.failure_case_count} failure cases; ${paperTables.summary.table_count} tables`,
    },
    {
      claim_scope: 'category-level benchmark conclusions',
      allowed_now: releaseCheck(releaseGate, 'category_scale_ready').passed,
      requirements: ['30 HF-derived paper-eligible items per category', 'category scale ready', 'novelty audit final before completion claims'],
      current_evidence: `${powerPlan.current_state.current_hf_derived_items}/${powerPlan.assumptions.target_reviewed_items_total} HF-derived target items`,
    },
    {
      claim_scope: 'final novelty claim',
      allowed_now: false,
      requirements: ['final June 2026 literature refresh', 'novelty audit final'],
      current_evidence: releaseBlockers.find((check) => check.id === 'novelty_audit_final')?.detail || 'not blocked',
    },
  ]

  return {
    analysis_plan_ready:
      hypotheses.length >= 4 &&
      modelFamilies.length >= 4 &&
      covariates.every((entry) => entry.id && entry.source) &&
      claimGates.some((gate) => gate.claim_scope === 'category-level benchmark conclusions' && gate.allowed_now) &&
      claimGates.some((gate) => gate.claim_scope === 'final novelty claim' && !gate.allowed_now),
    benchmark_id: spec.id,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      construct_map: 'generated/construct-map.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      failure_atlas: 'generated/failure-atlas.json',
      paper_tables: 'generated/paper-tables.json',
      power_plan: 'generated/power-plan.json',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      categories: spec.categories.length,
      constructs_mapped: constructMap.summary.ready_constructs,
      scored_systems: baselineAnalysis.systems.length,
      challenge_types: challengeTypes.length,
      target_metrics: targetMetrics.length,
      hypotheses: hypotheses.length,
      model_families: modelFamilies.length,
      covariates: covariates.length,
      claim_gates: claimGates.length,
      reviewed_items_current: powerPlan.current_state.current_valid_reviewed_items,
      reviewed_items_target: powerPlan.assumptions.target_reviewed_items_total,
      hf_derived_items_current: powerPlan.current_state.current_hf_derived_items,
      hf_derived_items_target: powerPlan.assumptions.target_reviewed_items_total,
      completion_claim_allowed: false,
    },
    response_metrics: targetMetrics,
    challenge_types: challengeTypes,
    hypotheses,
    model_families: modelFamilies,
    covariates,
    claim_gates: claimGates,
  }
}

function renderMarkdown(plan) {
  const hypothesisRows = plan.hypotheses.map((entry) => [
    entry.id,
    entry.claim,
    entry.primary_metrics.join('<br>'),
    entry.primary_contrasts.join('<br>'),
    entry.minimum_evidence,
  ])
  const modelRows = plan.model_families.map((entry) => [
    entry.id,
    entry.purpose,
    entry.unit,
    entry.outputs.join('<br>'),
    entry.current_status,
  ])
  const covariateRows = plan.covariates.map((entry) => [
    entry.id,
    entry.source,
    entry.required ? 'yes' : 'no',
  ])
  const gateRows = plan.claim_gates.map((entry) => [
    entry.claim_scope,
    entry.allowed_now ? 'yes' : 'no',
    entry.requirements.join('<br>'),
    entry.current_evidence,
  ])

  return `# Hard Grounded Research Analysis Plan

This generated plan pre-specifies how the benchmark should answer the paper question: what makes grounded research hard beyond simple fact lookup? It is a pilot analysis plan, not final statistical evidence.

## Summary

- Analysis plan ready: ${plan.analysis_plan_ready}
- Categories: ${plan.summary.categories}
- Constructs mapped: ${plan.summary.constructs_mapped}
- Scored systems: ${plan.summary.scored_systems}
- Challenge types: ${plan.summary.challenge_types}
- Response metrics: ${plan.summary.target_metrics}
- Hypotheses: ${plan.summary.hypotheses}
- Model families: ${plan.summary.model_families}
- Covariates: ${plan.summary.covariates}
- Claim gates: ${plan.summary.claim_gates}
- Reviewed items: ${plan.summary.reviewed_items_current}/${plan.summary.reviewed_items_target}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Response Metrics

${plan.response_metrics.map((metric) => `- \`${metric}\``).join('\n')}

## Challenge Types

${plan.challenge_types.map((type) => `- \`${type}\``).join('\n')}

## Hypotheses

${markdownTable(['ID', 'Claim', 'Primary metrics', 'Primary contrasts', 'Minimum evidence'], hypothesisRows)}

## Model Families

${markdownTable(['ID', 'Purpose', 'Unit', 'Outputs', 'Current status'], modelRows)}

## Covariates

${markdownTable(['Covariate', 'Source', 'Required'], covariateRows)}

## Claim Gates

${markdownTable(['Claim scope', 'Allowed now', 'Requirements', 'Current evidence'], gateRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing analysis plan input ${name}: ${path}`)
}

const plan = buildAnalysisPlan({
  spec: readJson(inputs.spec),
  constructMap: readJson(inputs.constructMap),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  failureAtlas: readJson(inputs.failureAtlas),
  paperTables: readJson(inputs.paperTables),
  powerPlan: readJson(inputs.powerPlan),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(analysisPlanJsonPath, plan)
writeText(analysisPlanMarkdownPath, renderMarkdown(plan))
console.log(`Wrote hard grounded research analysis plan to ${analysisPlanJsonPath}`)
console.log(`Wrote hard grounded research analysis plan report to ${analysisPlanMarkdownPath}`)
