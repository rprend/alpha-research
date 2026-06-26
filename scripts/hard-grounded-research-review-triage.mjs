import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const modelRunIndexPath = join(generatedDir, 'model-run-index.json')
const triageJsonPath = join(generatedDir, 'review-triage.json')
const triageMarkdownPath = join(experimentDir, 'REVIEW_TRIAGE.md')

const metrics = [
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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function loadEligibleReports(modelRunIndex) {
  return modelRunIndex.runs
    .filter((run) => run.eligible_model_baseline && run.report_path)
    .map((run) => ({
      run_id: run.run_id,
      system_id: run.system_id,
      report: readJson(join(root, run.report_path)),
    }))
}

function scoreByTask(report) {
  return new Map(report.task_scores.map((score) => [score.task_id, score]))
}

function failureSignals(scores) {
  const signals = []
  const failedAnswers = scores.filter((score) => score.answer_correct < 1).length
  const lowFaithfulness = scores.filter((score) => score.citation_faithfulness < 1).length
  const lowSupport = scores.filter((score) => score.conclusion_support < 1).length
  const lowAbstention = scores.filter((score) => score.abstention_quality < 1).length
  const modelDisagreement = new Set(scores.map((score) => score.answer_correct)).size > 1

  if (failedAnswers === scores.length) signals.push('all_models_answer_incorrect')
  else if (failedAnswers > 0) signals.push('some_models_answer_incorrect')
  if (lowFaithfulness === scores.length) signals.push('all_models_low_citation_faithfulness')
  else if (lowFaithfulness > 0) signals.push('some_models_low_citation_faithfulness')
  if (lowSupport === scores.length) signals.push('all_models_low_conclusion_support')
  else if (lowSupport > 0) signals.push('some_models_low_conclusion_support')
  if (lowAbstention > 0) signals.push('abstention_or_conflict_handling_failure')
  if (modelDisagreement) signals.push('cross_model_answer_disagreement')
  return signals
}

function priorityScore(scores, item) {
  const means = Object.fromEntries(
    metrics.map((metric) => [
      metric,
      scores.reduce((sum, score) => sum + score[metric], 0) / scores.length,
    ]),
  )
  const failedAnswers = scores.filter((score) => score.answer_correct < 1).length
  const lowFaithfulness = scores.filter((score) => score.citation_faithfulness < 1).length
  const lowSupport = scores.filter((score) => score.conclusion_support < 1).length
  const lowAbstention = scores.filter((score) => score.abstention_quality < 1).length
  const challengeBonus =
    item.category === 'citation supports fact but not conclusion' ||
    item.category === 'evidence insufficiency / abstention' ||
    item.category === 'cross-document contradiction'
      ? 2
      : 0

  return Number(
    (
      failedAnswers * 4 +
      lowFaithfulness * 3 +
      lowSupport * 3 +
      lowAbstention * 2 +
      (1 - means.evidence_recall) * 2 +
      challengeBonus
    ).toFixed(4),
  )
}

function buildTriage({ pilotSuite, modelRunIndex }) {
  const reports = loadEligibleReports(modelRunIndex)
  const scoreMaps = reports.map((entry) => ({ ...entry, byTask: scoreByTask(entry.report) }))
  const items = pilotSuite.task_examples || pilotSuite.items
  const triageItems = items.map((item) => {
    const taskId = item.task_id || item.id
    const scores = scoreMaps.map((entry) => {
      const score = entry.byTask.get(taskId)
      if (!score) throw new Error(`Missing score for ${taskId} in ${entry.run_id}`)
      return {
        run_id: entry.run_id,
        system_id: entry.system_id,
        answer_correct: score.answer_correct,
        evidence_recall: score.evidence_recall,
        citation_precision: score.citation_precision,
        citation_faithfulness: score.citation_faithfulness,
        conclusion_support: score.conclusion_support,
        abstention_quality: score.abstention_quality,
      }
    })
    const signals = failureSignals(scores)
    const score = priorityScore(scores, item)
    return {
      item_id: taskId,
      category: item.category,
      review_priority: score >= 12 ? 'urgent' : score >= 8 ? 'high' : score >= 4 ? 'medium' : 'standard',
      priority_score: score,
      signals,
      question: item.question,
      model_scores: scores,
      expected_failure: item.expected_failure || null,
      scoring_focus: item.scoring_focus || [],
    }
  })

  triageItems.sort((left, right) => right.priority_score - left.priority_score || left.item_id.localeCompare(right.item_id))
  const byCategory = Object.fromEntries(
    [...new Set(triageItems.map((item) => item.category))].map((category) => {
      const rows = triageItems.filter((item) => item.category === category)
      return [
        category,
        {
          item_count: rows.length,
          urgent_or_high_items: rows.filter((item) => item.review_priority === 'urgent' || item.review_priority === 'high').length,
          max_priority_score: Math.max(...rows.map((item) => item.priority_score)),
          top_item_ids: rows.slice(0, 3).map((item) => item.item_id),
        },
      ]
    }),
  )

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_pilot_suite: 'generated/pilot-suite.json',
    source_model_run_index: 'generated/model-run-index.json',
    eligible_model_baselines: reports.map((entry) => entry.run_id),
    model_baseline_count: reports.length,
    review_triage_ready: reports.length >= 2 && triageItems.length > 0,
    item_count: triageItems.length,
    urgent_or_high_items: triageItems.filter((item) => item.review_priority === 'urgent' || item.review_priority === 'high').length,
    by_category: byCategory,
    triage_items: triageItems,
  }
}

function renderMarkdown(triage) {
  const categoryRows = Object.entries(triage.by_category).map(([category, summary]) => [
    category,
    String(summary.item_count),
    String(summary.urgent_or_high_items),
    String(summary.max_priority_score),
    summary.top_item_ids.join('<br>'),
  ])
  const itemRows = triage.triage_items.slice(0, 30).map((item) => [
    item.item_id,
    item.category,
    item.review_priority,
    String(item.priority_score),
    item.signals.join('<br>') || 'none',
  ])

  return `# Hard Grounded Research Review Triage

This generated packet ranks pilot review rows using observed failures from eligible external model baselines. It does not complete reviewer fields or promote gold; it tells reviewers which rows deserve first attention because real models already failed there.

## Summary

- Eligible model baselines: ${triage.eligible_model_baselines.join(', ')}
- Model baseline count: ${triage.model_baseline_count}
- Pilot items ranked: ${triage.item_count}
- Urgent or high-priority items: ${triage.urgent_or_high_items}
- Review triage ready: ${triage.review_triage_ready}

## Category Triage

${markdownTable(['Category', 'Items', 'Urgent/high', 'Max score', 'Top items'], categoryRows)}

## Top Review Items

${markdownTable(['Item', 'Category', 'Priority', 'Score', 'Signals'], itemRows)}
`
}

for (const path of [pilotSuitePath, modelRunIndexPath]) {
  if (!existsSync(path)) throw new Error(`Missing review triage input: ${path}`)
}

const triage = buildTriage({
  pilotSuite: readJson(pilotSuitePath),
  modelRunIndex: readJson(modelRunIndexPath),
})
writeJson(triageJsonPath, triage)
writeText(triageMarkdownPath, renderMarkdown(triage))

console.log(`Wrote hard grounded review triage JSON to ${triageJsonPath}`)
console.log(`Wrote hard grounded review triage report to ${triageMarkdownPath}`)
