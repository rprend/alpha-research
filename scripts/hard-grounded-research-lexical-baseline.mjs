import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const outputDir = join(experimentDir, 'runs/lexical-evidence-baseline-v1')
const submissionPath = join(outputDir, 'submission.json')
const reportPath = join(outputDir, 'report.json')

const stopwords = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'do',
  'does',
  'for',
  'from',
  'given',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'the',
  'this',
  'to',
  'using',
  'what',
  'when',
  'which',
  'who',
  'with',
])

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

function tokens(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token))
}

function evidenceUnits(item) {
  return item.source_examples.flatMap((source) => source.evidence_units || [])
}

function scoreEvidence(question, evidence) {
  const questionTokens = new Set(tokens(question))
  const evidenceTokens = new Set(tokens(`${evidence.title || ''} ${evidence.locator || ''} ${evidence.text || ''}`))
  const overlap = [...questionTokens].filter((token) => evidenceTokens.has(token)).length
  return overlap / Math.max(1, questionTokens.size)
}

function topEvidence(item, limit = 2) {
  return evidenceUnits(item)
    .map((evidence, index) => ({
      evidence,
      index,
      score: scoreEvidence(item.question, evidence),
    }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
}

function labelFromEvidence(rankedEvidence) {
  const joined = rankedEvidence.map(({ evidence }) => `${evidence.locator || ''} ${evidence.text || ''}`).join(' ')
  if (/\bnot[_ ]?enough[_ ]?info\b/i.test(joined)) return 'ABSTAIN'
  if (/\brefutes?\b/i.test(joined)) return 'REFUTES'
  if (/\bsupports?\b/i.test(joined)) return 'SUPPORTS'
  if (/\bdisputed|conflict|contradict/i.test(joined)) return 'CONFLICT'
  return ''
}

function answerFor(item, rankedEvidence) {
  if (item.challenge?.type === 'insufficiency_probe') return 'ABSTAIN'
  if (item.challenge?.type === 'cross_document_contradiction') return 'CONFLICT'

  const label = labelFromEvidence(rankedEvidence)
  if (label) return label

  const best = rankedEvidence[0]?.evidence
  if (!best) return 'ABSTAIN'
  const firstSentence = String(best.text || '').split(/(?<=[.!?])\s+/)[0]
  if (!firstSentence) return 'ABSTAIN'
  return firstSentence.length > 180 ? `${firstSentence.slice(0, 177).trim()}...` : firstSentence
}

function buildSubmission(pilotSuite) {
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'lexical-evidence-baseline-v1',
    description:
      'Non-oracle lexical baseline that ranks provided evidence by question-token overlap and answers with simple abstain/conflict/label/text heuristics.',
    answers: pilotSuite.items.map((item) => {
      const rankedEvidence = topEvidence(item)
      const answer = answerFor(item, rankedEvidence)
      return {
        task_id: item.id,
        answer,
        citations: unique(rankedEvidence.map(({ evidence }) => evidence.id)),
        abstained: String(answer).toUpperCase() === 'ABSTAIN',
        confidence: rankedEvidence[0] ? Number(Math.min(0.8, 0.25 + rankedEvidence[0].score).toFixed(3)) : 0.1,
        evidence_assessment: `Selected ${rankedEvidence.length} evidence units by lexical question overlap without reading gold answers.`,
      }
    }),
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

console.log(`Wrote lexical baseline submission to ${submissionPath}`)
console.log(`Wrote lexical baseline report to ${reportPath}`)
process.stdout.write(scorer.stdout)
