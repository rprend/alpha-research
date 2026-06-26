import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const adjudicationQueuePath = join(generatedDir, 'adjudication-queue.jsonl')
const calibrationSuitePath = join(generatedDir, 'calibration-suite.json')
const calibrationSummaryPath = join(generatedDir, 'calibration-suite-summary.json')

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(JSON.parse)
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

function allEvidenceIds(row) {
  return (row.evidence_units || []).map((unit) => unit.id)
}

function candidateLabel(row) {
  const answer = String(row.expected_answer_candidate || '').toUpperCase()
  if (answer === 'SUPPORTS') return 'SUPPORTED'
  if (answer === 'REFUTES') return 'REFUTED'
  if (answer === 'NOT_ENOUGH_INFO' || answer === 'ABSTAIN') return 'INSUFFICIENT'
  return 'SUPPORTED'
}

function challengeCitationIds(row) {
  const challenge = row.challenge || {}
  if (challenge.type === 'stale_current_conflict') return [challenge.current_document?.evidence_id].filter(Boolean)
  if (challenge.type === 'document_lifecycle_appendix') {
    return [challenge.original_body?.evidence_id, challenge.appended_update?.evidence_id].filter(Boolean)
  }
  if (challenge.type === 'authority_conflict') return [challenge.high_authority_evidence_id].filter(Boolean)
  if (challenge.type === 'cross_document_contradiction') {
    return [challenge.document_a_evidence_id, challenge.document_b_evidence_id].filter(Boolean)
  }
  if (challenge.type === 'as_of_date_constraint') return challenge.valid_evidence_ids || []
  return []
}

function calibrateRow(row, pilotItem) {
  const challengeType = row.challenge?.type || 'native_row'
  const evidenceIds = allEvidenceIds(row)
  const challengeIds = challengeCitationIds(row)

  if (challengeType === 'insufficiency_probe' || challengeType === 'citation_overreach_probe') {
    return {
      final_label: 'INSUFFICIENT',
      final_answer: 'ABSTAIN',
      required_citation_ids: [],
      insufficient_or_conflicting_evidence: true,
      notes: `Provisional calibration label: ${challengeType} requires abstention because the supplied evidence is intentionally insufficient for the requested conclusion.`,
    }
  }

  if (challengeType === 'cross_document_contradiction') {
    return {
      final_label: 'CONFLICT',
      final_answer: 'CONFLICT',
      required_citation_ids: unique(challengeIds),
      insufficient_or_conflicting_evidence: true,
      notes: 'Provisional calibration label: contradiction item requires reporting unresolved conflict and citing both conflicting document sides.',
    }
  }

  const label = candidateLabel(row)
  const requiredCitationIds = unique(challengeIds.length ? challengeIds : evidenceIds)
  return {
    final_label: label,
    final_answer: String(row.expected_answer_candidate || pilotItem?.expected_answer_candidate || '').trim() || label,
    required_citation_ids: requiredCitationIds,
    insufficient_or_conflicting_evidence: false,
    notes:
      challengeType === 'native_row'
        ? 'Provisional calibration label copied from native dataset answer/evidence; requires human review before promotion to gold.'
        : `Provisional calibration label derived from structured ${challengeType} challenge metadata; requires human review before promotion to gold.`,
  }
}

function buildCalibrationSuite(rows, pilotSuite) {
  const pilotById = new Map(pilotSuite.items.map((item) => [item.id, item]))
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    version: 'provisional-calibration-v0',
    status: 'provisional_calibration_not_gold',
    source_queue: 'generated/adjudication-queue.jsonl',
    warning:
      'This suite is mechanically derived for scorer and baseline calibration. It is not publishable gold and must not be used for final paper claims.',
    items: rows.map((row) => {
      const pilotItem = pilotById.get(row.item_id)
      const fields = calibrateRow(row, pilotItem)
      return {
        id: row.item_id,
        category: row.category,
        construction: row.construction,
        transform: row.transform,
        challenge: row.challenge || null,
        question: row.question,
        calibration_status: 'provisional_not_human_reviewed',
        final_label: fields.final_label,
        final_answer: fields.final_answer,
        required_citation_ids: fields.required_citation_ids,
        insufficient_or_conflicting_evidence: fields.insufficient_or_conflicting_evidence,
        notes: fields.notes,
        evidence_units: row.evidence_units,
        scoring_focus: pilotItem?.scoring_focus || [],
        expected_failure: pilotItem?.expected_failure || '',
      }
    }),
  }
}

function summarize(suite) {
  const byCategory = Object.fromEntries(
    unique(suite.items.map((item) => item.category)).map((category) => {
      const items = suite.items.filter((item) => item.category === category)
      return [
        category,
        {
          total: items.length,
          labels: items.reduce((counts, item) => {
            counts[item.final_label] = (counts[item.final_label] || 0) + 1
            return counts
          }, {}),
        },
      ]
    }),
  )
  return {
    benchmark_id: suite.benchmark_id,
    version: suite.version,
    status: suite.status,
    total_items: suite.items.length,
    by_category: byCategory,
    publishable_gold: false,
  }
}

assert(existsSync(pilotSuitePath), `Missing pilot suite: ${pilotSuitePath}`)
assert(existsSync(adjudicationQueuePath), `Missing adjudication queue: ${adjudicationQueuePath}`)

const pilotSuite = readJson(pilotSuitePath)
const rows = readJsonl(adjudicationQueuePath)
const suite = buildCalibrationSuite(rows, pilotSuite)
writeJson(calibrationSuitePath, suite)
writeJson(calibrationSummaryPath, summarize(suite))

console.log(`Wrote provisional calibration suite to ${calibrationSuitePath}`)
console.log(`Wrote provisional calibration summary to ${calibrationSummaryPath}`)
