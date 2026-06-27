import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const outputPath = join(experimentDir, 'BUYER_EVALUATION_PACKET.md')
const jsonPath = join(generatedDir, 'buyer-evaluation-packet.json')

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

const suite = readJson(join(generatedDir, 'agentic-research-suite.json'))
const buyerAudit = readJson(join(generatedDir, 'agentic-buyer-grade-audit.json'))
const readiness = readJson(join(generatedDir, 'agentic-readiness.json'))
const objectiveAudit = readJson(join(generatedDir, 'objective-completion-audit.json'))
const noveltyAudit = readJson(join(generatedDir, 'novelty-audit.json'))
const oracleReport = readJson(join(generatedDir, 'agentic-oracle-report.json'))
const failureAnalysisPath = join(generatedDir, 'agentic-failure-analysis.json')
const failureAnalysis = existsSync(failureAnalysisPath) ? readJson(failureAnalysisPath) : null
function candidateSummary(version) {
  const candidateDir = join(generatedDir, `agentic-${version}-candidate`)
  const auditPath = join(candidateDir, 'audit.json')
  if (!existsSync(auditPath)) return null
  const audit = readJson(auditPath)
  const readinessPath = join(candidateDir, `agentic-${version}-readiness.json`)
  const failurePath = join(candidateDir, `agentic-${version}-failure-analysis.json`)
  const frontierGatePath = join(candidateDir, 'frontier-difficulty-gate.json')
  const readinessReport = existsSync(readinessPath) ? readJson(readinessPath) : null
  const failureReport = existsSync(failurePath) ? readJson(failurePath) : null
  const frontierGate = existsSync(frontierGatePath) ? readJson(frontierGatePath) : null
  return {
    version,
    status: audit.status,
    buyer_ready: audit.buyer_ready,
    task_count: audit.summary.task_count,
    unique_native_questions: audit.summary.unique_native_questions,
    shallow_baseline_solved_count: audit.shallow_baseline?.solved_count,
    shallow_baseline_solve_rate: audit.shallow_baseline?.solve_rate,
    evidence_contract_fail_count: audit.evidence_contract_audit?.fail_count,
    evidence_contract_gates: audit.evidence_contract_audit?.gates,
    eligible_frontier_agent_runs: readinessReport?.eligible_frontier_agent_runs,
    frontier_gate_passed: frontierGate?.buyer_gate_passed,
    frontier_observed_max_answer_membership: frontierGate?.observed_max_answer_membership,
    frontier_observed_max_evidence_recall: frontierGate?.observed_max_evidence_recall,
    frontier_runs_analyzed: failureReport?.runs?.length,
    blockers: audit.blockers,
  }
}

const candidateAttempts = ['v4', 'v5', 'v6', 'v7', 'v8', 'v9', 'v10'].map(candidateSummary).filter(Boolean)
const latestCandidate = candidateAttempts.at(-1) || null

function unique(values) {
  return [...new Set(values.filter(Boolean))]
}

const packet = {
  packet_id: 'hard-grounded-agentic-buyer-evaluation-packet-v1',
  checked_date: '2026-06-26',
  buyer_ready: buyerAudit.ready_for_buyer_claim === true && readiness.ready === true,
  suite: {
    suite_id: suite.suite_id,
    task_count: suite.task_count,
    categories: suite.category_count,
    corpus_documents_per_task: suite.corpus_documents_per_task_target,
    scoring: suite.primary_scoring,
  },
  novelty_position: {
    status: noveltyAudit.status,
    final_novelty_claim_allowed: noveltyAudit.final_novelty_claim_allowed,
    claim_boundary:
      'Defensible only as a unified HF-derived hard-grounded research-QA failure suite, not as first work on each individual subproblem.',
  },
  empirical_status: {
    eligible_frontier_agent_runs: readiness.eligible_frontier_agent_runs,
    required_eligible_frontier_agent_runs: readiness.required_eligible_frontier_agent_runs,
    fresh_expanded_suite_runs_present: readiness.ready,
    oracle_smoke_task_count: oracleReport.summary?.task_count,
    oracle_smoke_macro: oracleReport.summary?.macro,
  },
  failure_analysis: failureAnalysis
    ? {
        runs_analyzed: failureAnalysis.runs.length,
        task_scores_analyzed: failureAnalysis.aggregate.task_score_count,
        aggregate_macro: failureAnalysis.aggregate.macro,
        structural_blockers: failureAnalysis.structural_blockers,
      }
    : null,
  candidate_attempts: candidateAttempts,
  latest_candidate: latestCandidate,
  limitations: [
    buyerAudit.checks?.unique_native_question_minimum_met === false
      ? `The current v3 suite has only ${buyerAudit.summary.unique_native_questions}/${buyerAudit.summary.unique_native_question_minimum} required distinct native questions; it is diagnostic, not sellable.`
      : null,
    readiness.ready === false
      ? 'Fresh Codex CLI and Claude Code runs over all 200 current workspaces have not both been collected yet.'
      : null,
    latestCandidate?.frontier_gate_passed === false
      ? `Latest candidate ${latestCandidate.version} is rejected by frontier-agent baselines: observed max answer membership ${Math.round((latestCandidate.frontier_observed_max_answer_membership || 0) * 1000) / 10}% and evidence recall ${Math.round((latestCandidate.frontier_observed_max_evidence_recall || 0) * 1000) / 10}%.`
      : null,
    latestCandidate?.version &&
    ['v8', 'v9', 'v10'].includes(latestCandidate.version) &&
    (latestCandidate?.eligible_frontier_agent_runs ?? 0) < 2
      ? `${latestCandidate.version.toUpperCase()} has one eligible Codex CLI frontier run; Claude Code opus attempts are documented for v8 but not yet an eligible full 200-task scored baseline for the latest candidate.`
      : null,
    'Some gold labels are HF-derived or deterministic transforms and need targeted audit before a paid benchmark sale.',
    'The current corpus uses compact document previews plus provenance hashes, not full upstream document redistribution.',
    'Novelty is bounded and must be sold as a combined hard-grounded research benchmark, not as a unique solution to each subproblem.',
  ].filter(Boolean),
  next_required_work: unique(latestCandidate?.blockers?.length ? latestCandidate.blockers : buyerAudit.blockers),
  objective_completion: {
    complete: objectiveAudit.full_thread_goal_complete,
    completion_claim_allowed: objectiveAudit.completion_claim_allowed,
    partial_requirements: objectiveAudit.requirements
      .filter((requirement) => requirement.status !== 'passes')
      .map((requirement) => ({
        id: requirement.id,
        status: requirement.status,
        evidence: requirement.evidence,
        required_action: requirement.caveat,
      })),
  },
}

writeJson(jsonPath, packet)

writeText(
  outputPath,
  `# Buyer Evaluation Packet

This packet is the current sellability brief for the hard-grounded agentic benchmark.

## Bottom Line

- Buyer ready: ${packet.buyer_ready}
- Suite: ${packet.suite.suite_id}
- Tasks: ${packet.suite.task_count}
- Categories: ${packet.suite.categories}
- Corpus documents per task: ${packet.suite.corpus_documents_per_task}
- Scoring: deterministic, constant-time after submission, no LLM judge required
- Fresh frontier-agent runs: ${readiness.eligible_frontier_agent_runs}/${readiness.required_eligible_frontier_agent_runs}
- Unique native questions: ${buyerAudit.summary.unique_native_questions}/${buyerAudit.summary.unique_native_question_minimum}

This is a diagnostic expanded benchmark artifact, but not yet a sellable frontier-lab benchmark. The latest candidate is ${latestCandidate ? `${latestCandidate.version} with status \`${latestCandidate.status}\`` : 'not available'}.

## What It Tests

The suite targets multi-hop synthesis, stale/current conflicts, appended lifecycle updates, table-text reasoning, authority conflicts, evidence insufficiency, citation-overreach, entity disambiguation, temporal-as-of questions, and cross-document contradiction.

Each task gives the agent a no-gold workspace with 1,000 documents. The agent must search, answer, cite exact document ids, reject misleading evidence, and write structured JSON.

## Novelty Position

- Novelty status: ${packet.novelty_position.status}
- Final novelty claim allowed: ${packet.novelty_position.final_novelty_claim_allowed}
- Claim boundary: ${packet.novelty_position.claim_boundary}

## Current Empirical Evidence

The oracle smoke fixture scores the deterministic evaluator over ${packet.empirical_status.oracle_smoke_task_count} tasks. This proves scorer mechanics only; it is not an eligible model baseline.

Latest candidate frontier-agent runs: ${latestCandidate?.eligible_frontier_agent_runs ?? 0}/2. Frontier difficulty gate passed: ${latestCandidate?.frontier_gate_passed ?? false}.

## Failure Analysis

${failureAnalysis ? `Runs analyzed: ${failureAnalysis.runs.length}. Aggregate answer membership: ${Math.round((failureAnalysis.aggregate.macro.answer_membership || 0) * 1000) / 10}%. Aggregate evidence recall: ${Math.round((failureAnalysis.aggregate.macro.required_evidence_recall || 0) * 1000) / 10}%. See \`AGENTIC_FAILURE_ANALYSIS.md\`.` : 'No scored agentic failure analysis is available yet.'}

## Candidate Attempt Status

| Candidate | Status | Tasks | Unique questions | Evidence audit failures | Eligible frontier runs | Frontier gate | Max answer membership | Max evidence recall |
| --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
${candidateAttempts
  .map(
    (candidate) =>
      `| ${candidate.version} | ${candidate.status} | ${candidate.task_count} | ${candidate.unique_native_questions} | ${candidate.evidence_contract_fail_count ?? 'not-run'} | ${candidate.eligible_frontier_agent_runs ?? 0} | ${candidate.frontier_gate_passed === true ? 'pass' : 'fail/not-run'} | ${
        candidate.frontier_observed_max_answer_membership == null
          ? 'not-run'
          : `${Math.round(candidate.frontier_observed_max_answer_membership * 1000) / 10}%`
      } | ${
        candidate.frontier_observed_max_evidence_recall == null
          ? 'not-run'
          : `${Math.round(candidate.frontier_observed_max_evidence_recall * 1000) / 10}%`
      } |`,
  )
  .join('\n')}

## Limitations

${packet.limitations.map((limitation) => `- ${limitation}`).join('\n')}

## Required Work Before Selling

${packet.next_required_work.map((work) => `- ${work}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${jsonPath}`)
