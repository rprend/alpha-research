import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v10-candidate')
const suitePath = join(candidateDir, 'suite.json')
const readinessPath = join(candidateDir, 'agentic-v10-readiness.json')
const outputPath = join(candidateDir, 'agentic-v10-failure-analysis.json')
const markdownPath = join(experimentDir, 'AGENTIC_V10_FAILURE_ANALYSIS.md')
const runsDir = join(experimentDir, 'agentic-v10-runs')

const metrics = [
  'answer_membership',
  'required_evidence_recall',
  'citation_precision',
  'rejected_distractor_precision',
  'rejected_target_recall',
  'abstention_or_conflict_correctness',
  'search_trace_completeness',
]

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

function mean(values) {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function pct(value) {
  return `${Math.round((value || 0) * 1000) / 10}%`
}

function listRunDirs() {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .map((name) => join(runsDir, name))
    .filter((path) => statSync(path).isDirectory())
}

function loadRuns(suiteId) {
  return listRunDirs()
    .map((runDir) => {
      const manifestPath = join(runDir, 'run-manifest.json')
      const reportPath = join(runDir, 'report.json')
      if (!existsSync(manifestPath) || !existsSync(reportPath)) return null
      const manifest = readJson(manifestPath)
      const report = readJson(reportPath)
      if (manifest.evaluation_source !== suiteId || report.suite_id !== suiteId) return null
      return { manifest, report }
    })
    .filter(Boolean)
}

function aggregateRuns(runs) {
  const allScores = runs.flatMap((run) => run.report.task_scores || [])
  const categories = [...new Set(allScores.map((score) => score.category))]
  return {
    run_count: runs.length,
    task_score_count: allScores.length,
    macro: Object.fromEntries(metrics.map((metric) => [metric, mean(allScores.map((score) => score[metric]))])),
    by_category: Object.fromEntries(
      categories.map((category) => {
        const scores = allScores.filter((score) => score.category === category)
        const row = Object.fromEntries(metrics.map((metric) => [metric, mean(scores.map((score) => score[metric]))]))
        row.evidence_answer_gap = Number((row.required_evidence_recall - row.answer_membership).toFixed(4))
        return [category, row]
      }),
    ),
  }
}

function failedExamples(run) {
  return (run.report.task_scores || [])
    .filter((score) => score.answer_membership < 1 || score.required_evidence_recall < 1)
    .sort((a, b) => {
      const gapA = a.required_evidence_recall - a.answer_membership
      const gapB = b.required_evidence_recall - b.answer_membership
      return gapB - gapA || a.category.localeCompare(b.category) || a.task_id.localeCompare(b.task_id)
    })
    .slice(0, 12)
    .map((score) => ({
      task_id: score.task_id,
      category: score.category,
      expected_answers: score.expected_answers,
      submitted_answer: score.submitted_answer,
      required_evidence_recall: score.required_evidence_recall,
      citation_precision: score.citation_precision,
      cited_evidence_ids: score.submitted_evidence_ids,
      required_evidence_ids: score.required_evidence_ids,
    }))
}

const suite = readJson(suitePath)
const readiness = existsSync(readinessPath) ? readJson(readinessPath) : null
const runs = loadRuns(suite.suite_id)
const aggregate = aggregateRuns(runs)

const analysis = {
  analysis_id: 'agentic-v10-failure-analysis',
  checked_date: '2026-06-26',
  suite_id: suite.suite_id,
  task_count: suite.task_count,
  eligible_frontier_agent_runs: readiness?.eligible_frontier_agent_runs ?? 0,
  buyer_grade_status: readiness?.ready ? 'frontier_runs_present' : 'missing_frontier_runs',
  aggregate,
  runs: runs.map((run) => ({
    run_id: run.manifest.run_id,
    agent_surface: run.manifest.agent_surface,
    model: run.manifest.model,
    model_version: run.manifest.model_version,
    inference_date: run.manifest.inference_date,
    summary: run.report.summary,
    high_evidence_wrong_answer_examples: failedExamples(run),
  })),
}

writeJson(outputPath, analysis)

const runRows =
  analysis.runs.length === 0
    ? '| none | none | none | none | 0% | 0% |'
    : analysis.runs
        .map(
          (run) =>
            `| ${run.run_id} | ${run.agent_surface} | ${run.model} | ${run.model_version} | ${pct(
              run.summary.macro.answer_membership,
            )} | ${pct(run.summary.macro.required_evidence_recall)} |`,
        )
        .join('\n')

const categoryRows = Object.entries(aggregate.by_category)
  .sort(([, a], [, b]) => a.answer_membership - b.answer_membership || b.evidence_answer_gap - a.evidence_answer_gap)
  .map(
    ([category, scores]) =>
      `| ${category} | ${pct(scores.answer_membership)} | ${pct(scores.required_evidence_recall)} | ${pct(
        scores.citation_precision,
      )} | ${pct(scores.evidence_answer_gap)} |`,
  )
  .join('\n')

const exampleBlocks = analysis.runs
  .map((run) => {
    const examples = run.high_evidence_wrong_answer_examples
      .slice(0, 5)
      .map(
        (example) =>
          `- ${example.task_id} (${example.category}): expected ${JSON.stringify(
            example.expected_answers,
          )}; submitted "${example.submitted_answer}"; evidence recall ${pct(example.required_evidence_recall)}.`,
      )
      .join('\n')
    return `### ${run.run_id}\n\n${examples || '- No failed examples recorded.'}`
  })
  .join('\n\n')

writeText(
  markdownPath,
  `# Agentic V10 Failure Analysis

This report summarizes frontier tool-using agent runs over \`${suite.suite_id}\`.

## Status

- Buyer-grade status: ${analysis.buyer_grade_status}
- Eligible frontier-agent runs: ${analysis.eligible_frontier_agent_runs}
- Runs analyzed: ${analysis.runs.length}
- Task scores analyzed: ${analysis.aggregate.task_score_count}

## Run Summary

| Run | Surface | Model | Version | Answer membership | Evidence recall |
| --- | --- | --- | --- | ---: | ---: |
${runRows}

## Aggregate Category Failures

| Category | Answer membership | Evidence recall | Citation precision | Evidence-answer gap |
| --- | ---: | ---: | ---: | ---: |
${categoryRows || '| none | 0% | 0% | 0% | 0% |'}

## Examples

${exampleBlocks || 'No runs with scored failures are available yet.'}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${markdownPath}`)
