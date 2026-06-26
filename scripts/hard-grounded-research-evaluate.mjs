import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const materializedPath = join(generatedDir, 'materialized-examples.json')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const rubricsPath = join(experimentDir, 'rubrics.json')
const baselineSubmissionPath = join(generatedDir, 'baseline-submission.json')
const baselineReportPath = join(generatedDir, 'baseline-report.json')
const baselineComparisonsPath = join(generatedDir, 'baseline-comparisons.json')

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

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function flattenRequiredEvidence(taskExample) {
  return taskExample.source_examples.flatMap((source) => source.evidence_units || [])
}

function expectedAnswer(taskExample) {
  const answers = taskExample.source_examples.map((source) => source.native_answer).filter(Boolean)
  if (answers.some((answer) => normalize(answer) === 'abstain')) return 'ABSTAIN'
  return answers[0] || ''
}

function buildBaselineSubmission(materialized) {
  const tasks = materialized.task_examples || materialized.items
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'native-label-plus-all-evidence-baseline',
    description: 'Upper-bound sanity baseline that answers with the first native label and cites all materialized required evidence.',
    answers: tasks.map((task) => ({
      task_id: task.task_id || task.id,
      answer: expectedAnswer(task),
      citations: unique(flattenRequiredEvidence(task).map((evidence) => evidence.id)),
      abstained: normalize(expectedAnswer(task)) === 'abstain',
    })),
  }
}

function buildNoCitationBaseline(materialized) {
  const tasks = materialized.task_examples || materialized.items
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'answer-only-no-citation-baseline',
    description: 'Diagnostic weak baseline that predicts the native answer but provides no citations.',
    answers: tasks.map((task) => ({
      task_id: task.task_id || task.id,
      answer: expectedAnswer(task),
      citations: [],
      abstained: normalize(expectedAnswer(task)) === 'abstain',
    })),
  }
}

function buildFirstCitationBaseline(materialized) {
  const tasks = materialized.task_examples || materialized.items
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'first-evidence-only-baseline',
    description: 'Diagnostic weak baseline that predicts the native answer and cites only the first available evidence unit.',
    answers: tasks.map((task) => ({
      task_id: task.task_id || task.id,
      answer: expectedAnswer(task),
      citations: unique(flattenRequiredEvidence(task).slice(0, 1).map((evidence) => evidence.id)),
      abstained: normalize(expectedAnswer(task)) === 'abstain',
    })),
  }
}

function scoreAnswer(taskExample, submitted, rubric) {
  const expected = expectedAnswer(taskExample)
  const expectedNorm = normalize(expected)
  const submittedNorm = normalize(submitted?.answer)
  const requiredEvidence = flattenRequiredEvidence(taskExample)
  const requiredCitationIds = unique(requiredEvidence.map((evidence) => evidence.id))
  const submittedCitationIds = unique(submitted?.citations || [])
  const requiredCitationSet = new Set(requiredCitationIds)
  const submittedCitationSet = new Set(submittedCitationIds)
  const abstainExpected = expectedNorm === 'abstain'
  const abstained = Boolean(submitted?.abstained) || submittedNorm === 'abstain'

  const answerCorrect = abstainExpected
    ? abstained
    : submittedNorm === expectedNorm || (expectedNorm.length > 0 && submittedNorm.includes(expectedNorm))
  const evidenceRecall =
    requiredCitationIds.length === 0
      ? 1
      : requiredCitationIds.filter((id) => submittedCitationSet.has(id)).length / requiredCitationIds.length
  const citationPrecision =
    submittedCitationIds.length === 0
      ? requiredCitationIds.length === 0
        ? 1
        : 0
      : submittedCitationIds.filter((id) => requiredCitationSet.has(id)).length / submittedCitationIds.length
  const abstentionQuality = abstainExpected ? (abstained ? 1 : 0) : abstained ? 0 : 1
  const citationFaithfulness = answerCorrect ? citationPrecision : Math.min(citationPrecision, 0.5)

  return {
    task_id: taskExample.task_id,
    category: taskExample.category,
    rubric_dimensions: rubric?.required_dimensions || [],
    expected_answer: expected,
    submitted_answer: submitted?.answer ?? '',
    answer_correct: answerCorrect ? 1 : 0,
    evidence_recall: Number(evidenceRecall.toFixed(4)),
    citation_precision: Number(citationPrecision.toFixed(4)),
    citation_faithfulness: Number(citationFaithfulness.toFixed(4)),
    abstention_quality: abstentionQuality,
    required_citations: requiredCitationIds,
    submitted_citations: submittedCitationIds,
  }
}

function summarize(scores) {
  const metricNames = [
    'answer_correct',
    'evidence_recall',
    'citation_precision',
    'citation_faithfulness',
    'abstention_quality',
  ]
  const macro = Object.fromEntries(
    metricNames.map((metric) => [
      metric,
      Number((scores.reduce((sum, score) => sum + score[metric], 0) / scores.length).toFixed(4)),
    ]),
  )
  const byCategory = Object.fromEntries(
    unique(scores.map((score) => score.category)).map((category) => {
      const categoryScores = scores.filter((score) => score.category === category)
      return [
        category,
        Object.fromEntries(
          metricNames.map((metric) => [
            metric,
            Number((categoryScores.reduce((sum, score) => sum + score[metric], 0) / categoryScores.length).toFixed(4)),
          ]),
        ),
      ]
    }),
  )
  return {
    task_count: scores.length,
    rubric_dimension_count: unique(scores.flatMap((score) => score.rubric_dimensions)).length,
    macro,
    by_category: byCategory,
  }
}

function scoreSubmission(materialized, rubrics, submission) {
  const categoryRubrics = rubrics.category_rubrics || {}
  const submittedByTask = new Map((submission.answers || []).map((answer) => [answer.task_id, answer]))
  const tasks = materialized.task_examples || materialized.items
  const scores = tasks.map((task) => {
    const taskId = task.task_id || task.id
    assert(submittedByTask.has(taskId), `Submission missing task: ${taskId}`)
    assert(categoryRubrics[task.category], `Missing rubric for category: ${task.category}`)
    return scoreAnswer({ ...task, task_id: taskId }, submittedByTask.get(taskId), categoryRubrics[task.category])
  })
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: submission.system_id || 'unknown-system',
    rubric_version: rubrics.version,
    global_answer_contract: rubrics.global_answer_contract,
    summary: summarize(scores),
    task_scores: scores,
  }
}

assert(existsSync(materializedPath), `Missing materialized examples: ${materializedPath}`)
assert(existsSync(pilotSuitePath), `Missing pilot suite: ${pilotSuitePath}`)
assert(existsSync(rubricsPath), `Missing rubrics: ${rubricsPath}`)
const materialized = readJson(pilotSuitePath)
const rubrics = readJson(rubricsPath)
const submissionArg = process.argv.find((arg) => arg.startsWith('--submission='))
const submissionPath = submissionArg?.split('=')[1]
const submission = submissionPath ? readJson(join(root, submissionPath)) : buildBaselineSubmission(materialized)
const report = scoreSubmission(materialized, rubrics, submission)

if (!submissionPath) {
  const baselineSubmissions = [
    submission,
    buildNoCitationBaseline(materialized),
    buildFirstCitationBaseline(materialized),
  ]
  const comparisonReports = baselineSubmissions.map((baseline) => scoreSubmission(materialized, rubrics, baseline))
  writeJson(baselineSubmissionPath, submission)
  writeJson(baselineReportPath, report)
  writeJson(baselineComparisonsPath, {
    benchmark_id: 'hard-grounded-research-benchmark',
    reports: comparisonReports.map((comparisonReport) => ({
      system_id: comparisonReport.system_id,
      summary: comparisonReport.summary,
    })),
  })
  console.log(`Wrote baseline submission to ${baselineSubmissionPath}`)
  console.log(`Wrote baseline report to ${baselineReportPath}`)
  console.log(`Wrote baseline comparisons to ${baselineComparisonsPath}`)
}

console.log(`Scored ${report.summary.task_count} tasks for ${report.system_id}.`)
console.log(`Macro answer_correct=${report.summary.macro.answer_correct}, citation_faithfulness=${report.summary.macro.citation_faithfulness}`)
