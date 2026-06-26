import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const runsDir = join(experimentDir, 'runs')
const reportJsonPath = join(generatedDir, 'baseline-analysis.json')
const reportMarkdownPath = join(experimentDir, 'BASELINE_ANALYSIS.md')

const scoredRunPaths = [
  join(runsDir, 'local-rule-agent-v1/report.json'),
  join(runsDir, 'lexical-evidence-baseline-v1/report.json'),
]
const openAiManifestPath = join(runsDir, 'openai-grounded-baseline-v1/run-manifest.json')
const goldSummaryPath = join(generatedDir, 'gold-suite-summary.json')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')

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
  return Number(value).toFixed(4)
}

function metricDelta(a, b) {
  return Number((a - b).toFixed(4))
}

function sortedWeakestCategories(report) {
  return Object.entries(report.summary.by_category)
    .map(([category, metrics]) => ({
      category,
      answer_correct: metrics.answer_correct,
      citation_faithfulness: metrics.citation_faithfulness,
      evidence_recall: metrics.evidence_recall,
      abstention_quality: metrics.abstention_quality,
    }))
    .sort(
      (a, b) =>
        a.answer_correct - b.answer_correct ||
        a.citation_faithfulness - b.citation_faithfulness ||
        a.evidence_recall - b.evidence_recall ||
        a.category.localeCompare(b.category),
    )
}

function citationGap(score) {
  const submitted = new Set(score.submitted_citations || [])
  return (score.required_citations || []).filter((id) => !submitted.has(id))
}

function failureReasons(score) {
  const reasons = []
  if (score.answer_correct < 1) reasons.push('wrong_answer')
  if (score.evidence_recall < 1) reasons.push('missing_required_evidence')
  if (score.citation_faithfulness < 1) reasons.push('unfaithful_or_overbroad_citation')
  if (score.abstention_quality < 1) reasons.push('bad_abstention_behavior')
  return reasons
}

function buildFailureAnalysis(report, pilotSuite) {
  const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
  const failures = report.task_scores
    .map((score) => {
      const item = pilotById.get(score.task_id)
      return {
        task_id: score.task_id,
        category: score.category,
        challenge_type: item?.challenge?.type || 'native_row',
        question: item?.question || '',
        expected_answer: score.expected_answer,
        submitted_answer: score.submitted_answer,
        reasons: failureReasons(score),
        missing_required_citations: citationGap(score),
        submitted_citations: score.submitted_citations || [],
        metrics: {
          answer_correct: score.answer_correct,
          evidence_recall: score.evidence_recall,
          citation_faithfulness: score.citation_faithfulness,
          abstention_quality: score.abstention_quality,
        },
      }
    })
    .filter((failure) => failure.reasons.length > 0)

  const byCategory = Object.fromEntries(
    [...new Set(report.task_scores.map((score) => score.category))].map((category) => {
      const categoryScores = report.task_scores.filter((score) => score.category === category)
      const categoryFailures = failures.filter((failure) => failure.category === category)
      return [
        category,
        {
          task_count: categoryScores.length,
          failure_count: categoryFailures.length,
          failure_rate: Number((categoryFailures.length / categoryScores.length).toFixed(4)),
          reason_counts: categoryFailures.reduce((counts, failure) => {
            for (const reason of failure.reasons) counts[reason] = (counts[reason] || 0) + 1
            return counts
          }, {}),
          representative_failures: categoryFailures.slice(0, 2),
        },
      ]
    }),
  )

  return {
    system_id: report.system_id,
    failure_count: failures.length,
    by_category: byCategory,
  }
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function buildReport(scoredReports, goldSummary, openAiManifest, pilotSuite) {
  const oracle = scoredReports.find((report) => report.system_id === 'local-rule-agent-v1')
  const lexical = scoredReports.find((report) => report.system_id === 'lexical-evidence-baseline-v1')
  const systems = scoredReports.map((report) => ({
    system_id: report.system_id,
    task_count: report.summary.task_count,
    macro: report.summary.macro,
    weakest_categories: sortedWeakestCategories(report).slice(0, 5),
  }))

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    generated_from: {
      scored_runs: scoredRunPaths.map((path) => path.replace(`${root}/`, '')),
      gold_summary: goldSummaryPath.replace(`${root}/`, ''),
      openai_manifest: openAiManifestPath.replace(`${root}/`, ''),
    },
    gold_readiness: {
      gold_ready: goldSummary.gold_ready,
      total_items: goldSummary.total_items,
      valid_reviewed_items: goldSummary.valid_reviewed_items,
      unreviewed_items: goldSummary.unreviewed_items,
    },
    model_readiness: {
      openai_prompt_count: openAiManifest.prompt_count,
      openai_default_mode: openAiManifest.default_mode,
      openai_run_requested: openAiManifest.run_requested,
      openai_scored_report_present: existsSync(join(runsDir, 'openai-grounded-baseline-v1/report.json')),
    },
    failure_analysis: lexical ? buildFailureAnalysis(lexical, pilotSuite) : null,
    systems,
    headline_contrasts:
      oracle && lexical
        ? {
            lexical_answer_correct_gap_vs_oracle: metricDelta(
              oracle.summary.macro.answer_correct,
              lexical.summary.macro.answer_correct,
            ),
            lexical_citation_faithfulness_gap_vs_oracle: metricDelta(
              oracle.summary.macro.citation_faithfulness,
              lexical.summary.macro.citation_faithfulness,
            ),
            lexical_evidence_recall_gap_vs_oracle: metricDelta(
              oracle.summary.macro.evidence_recall,
              lexical.summary.macro.evidence_recall,
            ),
          }
        : {},
  }
}

function renderMarkdown(report) {
  const summaryRows = report.systems.map((system) => [
    system.system_id,
    String(system.task_count),
    metric(system.macro.answer_correct),
    metric(system.macro.evidence_recall),
    metric(system.macro.citation_faithfulness),
    metric(system.macro.abstention_quality),
  ])
  const lexical = report.systems.find((system) => system.system_id === 'lexical-evidence-baseline-v1')
  const weakestRows = (lexical?.weakest_categories || []).map((category) => [
    category.category,
    metric(category.answer_correct),
    metric(category.evidence_recall),
    metric(category.citation_faithfulness),
    metric(category.abstention_quality),
  ])
  const failureRows = Object.entries(report.failure_analysis?.by_category || {})
    .sort(([, a], [, b]) => b.failure_rate - a.failure_rate)
    .map(([category, analysis]) => [
      category,
      `${analysis.failure_count}/${analysis.task_count}`,
      metric(analysis.failure_rate),
      Object.entries(analysis.reason_counts)
        .map(([reason, count]) => `${reason}:${count}`)
        .join('<br>'),
    ])
  const representativeFailures = Object.entries(report.failure_analysis?.by_category || {})
    .flatMap(([category, analysis]) =>
      analysis.representative_failures.slice(0, 1).map((failure) => ({ ...failure, category })),
    )
    .slice(0, 5)
    .map(
      (failure) =>
        `### ${failure.task_id}

- Category: ${failure.category}
- Challenge: ${failure.challenge_type}
- Reasons: ${failure.reasons.join(', ')}
- Expected: ${failure.expected_answer}
- Submitted: ${failure.submitted_answer}
- Missing required citations: ${failure.missing_required_citations.length ? failure.missing_required_citations.join(', ') : 'none'}
`,
    )
    .join('\n')

  return `# Hard Grounded Research Baseline Analysis

This report is generated from checked-in run artifacts. It is a pilot result summary, not a paper claim over gold data.

## Readiness

- Gold ready: ${report.gold_readiness.gold_ready}
- Valid reviewed items: ${report.gold_readiness.valid_reviewed_items}/${report.gold_readiness.total_items}
- Unreviewed items: ${report.gold_readiness.unreviewed_items}
- OpenAI prompt packet rows: ${report.model_readiness.openai_prompt_count}
- OpenAI scored report present: ${report.model_readiness.openai_scored_report_present}

## Macro Results

${markdownTable(
  ['System', 'Tasks', 'Answer correct', 'Evidence recall', 'Citation faithfulness', 'Abstention quality'],
  summaryRows,
)}

## Lexical Baseline Weakest Categories

${markdownTable(
  ['Category', 'Answer correct', 'Evidence recall', 'Citation faithfulness', 'Abstention quality'],
  weakestRows,
)}

## Lexical Failure Taxonomy

${markdownTable(['Category', 'Failures', 'Failure rate', 'Reason counts'], failureRows)}

## Representative Lexical Failures

${representativeFailures}

## Headline Contrast

- Lexical answer-correct gap vs oracle sanity runner: ${metric(report.headline_contrasts.lexical_answer_correct_gap_vs_oracle ?? 0)}
- Lexical citation-faithfulness gap vs oracle sanity runner: ${metric(report.headline_contrasts.lexical_citation_faithfulness_gap_vs_oracle ?? 0)}
- Lexical evidence-recall gap vs oracle sanity runner: ${metric(report.headline_contrasts.lexical_evidence_recall_gap_vs_oracle ?? 0)}

## Interpretation

The lexical baseline is intentionally non-oracle: it does not read native answers or gold citation ids. Its weakest categories are a first operational signal for the paper question: hard grounded research failures are not just lookup misses; they include answer selection under insufficiency, table/text interpretation, contradiction handling, and citation support for conclusions.

This report remains preliminary until the adjudication queue is reviewed and at least one API or open-model baseline has a scored report.
`
}

for (const path of [...scoredRunPaths, goldSummaryPath, openAiManifestPath, pilotSuitePath]) {
  if (!existsSync(path)) throw new Error(`Missing report input: ${path}`)
}

const scoredReports = scoredRunPaths.map(readJson)
const goldSummary = readJson(goldSummaryPath)
const openAiManifest = readJson(openAiManifestPath)
const pilotSuite = readJson(pilotSuitePath)
const report = buildReport(scoredReports, goldSummary, openAiManifest, pilotSuite)
writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote baseline analysis JSON to ${reportJsonPath}`)
console.log(`Wrote baseline analysis report to ${reportMarkdownPath}`)
