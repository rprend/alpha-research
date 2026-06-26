import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const tablesJsonPath = join(generatedDir, 'paper-tables.json')
const tablesMarkdownPath = join(experimentDir, 'PAPER_TABLES.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
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

function metric(value) {
  if (value === null || value === undefined) return 'n/a'
  return Number(value).toFixed(3)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function table(id, title, caption, columns, rows) {
  return { id, title, caption, columns, rows }
}

function buildPaperTables({
  spec,
  coverageMatrix,
  corpusAudit,
  constructMap,
  baselineAnalysis,
  baselineUncertainty,
  failureAtlas,
  powerPlan,
  noveltyEvidence,
  releaseGate,
}) {
  const constructByCategory = new Map(constructMap.constructs.map((construct) => [construct.category, construct]))
  const uncertaintyBySystem = new Map(
    baselineUncertainty.systems.map((system) => [
      system.system_id,
      Object.fromEntries(Object.entries(system.metrics).map(([name, interval]) => [name, interval])),
    ]),
  )

  const categoryRows = coverageMatrix.map((row) => {
    const construct = constructByCategory.get(row.category)
    return {
      category: row.category,
      datasets: row.datasets,
      seed_tasks: row.task_count,
      rubric_dimensions: construct?.required_dimensions || [],
      target_metrics: construct?.target_metrics || [],
      novelty_risk: construct?.novelty_risk || 'unknown',
      reviewed_gold: `${construct?.review_status?.current_valid_reviewed_items ?? 0}/${construct?.review_status?.target_reviewed_items ?? 0}`,
    }
  })

  const baselineRows = baselineAnalysis.systems.map((system) => {
    const intervals = uncertaintyBySystem.get(system.system_id) || {}
    return {
      system_id: system.system_id,
      tasks: system.task_count,
      answer_correct: system.macro.answer_correct,
      answer_correct_ci95: intervals.answer_correct
        ? [intervals.answer_correct.ci95_low, intervals.answer_correct.ci95_high]
        : null,
      evidence_recall: system.macro.evidence_recall,
      citation_faithfulness: system.macro.citation_faithfulness,
      conclusion_support: system.macro.conclusion_support,
      abstention_quality: system.macro.abstention_quality,
    }
  })

  const challengeRows = baselineAnalysis.systems.flatMap((system) =>
    Object.entries(system.by_challenge_type || {}).map(([challengeType, summary]) => ({
      system_id: system.system_id,
      challenge_type: challengeType,
      tasks: summary.task_count,
      answer_correct: summary.macro.answer_correct,
      evidence_recall: summary.macro.evidence_recall,
      citation_faithfulness: summary.macro.citation_faithfulness,
      conclusion_support: summary.macro.conclusion_support,
    })),
  )

  const failureRows = failureAtlas.failure_mode_summary.map((entry) => ({
    failure_mode: entry.failure_mode,
    cases: entry.case_count,
    systems: entry.system_count,
    categories: entry.category_count,
    challenge_types: entry.challenge_types,
  }))

  const noveltyRows = noveltyEvidence.claim_boundaries.map((claim) => ({
    paper_claim: claim.paper_claim,
    status: claim.allowed ? 'allowed_with_evidence' : 'prohibited_or_unsupported',
    reason: claim.reason,
  }))

  const releaseRows = releaseGate.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      check_id: check.id,
      detail: check.detail,
      required_action: check.blocker,
    }))

  const tables = [
    table(
      'taxonomy_constructs',
      'Benchmark Taxonomy and Construct Operationalization',
      'Each hard-grounded category is tied to source datasets, rubric dimensions, target metrics, novelty risk, and reviewed-gold coverage.',
      ['category', 'datasets', 'seed_tasks', 'rubric_dimensions', 'target_metrics', 'novelty_risk', 'reviewed_gold'],
      categoryRows,
    ),
    table(
      'baseline_macro_results',
      'Pilot Baseline Macro Results',
      'Current pilot results for oracle sanity, non-oracle heuristics, and imported external model reports. Intervals are descriptive over the 30-item pilot.',
      ['system_id', 'tasks', 'answer_correct', 'answer_correct_ci95', 'evidence_recall', 'citation_faithfulness', 'conclusion_support', 'abstention_quality'],
      baselineRows,
    ),
    table(
      'challenge_type_heatmap',
      'Challenge-Type Diagnostic Matrix',
      'Per-system challenge slices showing whether failures are concentrated in temporal, authority, contradiction, overreach, lifecycle, insufficiency, native, or stale/current probes.',
      ['system_id', 'challenge_type', 'tasks', 'answer_correct', 'evidence_recall', 'citation_faithfulness', 'conclusion_support'],
      challengeRows,
    ),
    table(
      'failure_mode_atlas',
      'Observed Pilot Failure Modes',
      'Cross-system qualitative failure modes extracted from scored pilot reports. These are diagnostic examples, not final human-reviewed claims.',
      ['failure_mode', 'cases', 'systems', 'categories', 'challenge_types'],
      failureRows,
    ),
    table(
      'novelty_claim_boundaries',
      'Allowed and Prohibited Novelty Claims',
      'Current June 2026 related-work registry boundaries. Final novelty remains blocked until the literature audit is refreshed before submission.',
      ['paper_claim', 'status', 'reason'],
      noveltyRows,
    ),
    table(
      'paper_readiness_blockers',
      'Remaining Paper-Readiness Blockers',
      'Current release-gate blockers that prevent treating the pilot package as a completed benchmark paper.',
      ['check_id', 'detail', 'required_action'],
      releaseRows,
    ),
  ]

  return {
    paper_tables_ready:
      tables.length >= 6 &&
      tables.every((entry) => entry.rows.length > 0) &&
      baselineRows.length >= 5 &&
      failureRows.length >= 5 &&
      releaseGate.status !== 'release_ready',
    benchmark_id: spec.id,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      coverage_matrix: 'generated/coverage-matrix.json',
      corpus_audit: 'generated/corpus-audit.json',
      construct_map: 'generated/construct-map.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      failure_atlas: 'generated/failure-atlas.json',
      power_plan: 'generated/power-plan.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      table_count: tables.length,
      categories: spec.categories.length,
      source_datasets: spec.datasets.length,
      scaled_public_items: corpusAudit.summary.scaled_public_items,
      scored_systems: baselineRows.length,
      challenge_rows: challengeRows.length,
      failure_modes: failureRows.length,
      novelty_sources: noveltyEvidence.source_count,
      release_blockers: releaseRows.length,
      target_reviewed_items_total: powerPlan.assumptions.target_reviewed_items_total,
      completion_claim_allowed: false,
    },
    tables,
  }
}

function cell(value) {
  if (Array.isArray(value)) return value.map((entry) => (typeof entry === 'number' ? metric(entry) : entry)).join('<br>')
  if (typeof value === 'number') return metric(value)
  return String(value ?? '')
}

function renderTable(entry) {
  const rows = entry.rows.map((row) => entry.columns.map((column) => cell(row[column])))
  return `## ${entry.title}

${entry.caption}

${markdownTable(entry.columns, rows)}
`
}

function renderMarkdown(paperTables) {
  return `# Hard Grounded Research Paper Tables

This generated pack materializes the paper-facing tables and figure data from canonical benchmark artifacts. It is intended to prevent manual copy drift between the benchmark, dataset card, release gate, and paper draft.

## Summary

- Paper tables ready: ${paperTables.paper_tables_ready}
- Tables: ${paperTables.summary.table_count}
- Categories: ${paperTables.summary.categories}
- Source datasets: ${paperTables.summary.source_datasets}
- Scaled public items: ${paperTables.summary.scaled_public_items}
- Scored systems: ${paperTables.summary.scored_systems}
- Challenge rows: ${paperTables.summary.challenge_rows}
- Failure modes: ${paperTables.summary.failure_modes}
- Novelty sources: ${paperTables.summary.novelty_sources}
- Release blockers: ${paperTables.summary.release_blockers}
- Target reviewed items total: ${paperTables.summary.target_reviewed_items_total}
- Completion claim allowed: ${paperTables.summary.completion_claim_allowed}

${paperTables.tables.map(renderTable).join('\n')}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing paper tables input ${name}: ${path}`)
}

const paperTables = buildPaperTables({
  spec: readJson(inputs.spec),
  coverageMatrix: readJson(inputs.coverageMatrix),
  corpusAudit: readJson(inputs.corpusAudit),
  constructMap: readJson(inputs.constructMap),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  failureAtlas: readJson(inputs.failureAtlas),
  powerPlan: readJson(inputs.powerPlan),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(tablesJsonPath, paperTables)
writeText(tablesMarkdownPath, renderMarkdown(paperTables))
console.log(`Wrote hard grounded research paper tables to ${tablesJsonPath}`)
console.log(`Wrote hard grounded research paper tables report to ${tablesMarkdownPath}`)
