import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const atlasJsonPath = join(generatedDir, 'failure-atlas.json')
const atlasMarkdownPath = join(experimentDir, 'FAILURE_ATLAS.md')

const inputs = {
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
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

function metric(value) {
  if (value === null || value === undefined) return 'n/a'
  return Number(value).toFixed(4)
}

function failureModes(score, item) {
  const modes = []
  if (score.answer_correct < 1) modes.push('wrong_answer')
  if (score.evidence_recall < 1) modes.push('missing_required_evidence')
  if (score.citation_faithfulness < 1) modes.push('citation_not_faithful_to_answer')
  if (score.conclusion_support < 1) modes.push('citation_does_not_support_conclusion')
  if (score.abstention_quality < 1) modes.push('bad_abstention_or_conflict_behavior')
  if (item?.challenge?.type === 'as_of_date_constraint' && score.answer_correct < 1) modes.push('temporal_scope_failure')
  if (item?.challenge?.type === 'authority_conflict' && score.answer_correct < 1) modes.push('authority_resolution_failure')
  if (item?.challenge?.type === 'cross_document_contradiction' && score.answer_correct < 1) modes.push('contradiction_resolution_failure')
  return modes
}

function reportPaths(modelRunIndex) {
  const fixed = [
    join(experimentDir, 'runs/local-rule-agent-v1/report.json'),
    join(experimentDir, 'runs/lexical-evidence-baseline-v1/report.json'),
    join(experimentDir, 'runs/citation-aware-verifier-v1/report.json'),
  ]
  const indexed = (modelRunIndex.runs || [])
    .filter((run) => run.report_path && (run.eligible_model_baseline || run.system_id?.includes('grounded-baseline')))
    .map((run) => join(root, run.report_path))
  return [...new Set([...fixed, ...indexed])].filter((path) => existsSync(path))
}

function caseSeverity(score) {
  const values = [
    score.answer_correct,
    score.evidence_recall,
    score.citation_faithfulness,
    score.conclusion_support,
    score.abstention_quality,
  ]
  return Number((values.reduce((sum, value) => sum + (1 - Number(value || 0)), 0) / values.length).toFixed(4))
}

function buildAtlas({ pilotSuite, baselineAnalysis, modelRunIndex, releaseGate }) {
  const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
  const reports = reportPaths(modelRunIndex).map(readJson)
  const cases = []

  for (const report of reports) {
    for (const score of report.task_scores || []) {
      const item = pilotById.get(score.task_id)
      const modes = failureModes(score, item)
      if (!modes.length) continue
      cases.push({
        system_id: report.system_id,
        task_id: score.task_id,
        category: score.category,
        challenge_type: item?.challenge?.type || 'native_row',
        expected_failure: item?.expected_failure || '',
        question: item?.question || '',
        expected_answer: score.expected_answer,
        submitted_answer: score.submitted_answer,
        failure_modes: modes,
        severity: caseSeverity(score),
        metrics: {
          answer_correct: score.answer_correct,
          evidence_recall: score.evidence_recall,
          citation_faithfulness: score.citation_faithfulness,
          conclusion_support: score.conclusion_support,
          abstention_quality: score.abstention_quality,
        },
        missing_required_citations: (score.required_citations || []).filter(
          (id) => !(score.submitted_citations || []).includes(id),
        ),
      })
    }
  }

  cases.sort(
    (left, right) =>
      right.severity - left.severity ||
      left.category.localeCompare(right.category) ||
      left.system_id.localeCompare(right.system_id) ||
      left.task_id.localeCompare(right.task_id),
  )

  const byMode = {}
  for (const failureCase of cases) {
    for (const mode of failureCase.failure_modes) {
      byMode[mode] ||= {
        failure_mode: mode,
        case_count: 0,
        systems: new Set(),
        categories: new Set(),
        challenge_types: new Set(),
      }
      byMode[mode].case_count += 1
      byMode[mode].systems.add(failureCase.system_id)
      byMode[mode].categories.add(failureCase.category)
      byMode[mode].challenge_types.add(failureCase.challenge_type)
    }
  }

  const failureModeSummary = Object.values(byMode)
    .map((entry) => ({
      failure_mode: entry.failure_mode,
      case_count: entry.case_count,
      system_count: entry.systems.size,
      category_count: entry.categories.size,
      challenge_types: [...entry.challenge_types].sort(),
    }))
    .sort((left, right) => right.case_count - left.case_count || left.failure_mode.localeCompare(right.failure_mode))

  const byCategory = Object.fromEntries(
    [...new Set(pilotSuite.items.map((item) => item.category))].map((category) => {
      const categoryCases = cases.filter((failureCase) => failureCase.category === category)
      return [
        category,
        {
          case_count: categoryCases.length,
          systems_with_failures: [...new Set(categoryCases.map((failureCase) => failureCase.system_id))].sort(),
          top_failure_modes: failureModeSummary
            .filter((mode) => categoryCases.some((failureCase) => failureCase.failure_modes.includes(mode.failure_mode)))
            .slice(0, 3)
            .map((mode) => mode.failure_mode),
          representative_cases: categoryCases.slice(0, 2),
        },
      ]
    }),
  )

  return {
    failure_atlas_ready: cases.length > 0 && failureModeSummary.length >= 5,
    benchmark_id: baselineAnalysis.benchmark_id,
    generated_from: {
      pilot_suite: 'generated/pilot-suite.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      model_run_index: 'generated/model-run-index.json',
      scored_reports: reportPaths(modelRunIndex).map((path) => path.replace(`${root}/`, '')),
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      scored_systems: reports.length,
      failure_case_count: cases.length,
      failure_mode_count: failureModeSummary.length,
      category_count: Object.keys(byCategory).length,
      release_gate_status: releaseGate.status,
      completion_claim_allowed: false,
    },
    failure_mode_summary: failureModeSummary,
    by_category: byCategory,
    representative_cases: cases.slice(0, 12),
  }
}

function renderCase(caseEntry) {
  return [
    caseEntry.system_id,
    caseEntry.category,
    caseEntry.challenge_type,
    caseEntry.failure_modes.join('<br>'),
    `answer=${metric(caseEntry.metrics.answer_correct)}; evidence=${metric(caseEntry.metrics.evidence_recall)}; conclusion=${metric(caseEntry.metrics.conclusion_support)}`,
    caseEntry.expected_failure,
  ]
}

function renderMarkdown(atlas) {
  const modeRows = atlas.failure_mode_summary.map((entry) => [
    entry.failure_mode,
    String(entry.case_count),
    String(entry.system_count),
    String(entry.category_count),
    entry.challenge_types.join('<br>'),
  ])
  const categoryRows = Object.entries(atlas.by_category).map(([category, entry]) => [
    category,
    String(entry.case_count),
    entry.systems_with_failures.join('<br>'),
    entry.top_failure_modes.join('<br>'),
  ])
  const caseRows = atlas.representative_cases.map(renderCase)

  return `# Hard Grounded Research Failure Atlas

This generated atlas turns pilot scoring reports into qualitative failure evidence. It is diagnostic only: these cases are machine-seeded and remain blocked from paper claims until human review, scale, and final novelty gates pass.

## Summary

- Failure atlas ready: ${atlas.failure_atlas_ready}
- Scored systems: ${atlas.summary.scored_systems}
- Failure cases: ${atlas.summary.failure_case_count}
- Failure modes: ${atlas.summary.failure_mode_count}
- Categories covered: ${atlas.summary.category_count}
- Release gate status: ${atlas.summary.release_gate_status}
- Completion claim allowed: ${atlas.summary.completion_claim_allowed}

## Failure Modes

${markdownTable(['Failure mode', 'Cases', 'Systems', 'Categories', 'Challenge types'], modeRows)}

## Category Atlas

${markdownTable(['Category', 'Failure cases', 'Systems with failures', 'Top failure modes'], categoryRows)}

## Representative Cases

${markdownTable(['System', 'Category', 'Challenge', 'Failure modes', 'Metrics', 'Designed failure'], caseRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing failure atlas input ${name}: ${path}`)
}

const atlas = buildAtlas({
  pilotSuite: readJson(inputs.pilotSuite),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  modelRunIndex: readJson(inputs.modelRunIndex),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(atlasJsonPath, atlas)
writeText(atlasMarkdownPath, renderMarkdown(atlas))
console.log(`Wrote hard grounded research failure atlas to ${atlasJsonPath}`)
console.log(`Wrote hard grounded research failure atlas report to ${atlasMarkdownPath}`)
