import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v8-candidate')
const runsDir = join(experimentDir, 'agentic-v8-runs')
const auditPath = join(candidateDir, 'audit.json')
const outputPath = join(candidateDir, 'frontier-difficulty-gate.json')
const markdownPath = join(experimentDir, 'AGENTIC_V8_FRONTIER_DIFFICULTY_GATE.md')
const candidateMarkdownPath = join(experimentDir, 'AGENTIC_V8_CANDIDATE.md')

const MAX_BUYER_READY_ANSWER_MEMBERSHIP = 0.65
const MAX_BUYER_READY_EVIDENCE_RECALL = 0.75

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

function pct(value) {
  return `${Math.round((value || 0) * 1000) / 10}%`
}

function listReports() {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .map((name) => join(runsDir, name))
    .filter((path) => statSync(path).isDirectory())
    .map((runDir) => ({ runDir, manifestPath: join(runDir, 'run-manifest.json'), reportPath: join(runDir, 'report.json') }))
    .filter((entry) => existsSync(entry.manifestPath) && existsSync(entry.reportPath))
}

const runs = listReports().map((entry) => {
  const manifest = readJson(entry.manifestPath)
  const report = readJson(entry.reportPath)
  return {
    run_id: manifest.run_id,
    agent_surface: manifest.agent_surface,
    model: manifest.model,
    model_version: manifest.model_version,
    answer_membership: report.summary.macro.answer_membership,
    required_evidence_recall: report.summary.macro.required_evidence_recall,
    citation_precision: report.summary.macro.citation_precision,
  }
})

const maxAnswerMembership = Math.max(0, ...runs.map((run) => run.answer_membership || 0))
const maxEvidenceRecall = Math.max(0, ...runs.map((run) => run.required_evidence_recall || 0))
const gatePassed =
  runs.length >= 2 &&
  maxAnswerMembership <= MAX_BUYER_READY_ANSWER_MEMBERSHIP &&
  maxEvidenceRecall <= MAX_BUYER_READY_EVIDENCE_RECALL

const report = {
  report_id: 'agentic-v8-frontier-difficulty-gate',
  suite_id: 'agentic-large-corpus-research-v8-candidate',
  checked_date: '2026-06-26',
  eligible_run_count: runs.length,
  max_buyer_ready_answer_membership: MAX_BUYER_READY_ANSWER_MEMBERSHIP,
  max_buyer_ready_evidence_recall: MAX_BUYER_READY_EVIDENCE_RECALL,
  observed_max_answer_membership: maxAnswerMembership,
  observed_max_evidence_recall: maxEvidenceRecall,
  buyer_gate_passed: gatePassed,
  interpretation: gatePassed
    ? 'Current frontier agents do not solve the v8 candidate at buyer-disqualifying rates.'
    : 'The v8 candidate is not frontier-lab-grade: current frontier agents solve too much of it.',
  runs,
}

writeJson(outputPath, report)

const audit = readJson(auditPath)
audit.frontier_difficulty_gate = {
  report_path: 'generated/agentic-v8-candidate/frontier-difficulty-gate.json',
  eligible_run_count: report.eligible_run_count,
  observed_max_answer_membership: report.observed_max_answer_membership,
  observed_max_evidence_recall: report.observed_max_evidence_recall,
  buyer_gate_passed: report.buyer_gate_passed,
}
audit.checks.frontier_agent_failure_gate_passed = report.buyer_gate_passed
audit.status = report.buyer_gate_passed ? audit.status : 'candidate_rejected_by_frontier_baseline'
audit.reason = report.buyer_gate_passed
  ? audit.reason
  : 'The v8 candidate clears shallow and evidence-contract gates but is rejected because current frontier tool-using agents solve too much of it.'
audit.buyer_ready = false
audit.blockers = [
  ...(report.buyer_gate_passed
    ? []
    : [
        'Remove remaining visible locator/rule shortcuts and regenerate tasks whose solution can be recovered by generic corpus parsing.',
        'Rerun Codex CLI and Claude Code after the rewrite and require frontier difficulty gate pass before buyer claims.',
      ]),
  ...audit.blockers.filter(
    (blocker) =>
      !blocker.startsWith('Run current Codex CLI and Claude Code') &&
      !blocker.startsWith('Remove visible marker-role shortcuts') &&
      !blocker.startsWith('Remove remaining visible locator/rule shortcuts') &&
      !blocker.startsWith('Rerun Codex CLI and Claude Code'),
  ),
]
writeJson(auditPath, audit)

const runRows =
  runs.length === 0
    ? '| none | none | none | 0% | 0% | 0% |'
    : runs
        .map(
          (run) =>
            `| ${run.run_id} | ${run.agent_surface} | ${run.model_version} | ${pct(run.answer_membership)} | ${pct(
              run.required_evidence_recall,
            )} | ${pct(run.citation_precision)} |`,
        )
        .join('\n')

writeText(
  markdownPath,
  `# Agentic V8 Frontier Difficulty Gate

This gate rejects candidate suites that are solved too well by current frontier tool-using agents.

## Result

- Eligible runs: ${report.eligible_run_count}
- Buyer gate passed: ${report.buyer_gate_passed}
- Observed max answer membership: ${pct(report.observed_max_answer_membership)}
- Observed max evidence recall: ${pct(report.observed_max_evidence_recall)}
- Max buyer-ready answer membership threshold: ${pct(MAX_BUYER_READY_ANSWER_MEMBERSHIP)}
- Max buyer-ready evidence recall threshold: ${pct(MAX_BUYER_READY_EVIDENCE_RECALL)}

${report.interpretation}

## Runs

| Run | Surface | Model/version | Answer membership | Evidence recall | Citation precision |
| --- | --- | --- | ---: | ---: | ---: |
${runRows}
`,
)

writeText(
  candidateMarkdownPath,
  `# Agentic V8 Candidate Suite

This candidate suite is a replacement path for the v3 suite's diversity failure.

## Status

- Status: ${audit.status}
- Buyer ready: ${audit.buyer_ready}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories}
- Unique native questions: ${audit.summary.unique_native_questions}/150
- Corpus documents per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Source rows available: ${audit.summary.source_rows_available}
- Redistributable preview rows: ${audit.summary.redistributable_preview_rows_available}
- Pointer-only rows: ${audit.summary.pointer_only_rows_available}
- Shallow baseline solved: ${audit.shallow_baseline?.solved_count ?? 'not run'}/${audit.summary.task_count}
- Evidence contract audit failed: ${audit.evidence_contract_audit?.fail_count ?? 'not run'}/${audit.summary.task_count}
- Frontier max answer membership: ${pct(report.observed_max_answer_membership)}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Updated ${auditPath}`)
console.log(`Wrote ${markdownPath}`)
console.log(`Updated ${candidateMarkdownPath}`)
