import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
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
  limitations: [
    'Fresh Codex CLI and Claude Code runs over all 200 v3 workspaces have not been collected yet.',
    'Some gold labels are HF-derived or deterministic transforms and need targeted audit before a paid benchmark sale.',
    'The current corpus uses compact document previews plus provenance hashes, not full upstream document redistribution.',
    'Novelty is bounded and must be sold as a combined hard-grounded research benchmark, not as a unique solution to each subproblem.',
  ],
  next_required_work: buyerAudit.blockers,
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

This is now a serious expanded benchmark artifact, but not yet a sellable frontier-lab benchmark because fresh 200-task Codex CLI and Claude Code runs have not been collected.

## What It Tests

The suite targets multi-hop synthesis, stale/current conflicts, appended lifecycle updates, table-text reasoning, authority conflicts, evidence insufficiency, citation-overreach, entity disambiguation, temporal-as-of questions, and cross-document contradiction.

Each task gives the agent a no-gold workspace with 1,000 documents. The agent must search, answer, cite exact document ids, reject misleading evidence, and write structured JSON.

## Novelty Position

- Novelty status: ${packet.novelty_position.status}
- Final novelty claim allowed: ${packet.novelty_position.final_novelty_claim_allowed}
- Claim boundary: ${packet.novelty_position.claim_boundary}

## Current Empirical Evidence

The oracle smoke fixture scores the deterministic evaluator over ${packet.empirical_status.oracle_smoke_task_count} tasks. This proves scorer mechanics only; it is not an eligible model baseline.

Fresh expanded-suite frontier-agent runs are missing. Historical 10-task runs are intentionally rejected by readiness because the suite is now v3 with 200 tasks.

## Limitations

${packet.limitations.map((limitation) => `- ${limitation}`).join('\n')}

## Required Work Before Selling

${packet.next_required_work.map((work) => `- ${work}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${jsonPath}`)
