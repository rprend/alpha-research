import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const runsDir = join(experimentDir, 'runs')
const uncertaintyJsonPath = join(generatedDir, 'baseline-uncertainty.json')
const uncertaintyMarkdownPath = join(experimentDir, 'BASELINE_UNCERTAINTY.md')

const reportPaths = [
  join(runsDir, 'local-rule-agent-v1/report.json'),
  join(runsDir, 'lexical-evidence-baseline-v1/report.json'),
  join(runsDir, 'citation-aware-verifier-v1/report.json'),
]
const metricNames = [
  'answer_correct',
  'evidence_recall',
  'citation_precision',
  'citation_faithfulness',
  'conclusion_support',
  'abstention_quality',
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
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function standardDeviation(values) {
  if (values.length < 2) return 0
  const center = mean(values)
  const variance = values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

function interval(values) {
  const pointEstimate = mean(values)
  const standardError = values.length > 1 ? standardDeviation(values) / Math.sqrt(values.length) : 0
  const margin = 1.96 * standardError
  return {
    n: values.length,
    mean: Number(pointEstimate.toFixed(4)),
    standard_error: Number(standardError.toFixed(4)),
    ci95_low: Number(Math.max(0, pointEstimate - margin).toFixed(4)),
    ci95_high: Number(Math.min(1, pointEstimate + margin).toFixed(4)),
  }
}

function deltaInterval(leftValues, rightValues) {
  const deltas = leftValues.map((value, index) => value - rightValues[index])
  const pointEstimate = mean(deltas)
  const standardError = deltas.length > 1 ? standardDeviation(deltas) / Math.sqrt(deltas.length) : 0
  const margin = 1.96 * standardError
  return {
    n: deltas.length,
    mean_delta: Number(pointEstimate.toFixed(4)),
    standard_error: Number(standardError.toFixed(4)),
    ci95_low: Number((pointEstimate - margin).toFixed(4)),
    ci95_high: Number((pointEstimate + margin).toFixed(4)),
  }
}

function scoresByTask(report) {
  return new Map(report.task_scores.map((score) => [score.task_id, score]))
}

function pairedComparison(leftReport, rightReport) {
  const leftByTask = scoresByTask(leftReport)
  const rightByTask = scoresByTask(rightReport)
  const sharedTaskIds = [...leftByTask.keys()].filter((taskId) => rightByTask.has(taskId)).sort()
  return {
    left_system_id: leftReport.system_id,
    right_system_id: rightReport.system_id,
    shared_task_count: sharedTaskIds.length,
    metrics: Object.fromEntries(
      metricNames.map((metricName) => [
        metricName,
        deltaInterval(
          sharedTaskIds.map((taskId) => leftByTask.get(taskId)[metricName]),
          sharedTaskIds.map((taskId) => rightByTask.get(taskId)[metricName]),
        ),
      ]),
    ),
  }
}

function buildUncertainty(reports) {
  const systems = reports.map((report) => ({
    system_id: report.system_id,
    evaluation_source: report.evaluation_source,
    task_count: report.task_scores.length,
    metrics: Object.fromEntries(
      metricNames.map((metricName) => [
        metricName,
        interval(report.task_scores.map((score) => score[metricName])),
      ]),
    ),
  }))
  const lexical = reports.find((report) => report.system_id === 'lexical-evidence-baseline-v1')
  const verifier = reports.find((report) => report.system_id === 'citation-aware-verifier-v1')
  const oracle = reports.find((report) => report.system_id === 'local-rule-agent-v1')

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    generated_from: {
      scored_reports: reportPaths.map((path) => path.replace(`${root}/`, '')),
    },
    method:
      'Normal-approximation 95% confidence intervals over task-level metric values. Paired deltas use matched task ids. Intervals are descriptive for the 30-item pilot and are not final paper power estimates.',
    metric_names: metricNames,
    system_count: systems.length,
    systems,
    paired_comparisons: [
      lexical && verifier ? pairedComparison(verifier, lexical) : null,
      oracle && lexical ? pairedComparison(oracle, lexical) : null,
    ].filter(Boolean),
    uncertainty_ready: systems.length >= 3 && systems.every((system) => system.task_count > 0),
  }
}

function metric(value) {
  return Number(value).toFixed(4)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function renderMarkdown(uncertainty) {
  const systemRows = uncertainty.systems.flatMap((system) =>
    ['answer_correct', 'citation_faithfulness', 'conclusion_support', 'abstention_quality'].map((metricName) => {
      const metricInterval = system.metrics[metricName]
      return [
        system.system_id,
        metricName,
        String(metricInterval.n),
        metric(metricInterval.mean),
        `[${metric(metricInterval.ci95_low)}, ${metric(metricInterval.ci95_high)}]`,
        metric(metricInterval.standard_error),
      ]
    }),
  )
  const comparisonRows = uncertainty.paired_comparisons.flatMap((comparison) =>
    ['answer_correct', 'citation_faithfulness', 'conclusion_support', 'abstention_quality'].map((metricName) => {
      const metricInterval = comparison.metrics[metricName]
      return [
        `${comparison.left_system_id} - ${comparison.right_system_id}`,
        metricName,
        String(metricInterval.n),
        metric(metricInterval.mean_delta),
        `[${metric(metricInterval.ci95_low)}, ${metric(metricInterval.ci95_high)}]`,
        metric(metricInterval.standard_error),
      ]
    }),
  )

  return `# Hard Grounded Research Baseline Uncertainty

This generated report adds descriptive uncertainty estimates to the current pilot baseline results. It is not a final power analysis; the release gate still requires double-reviewed gold data and real model baselines before submission claims.

## Summary

- Systems: ${uncertainty.system_count}
- Metrics: ${uncertainty.metric_names.join(', ')}
- Method: ${uncertainty.method}
- Uncertainty ready: ${uncertainty.uncertainty_ready}

## System Intervals

${markdownTable(['System', 'Metric', 'n', 'Mean', '95% CI', 'SE'], systemRows)}

## Paired Deltas

${markdownTable(['Comparison', 'Metric', 'n', 'Mean delta', '95% CI', 'SE'], comparisonRows)}
`
}

for (const path of reportPaths) {
  if (!existsSync(path)) throw new Error(`Missing scored baseline report: ${path}`)
}

const uncertainty = buildUncertainty(reportPaths.map(readJson))
writeJson(uncertaintyJsonPath, uncertainty)
writeText(uncertaintyMarkdownPath, renderMarkdown(uncertainty))

console.log(`Wrote hard grounded baseline uncertainty JSON to ${uncertaintyJsonPath}`)
console.log(`Wrote hard grounded baseline uncertainty report to ${uncertaintyMarkdownPath}`)
