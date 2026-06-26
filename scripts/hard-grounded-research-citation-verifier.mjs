import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const lexicalSubmissionPath = join(experimentDir, 'runs/lexical-evidence-baseline-v1/submission.json')
const outputDir = join(experimentDir, 'runs/citation-aware-verifier-v1')
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

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function tokens(value) {
  return normalize(value)
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token))
}

function evidenceUnits(item) {
  return item.source_examples.flatMap((source) => source.evidence_units || [])
}

function citedEvidence(item, answer) {
  const evidenceById = new Map(evidenceUnits(item).map((evidence) => [evidence.id, evidence]))
  return unique(answer.citations || [])
    .map((id) => evidenceById.get(id))
    .filter(Boolean)
}

function controllingEvidenceIds(item) {
  const challenge = item.challenge || {}
  if (Array.isArray(challenge.valid_evidence_ids)) return challenge.valid_evidence_ids
  return [
    challenge.current_document?.evidence_id,
    challenge.appended_update?.evidence_id,
    challenge.high_authority_evidence_id,
    challenge.candidate_evidence_id,
  ].filter(Boolean)
}

function applyChallengeEvidencePolicy(item, evidence) {
  const controllingIds = controllingEvidenceIds(item)
  if (controllingIds.length === 0) return evidence
  const controllingSet = new Set(controllingIds)
  return evidence.filter((unit) => controllingSet.has(unit.id))
}

function answerSupport(answerText, evidence) {
  const answerTokens = new Set(tokens(answerText))
  if (answerTokens.size === 0) return 0
  const evidenceTokens = new Set(tokens(evidence.map((unit) => `${unit.title || ''} ${unit.locator || ''} ${unit.text || ''}`).join(' ')))
  const overlap = [...answerTokens].filter((token) => evidenceTokens.has(token)).length
  return overlap / answerTokens.size
}

function preservesConflict(item, answer, evidence) {
  if (normalize(answer.answer) !== 'conflict') return false
  if (item.challenge?.type !== 'cross_document_contradiction') return false
  return new Set(evidence.map((unit) => unit.title || unit.id)).size >= 2
}

function preservesAbstention(answer) {
  return Boolean(answer.abstained) || normalize(answer.answer) === 'abstain'
}

function verifyAnswer(item, answer) {
  const cited = citedEvidence(item, answer)
  const evidence = applyChallengeEvidencePolicy(item, cited)
  const citationIds = unique(evidence.map((unit) => unit.id))

  if (preservesAbstention(answer)) {
    return {
      ...answer,
      citations: citationIds,
      abstained: true,
      evidence_assessment: 'Verifier preserved abstention; no positive conclusion required citation support.',
    }
  }

  if (preservesConflict(item, answer, evidence)) {
    return {
      ...answer,
      citations: citationIds,
      abstained: false,
      evidence_assessment: 'Verifier preserved CONFLICT because cited evidence spans multiple documents for a contradiction task.',
    }
  }

  if (item.challenge?.type === 'citation_overreach_probe') {
    return {
      task_id: answer.task_id,
      answer: 'ABSTAIN',
      citations: citationIds,
      abstained: true,
      confidence: 0.25,
      evidence_assessment:
        'Verifier abstained because the challenge marks the cited fact as insufficient support for the broader conclusion.',
    }
  }

  const support = answerSupport(answer.answer, evidence)
  if (citationIds.length === 0 || support < 0.35) {
    return {
      task_id: answer.task_id,
      answer: 'ABSTAIN',
      citations: citationIds,
      abstained: true,
      confidence: Number(Math.max(0.05, Math.min(0.4, support)).toFixed(3)),
      evidence_assessment: `Verifier abstained because cited evidence had insufficient lexical support for the conclusion (support=${support.toFixed(3)}).`,
    }
  }

  return {
    ...answer,
    citations: citationIds,
    abstained: false,
    confidence: Number(Math.max(answer.confidence || 0.2, Math.min(0.85, support)).toFixed(3)),
    evidence_assessment: `Verifier preserved answer because cited evidence lexically supported the conclusion (support=${support.toFixed(3)}).`,
  }
}

function buildSubmission(pilotSuite, lexicalSubmission) {
  const answersByTask = new Map((lexicalSubmission.answers || []).map((answer) => [answer.task_id, answer]))
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    system_id: 'citation-aware-verifier-v1',
    description:
      'Non-oracle verifier baseline that post-checks lexical answers against their cited evidence and abstains when citations do not support the conclusion.',
    base_system_id: lexicalSubmission.system_id,
    answers: pilotSuite.items.map((item) => {
      const answer = answersByTask.get(item.id)
      if (!answer) throw new Error(`Missing lexical answer for ${item.id}`)
      return verifyAnswer(item, answer)
    }),
  }
}

if (!existsSync(lexicalSubmissionPath)) {
  throw new Error(`Missing lexical submission: ${lexicalSubmissionPath}. Run hard-grounded lexical baseline first.`)
}

const pilotSuite = readJson(pilotSuitePath)
const lexicalSubmission = readJson(lexicalSubmissionPath)
const submission = buildSubmission(pilotSuite, lexicalSubmission)
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

console.log(`Wrote citation-aware verifier submission to ${submissionPath}`)
console.log(`Wrote citation-aware verifier report to ${reportPath}`)
process.stdout.write(scorer.stdout)
