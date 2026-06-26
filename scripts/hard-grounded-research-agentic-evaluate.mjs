import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const suitePath = join(generatedDir, 'agentic-research-suite.json')

function argValue(name) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : null
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

function mean(values) {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function buildOracleSubmission(suite) {
  return {
    benchmark_id: suite.benchmark_id,
    suite_id: suite.suite_id,
    system_id: 'agentic-oracle-smoke',
    fixture: true,
    hidden_gold_access: true,
    answers: suite.tasks.map((task) => ({
      task_id: task.task_id,
      answer: task.gold.expected_answers[0] || 'ABSTAIN',
      cited_evidence_ids: task.gold.required_evidence_ids,
      rejected_evidence_ids: task.corpus.documents
        .map((document) => document.document_id)
        .filter((id) => !(task.gold.required_evidence_ids || []).includes(id))
        .slice(0, 25),
      search_trace: [
        {
          action: 'oracle_fixture',
          note: 'This smoke fixture reads gold and is not an eligible agent run.',
        },
      ],
      evidence_assessment: 'Oracle fixture for deterministic scorer validation.',
    })),
  }
}

function scoreTask(task, answer) {
  const expectedAnswers = task.gold.expected_answers.map(normalize)
  const submittedAnswer = normalize(answer?.answer)
  const requiredIds = unique(task.gold.required_evidence_ids || [])
  const submittedIds = unique(answer?.cited_evidence_ids || answer?.citations || [])
  const requiredSet = new Set(requiredIds)
  const submittedSet = new Set(submittedIds)
  const expectedAbstain = expectedAnswers.includes('abstain')
  const expectedConflict = expectedAnswers.includes('conflict')
  const controlledLabels = new Set(['abstain', 'conflict', 'supports', 'refutes', 'not enough info'])
  const answerCorrect = expectedAnswers.some((expected) => {
    if (!expected) return false
    if (controlledLabels.has(expected)) {
      return submittedAnswer === expected || submittedAnswer.startsWith(`${expected} `)
    }
    return submittedAnswer === expected || submittedAnswer.includes(expected)
  })
  const abstentionOrConflictCorrect =
    expectedAbstain || expectedConflict ? answerCorrect : submittedAnswer !== 'abstain' && submittedAnswer !== 'conflict'
  const requiredEvidenceRecall =
    requiredIds.length === 0 ? 1 : requiredIds.filter((id) => submittedSet.has(id)).length / requiredIds.length
  const citationPrecision =
    submittedIds.length === 0
      ? requiredIds.length === 0
        ? 1
        : 0
      : submittedIds.filter((id) => requiredSet.has(id)).length / submittedIds.length
  const searchTraceCompleteness = Array.isArray(answer?.search_trace) && answer.search_trace.length > 0 ? 1 : 0
  const rejectedIds = unique(answer?.rejected_evidence_ids || [])
  const corpusIds = new Set(task.corpus.documents.map((document) => document.document_id))
  const requiredOrSubmitted = new Set([...requiredIds, ...submittedIds])
  const validRejected = rejectedIds.filter((id) => corpusIds.has(id) && !requiredOrSubmitted.has(id)).length
  const rejectedDistractorPrecision = rejectedIds.length === 0 ? 0 : validRejected / rejectedIds.length

  return {
    task_id: task.task_id,
    category: task.category,
    expected_answers: task.gold.expected_answers,
    submitted_answer: answer?.answer ?? '',
    answer_membership: answerCorrect ? 1 : 0,
    required_evidence_recall: Number(requiredEvidenceRecall.toFixed(4)),
    citation_precision: Number(citationPrecision.toFixed(4)),
    rejected_distractor_precision: Number(rejectedDistractorPrecision.toFixed(4)),
    abstention_or_conflict_correctness: abstentionOrConflictCorrect ? 1 : 0,
    search_trace_completeness: searchTraceCompleteness,
    required_evidence_ids: requiredIds,
    submitted_evidence_ids: submittedIds,
    rejected_evidence_ids: rejectedIds,
  }
}

function summarize(scores) {
  const metrics = [
    'answer_membership',
    'required_evidence_recall',
    'citation_precision',
    'rejected_distractor_precision',
    'abstention_or_conflict_correctness',
    'search_trace_completeness',
  ]
  return {
    task_count: scores.length,
    macro: Object.fromEntries(metrics.map((metric) => [metric, mean(scores.map((score) => score[metric]))])),
    by_category: Object.fromEntries(
      unique(scores.map((score) => score.category)).map((category) => {
        const categoryScores = scores.filter((score) => score.category === category)
        return [category, Object.fromEntries(metrics.map((metric) => [metric, mean(categoryScores.map((score) => score[metric]))]))]
      }),
    ),
  }
}

const suite = readJson(suitePath)
const writeOracle = process.argv.includes('--write-oracle')
const submissionPath = argValue('submission')
const reportPath = argValue('report') || join(generatedDir, 'agentic-evaluation-report.json')

if (writeOracle) {
  const oraclePath = join(generatedDir, 'agentic-oracle-submission.json')
  writeJson(oraclePath, buildOracleSubmission(suite))
  console.log(`Wrote ${relative(root, oraclePath)}`)
}

const submission = submissionPath ? readJson(join(root, submissionPath)) : buildOracleSubmission(suite)
const submittedByTask = new Map((submission.answers || []).map((answer) => [answer.task_id, answer]))
const scores = suite.tasks.map((task) => scoreTask(task, submittedByTask.get(task.task_id)))
const report = {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  system_id: submission.system_id || 'unknown-agentic-system',
  fixture: Boolean(submission.fixture),
  hidden_gold_access: Boolean(submission.hidden_gold_access),
  llm_judge_used: false,
  constant_time_scoring: true,
  eligible_agent_run: false,
  eligibility_note:
    'This evaluator scores submissions deterministically. Eligibility is decided by agentic-readiness run manifests, not by this report alone.',
  summary: summarize(scores),
  task_scores: scores,
}

writeJson(join(root, reportPath), report)
console.log(`Wrote ${reportPath}`)
