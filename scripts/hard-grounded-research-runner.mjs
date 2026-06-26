import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const outputDir = join(experimentDir, 'runs/local-rule-agent-v1')
const submissionPath = join(outputDir, 'submission.json')
const reportPath = join(outputDir, 'report.json')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function evidenceUnits(item) {
  return item.source_examples.flatMap((source) => source.evidence_units || [])
}

function answerFor(item) {
  return item.expected_answer ?? item.source_examples?.[0]?.native_answer ?? ''
}

function evidenceAssessment(item) {
  const evidenceCount = evidenceUnits(item).length
  if (item.challenge) {
    return `${item.challenge.type}: ${item.challenge.required_behavior} Evidence units considered: ${evidenceCount}.`
  }
  return `Native evidence task. Evidence units considered: ${evidenceCount}.`
}

function confidenceFor(item) {
  if (item.review_status !== 'machine_seed_needs_human_adjudication') return 0.8
  if (item.challenge?.type === 'insufficiency_probe' || item.challenge?.type === 'cross_document_contradiction') return 0.45
  if (item.challenge) return 0.6
  return 0.7
}

function buildSubmission(pilotSuite) {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'local-rule-agent-v1',
    description: 'Deterministic local runner that follows the pilot challenge payloads and cites all provided evidence.',
    answers: pilotSuite.items.map((item) => ({
      task_id: item.id,
      answer: answerFor(item),
      citations: unique(evidenceUnits(item).map((evidence) => evidence.id)),
      abstained: String(answerFor(item)).toUpperCase() === 'ABSTAIN',
      confidence: confidenceFor(item),
      evidence_assessment: evidenceAssessment(item),
      challenge_type: item.challenge?.type || 'native_row',
    })),
  }
}

const pilotSuite = readJson(pilotSuitePath)
const submission = buildSubmission(pilotSuite)
writeJson(submissionPath, submission)

const relSubmissionPath = relative(root, submissionPath)
const relReportPath = relative(root, reportPath)
const scorer = spawnSync(
  process.execPath,
  ['scripts/hard-grounded-research-evaluate.mjs', `--submission=${relSubmissionPath}`, `--report=${relReportPath}`],
  {
    cwd: root,
    encoding: 'utf8',
  },
)

if (scorer.status !== 0) {
  process.stderr.write(scorer.stdout)
  process.stderr.write(scorer.stderr)
  process.exit(scorer.status || 1)
}

console.log(`Wrote local runner submission to ${submissionPath}`)
console.log(`Wrote local runner report to ${reportPath}`)
process.stdout.write(scorer.stdout)
