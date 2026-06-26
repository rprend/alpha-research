import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const constructMapJsonPath = join(generatedDir, 'construct-map.json')
const constructMapMarkdownPath = join(experimentDir, 'CONSTRUCT_MAP.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  rubrics: join(experimentDir, 'rubrics.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  scalePlan: join(generatedDir, 'scale-plan.json'),
}

const metricMap = {
  'multi-hop synthesis': ['answer_correct', 'evidence_recall', 'citation_precision'],
  'stale-vs-current document conflicts': ['answer_correct', 'citation_faithfulness', 'conclusion_support'],
  'appended document lifecycle changes': ['answer_correct', 'conclusion_support', 'citation_faithfulness'],
  'table + text reasoning': ['answer_correct', 'evidence_recall', 'conclusion_support'],
  'source authority conflicts': ['answer_correct', 'conclusion_support', 'abstention_quality'],
  'evidence insufficiency / abstention': ['abstention_quality', 'answer_correct', 'citation_faithfulness'],
  'citation supports fact but not conclusion': ['conclusion_support', 'citation_faithfulness', 'citation_precision'],
  'entity disambiguation': ['answer_correct', 'evidence_recall', 'citation_faithfulness'],
  'temporal questions: as of date X': ['answer_correct', 'citation_faithfulness', 'conclusion_support'],
  'cross-document contradiction': ['abstention_quality', 'conclusion_support', 'answer_correct'],
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

function challengeTypes(items) {
  return [...new Set(items.map((item) => item.challenge?.type || item.transform || item.construction).filter(Boolean))].sort()
}

function constructionTypes(items) {
  return [...new Set(items.map((item) => item.construction).filter(Boolean))].sort()
}

function scoringFocus(items) {
  return [...new Set(items.flatMap((item) => item.scoring_focus || []))].sort()
}

function mean(values) {
  const present = values.filter((value) => value !== null && value !== undefined)
  if (!present.length) return null
  return present.reduce((sum, value) => sum + value, 0) / present.length
}

function scoredReportRows(baselineAnalysis) {
  return (baselineAnalysis.generated_from?.scored_runs || [])
    .filter((path) => existsSync(join(root, path)))
    .map((path) => {
      const report = readJson(join(root, path))
      return {
        system_id: report.system_id,
        task_scores: report.task_scores || [],
      }
    })
}

function categoryBaselineRows(scoredReports, category) {
  return scoredReports
    .map((report) => {
      const taskScores = report.task_scores.filter((score) => score.category === category)
      if (!taskScores.length) return null
      return {
        system_id: report.system_id,
        task_count: taskScores.length,
        answer_correct: mean(taskScores.map((score) => score.answer_correct)),
        evidence_recall: mean(taskScores.map((score) => score.evidence_recall)),
        citation_precision: mean(taskScores.map((score) => score.citation_precision)),
        citation_faithfulness: mean(taskScores.map((score) => score.citation_faithfulness)),
        conclusion_support: mean(taskScores.map((score) => score.conclusion_support)),
        abstention_quality: mean(taskScores.map((score) => score.abstention_quality)),
      }
    })
    .filter(Boolean)
}

function minMax(values) {
  const present = values.filter((value) => value !== null && value !== undefined)
  if (!present.length) return null
  return {
    min: Number(Math.min(...present).toFixed(4)),
    max: Number(Math.max(...present).toFixed(4)),
  }
}

function buildMap({ spec, rubrics, coverageMatrix, pilotSuite, baselineAnalysis, noveltyEvidence, reviewProgress, scalePlan }) {
  const scoredReports = scoredReportRows(baselineAnalysis)
  const coverageByCategory = new Map(coverageMatrix.map((entry) => [entry.category, entry]))
  const noveltyByCategory = new Map(noveltyEvidence.category_evidence.map((entry) => [entry.category, entry]))
  const pilotByCategory = new Map()
  for (const item of pilotSuite.items) {
    const current = pilotByCategory.get(item.category) || []
    current.push(item)
    pilotByCategory.set(item.category, current)
  }
  const reviewByCategory = new Map(reviewProgress.pilot_by_category.map((entry) => [entry.category, entry]))
  const expansionReviewByCategory = new Map(reviewProgress.expansion_by_category.map((entry) => [entry.category, entry]))
  const scaleByCategory = new Map(scalePlan.categories.map((entry) => [entry.category, entry]))

  const constructs = spec.categories.map((category) => {
    const rubric = rubrics.category_rubrics[category]
    const coverage = coverageByCategory.get(category)
    const novelty = noveltyByCategory.get(category)
    const items = pilotByCategory.get(category) || []
    const baselines = categoryBaselineRows(scoredReports, category)
    const targetMetrics = metricMap[category] || ['answer_correct', 'evidence_recall', 'citation_faithfulness']

    return {
      category,
      construct_ready: Boolean(rubric) && Boolean(coverage) && items.length > 0 && targetMetrics.length > 0,
      task_goal: rubric?.task_goal || '',
      required_dimensions: rubric?.required_dimensions || [],
      strong_answer: rubric?.strong_answer || '',
      near_miss: rubric?.near_miss || '',
      hard_negative: rubric?.hard_negative || '',
      source_datasets: coverage?.datasets || [],
      seed_tasks: coverage?.tasks || [],
      pilot_items: items.length,
      construction_types: constructionTypes(items),
      challenge_types: challengeTypes(items),
      scoring_focus: scoringFocus(items),
      target_metrics: targetMetrics,
      baseline_metric_ranges: Object.fromEntries(
        targetMetrics.map((metric) => [metric, minMax(baselines.map((row) => row[metric]))]),
      ),
      novelty_risk: novelty?.novelty_risk || 'unknown',
      closest_related_work: novelty?.source_ids || [],
      review_status: {
        pilot_complete_review_rows: reviewByCategory.get(category)?.complete_review_rows || 0,
        pilot_total_review_rows: reviewByCategory.get(category)?.total_review_rows || 0,
        expansion_complete_review_rows: expansionReviewByCategory.get(category)?.complete_review_rows || 0,
        expansion_total_review_rows: expansionReviewByCategory.get(category)?.total_review_rows || 0,
        target_reviewed_items: scaleByCategory.get(category)?.target_reviewed_items || 0,
        current_valid_reviewed_items: scaleByCategory.get(category)?.current_valid_reviewed_items || 0,
        reviewed_gap: scaleByCategory.get(category)?.additional_reviewed_items_needed || 0,
      },
    }
  })

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    construct_map_ready: constructs.every((construct) => construct.construct_ready),
    generated_from: {
      spec: 'benchmark-spec.json',
      rubrics: 'rubrics.json',
      coverage_matrix: 'generated/coverage-matrix.json',
      pilot_suite: 'generated/pilot-suite.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      review_progress: 'generated/review-progress.json',
      scale_plan: 'generated/scale-plan.json',
    },
    summary: {
      category_count: constructs.length,
      ready_constructs: constructs.filter((construct) => construct.construct_ready).length,
      high_novelty_risk_constructs: constructs.filter((construct) => construct.novelty_risk === 'high').length,
      constructs_with_reviewed_gold: constructs.filter((construct) => construct.review_status.current_valid_reviewed_items > 0).length,
      total_pilot_items: constructs.reduce((sum, construct) => sum + construct.pilot_items, 0),
      total_reviewed_gap: constructs.reduce((sum, construct) => sum + construct.review_status.reviewed_gap, 0),
      scored_systems_mapped: scoredReports.length,
    },
    constructs,
  }
}

function renderMarkdown(map) {
  const constructRows = map.constructs.map((construct) => [
    construct.category,
    construct.construct_ready ? 'yes' : 'no',
    construct.novelty_risk,
    construct.source_datasets.join('<br>'),
    construct.required_dimensions.join('<br>'),
    construct.target_metrics.join('<br>'),
    String(construct.pilot_items),
    `${construct.review_status.current_valid_reviewed_items}/${construct.review_status.target_reviewed_items}`,
  ])
  const baselineRows = map.constructs.flatMap((construct) =>
    Object.entries(construct.baseline_metric_ranges).map(([metric, range]) => [
      construct.category,
      metric,
      range ? `${range.min}-${range.max}` : 'n/a',
    ]),
  )
  const challengeRows = map.constructs.map((construct) => [
    construct.category,
    construct.construction_types.join('<br>'),
    construct.challenge_types.join('<br>'),
    construct.scoring_focus.join('<br>'),
    construct.closest_related_work.join('<br>') || 'n/a',
  ])

  return `# Hard Grounded Research Construct Map

This generated map makes the benchmark taxonomy inspectable as a construct-validity artifact. It links each category to rubrics, datasets, pilot examples, challenge payloads, scoring metrics, novelty risk, and review status. It does not claim that any construct has completed gold labels.

## Summary

- Construct map ready: ${map.construct_map_ready}
- Categories: ${map.summary.category_count}
- Ready constructs: ${map.summary.ready_constructs}
- High novelty-risk constructs: ${map.summary.high_novelty_risk_constructs}
- Constructs with reviewed gold: ${map.summary.constructs_with_reviewed_gold}
- Pilot items mapped: ${map.summary.total_pilot_items}
- Reviewed item gap: ${map.summary.total_reviewed_gap}
- Scored systems mapped: ${map.summary.scored_systems_mapped}

## Construct Validity Matrix

${markdownTable(['Category', 'Ready', 'Novelty risk', 'Datasets', 'Rubric dimensions', 'Target metrics', 'Pilot items', 'Reviewed gold'], constructRows)}

## Challenge And Scoring Surface

${markdownTable(['Category', 'Construction types', 'Challenge types', 'Scoring focus', 'Closest related work'], challengeRows)}

## Baseline Metric Ranges By Construct

${markdownTable(['Category', 'Metric', 'Current pilot range across systems'], baselineRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing construct-map input ${name}: ${path}`)
}

const constructMap = buildMap({
  spec: readJson(inputs.spec),
  rubrics: readJson(inputs.rubrics),
  coverageMatrix: readJson(inputs.coverageMatrix),
  pilotSuite: readJson(inputs.pilotSuite),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  reviewProgress: readJson(inputs.reviewProgress),
  scalePlan: readJson(inputs.scalePlan),
})

writeJson(constructMapJsonPath, constructMap)
writeText(constructMapMarkdownPath, renderMarkdown(constructMap))

console.log(`Wrote hard grounded construct map to ${constructMapJsonPath}`)
console.log(`Wrote hard grounded construct report to ${constructMapMarkdownPath}`)
