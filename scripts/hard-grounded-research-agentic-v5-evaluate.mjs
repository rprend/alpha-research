import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v5-candidate')
const suitePath = join(candidateDir, 'suite.json')
const hiddenGoldPath = join(candidateDir, 'hidden-gold.json')
const workspaceRoot = join(candidateDir, 'workspaces')

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
  return [...new Set((values || []).filter(Boolean))]
}

function mean(values) {
  if (values.length === 0) return 0
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(4))
}

function loadCorpusIds(taskId) {
  const corpus = readJson(join(workspaceRoot, taskId, 'corpus.json'))
  return new Set((corpus.documents || []).map((document) => document.document_id))
}

function answerCorrect(expectedAnswers, submittedAnswer) {
  const submitted = normalize(submittedAnswer)
  const controlled = new Set(['abstain', 'conflict'])
  return expectedAnswers.map(normalize).some((expected) => {
    if (!expected) return false
    if (controlled.has(expected)) return submitted === expected || submitted.startsWith(`${expected} `)
    return submitted === expected || submitted.includes(expected)
  })
}

function scoreTask(task, gold, answer) {
  const requiredIds = unique(gold.required_evidence_ids)
  const rejectedGoldIds = unique(gold.rejected_evidence_ids)
  const submittedIds = unique(answer?.cited_evidence_ids || answer?.citations)
  const rejectedIds = unique(answer?.rejected_evidence_ids)
  const requiredSet = new Set(requiredIds)
  const submittedSet = new Set(submittedIds)
  const corpusIds = loadCorpusIds(task.task_id)
  const correct = answerCorrect(gold.expected_answers || [], answer?.answer)
  const requiredEvidenceRecall =
    requiredIds.length === 0 ? 1 : requiredIds.filter((id) => submittedSet.has(id)).length / requiredIds.length
  const citationPrecision =
    submittedIds.length === 0
      ? requiredIds.length === 0
        ? 1
        : 0
      : submittedIds.filter((id) => requiredSet.has(id)).length / submittedIds.length
  const expectedControl = (gold.expected_answers || []).map(normalize).some((expected) => expected === 'abstain' || expected === 'conflict')
  const submittedControl = ['abstain', 'conflict'].includes(normalize(answer?.answer).split(' ')[0])
  const abstentionOrConflictCorrect = expectedControl ? correct : !submittedControl
  const rejectedGoldSet = new Set(rejectedGoldIds)
  const validRejected = rejectedIds.filter((id) => corpusIds.has(id) && !submittedSet.has(id))
  const rejectedTargetHits = validRejected.filter((id) => rejectedGoldSet.has(id)).length
  const rejectedDistractorPrecision = rejectedIds.length === 0 ? 0 : validRejected.length / rejectedIds.length
  const rejectedTargetRecall = rejectedGoldIds.length === 0 ? 1 : rejectedTargetHits / rejectedGoldIds.length
  const searchTraceCompleteness = Array.isArray(answer?.search_trace) && answer.search_trace.length > 0 ? 1 : 0

  return {
    task_id: task.task_id,
    category: task.category,
    expected_answers: gold.expected_answers || [],
    submitted_answer: answer?.answer ?? '',
    answer_membership: correct ? 1 : 0,
    required_evidence_recall: Number(requiredEvidenceRecall.toFixed(4)),
    citation_precision: Number(citationPrecision.toFixed(4)),
    rejected_distractor_precision: Number(rejectedDistractorPrecision.toFixed(4)),
    rejected_target_recall: Number(rejectedTargetRecall.toFixed(4)),
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
    'rejected_target_recall',
    'abstention_or_conflict_correctness',
    'search_trace_completeness',
  ]
  const categories = unique(scores.map((score) => score.category))
  return {
    task_count: scores.length,
    macro: Object.fromEntries(metrics.map((metric) => [metric, mean(scores.map((score) => score[metric]))])),
    by_category: Object.fromEntries(
      categories.map((category) => {
        const categoryScores = scores.filter((score) => score.category === category)
        return [category, Object.fromEntries(metrics.map((metric) => [metric, mean(categoryScores.map((score) => score[metric]))]))]
      }),
    ),
  }
}

const suite = readJson(suitePath)
const hiddenGold = readJson(hiddenGoldPath)
const goldByTask = new Map(hiddenGold.tasks.map((task) => [task.task_id, task.gold]))
const submissionPath = argValue('submission')
const reportPath = argValue('report') || join(candidateDir, 'agentic-v5-evaluation-report.json')
if (!submissionPath) throw new Error('Missing --submission=...')

const submission = readJson(join(root, submissionPath))
const submittedByTask = new Map((submission.answers || []).map((answer) => [answer.task_id, answer]))
const scores = suite.tasks.map((task) => scoreTask(task, goldByTask.get(task.task_id), submittedByTask.get(task.task_id)))
const report = {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  system_id: submission.system_id || 'unknown-agentic-system',
  fixture: Boolean(submission.fixture),
  hidden_gold_access: Boolean(submission.hidden_gold_access),
  llm_judge_used: false,
  constant_time_scoring: true,
  eligible_agent_run: false,
  eligibility_note: 'Eligibility is decided by v5 run manifests, not this deterministic report alone.',
  summary: summarize(scores),
  task_scores: scores,
}

writeJson(join(root, reportPath), report)
console.log(`Wrote ${reportPath}`)
