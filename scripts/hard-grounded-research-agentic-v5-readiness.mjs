import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v5-candidate')
const suitePath = join(candidateDir, 'suite.json')
const outputPath = join(candidateDir, 'agentic-v5-readiness.json')
const markdownPath = join(experimentDir, 'AGENTIC_V5_READINESS.md')
const runsDir = join(experimentDir, 'agentic-v5-runs')

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

function listRunManifests() {
  if (!existsSync(runsDir)) return []
  return readdirSync(runsDir)
    .map((name) => join(runsDir, name, 'run-manifest.json'))
    .filter((path) => existsSync(path) && statSync(path).isFile())
}

function eligibleRun(manifest, suite) {
  const reasons = []
  if (manifest.evaluation_source !== suite.suite_id) reasons.push('wrong_evaluation_source')
  if (!manifest.agent_surface) reasons.push('missing_agent_surface')
  if (!manifest.model) reasons.push('missing_model')
  if (!manifest.model_version && !manifest.model_snapshot) reasons.push('missing_model_version_or_snapshot')
  if (!manifest.inference_date) reasons.push('missing_inference_date')
  if (!manifest.frontier_model_attestation) reasons.push('missing_frontier_model_attestation')
  if (!Array.isArray(manifest.tools_enabled) || manifest.tools_enabled.length === 0) reasons.push('missing_tools_enabled')
  if (!manifest.command_transcript_path) reasons.push('missing_command_transcript_path')
  if (manifest.hidden_gold_access !== false) reasons.push('hidden_gold_access_not_false')
  if (manifest.single_call_packet_run === true) reasons.push('single_call_packet_run')
  if (manifest.task_count !== suite.task_count) reasons.push('task_count_mismatch')
  if (!manifest.scored_report_path) reasons.push('missing_scored_report_path')
  if (manifest.scored_report_path && !existsSync(join(root, manifest.scored_report_path))) reasons.push('scored_report_path_missing_on_disk')
  if (manifest.command_transcript_path && !existsSync(join(root, manifest.command_transcript_path))) reasons.push('command_transcript_path_missing_on_disk')
  return { eligible: reasons.length === 0, rejection_reasons: reasons }
}

const suite = readJson(suitePath)
const manifests = listRunManifests().map((path) => {
  const manifest = readJson(path)
  const gate = eligibleRun(manifest, suite)
  return {
    run_id: manifest.run_id || path.split('/').slice(-2, -1)[0],
    path,
    agent_surface: manifest.agent_surface || '',
    model: manifest.model || '',
    model_version: manifest.model_version || manifest.model_snapshot || '',
    evaluation_source: manifest.evaluation_source || '',
    task_count: manifest.task_count || 0,
    eligible: gate.eligible,
    rejection_reasons: gate.rejection_reasons,
  }
})

const eligibleRuns = manifests.filter((run) => run.eligible)
const requiredEligibleRuns = 2
const readiness = {
  benchmark_id: 'hard-grounded-research-benchmark',
  suite_id: suite.suite_id,
  task_count: suite.task_count,
  required_eligible_frontier_agent_runs: requiredEligibleRuns,
  eligible_frontier_agent_runs: eligibleRuns.length,
  ready: eligibleRuns.length >= requiredEligibleRuns,
  completion_claim_allowed: eligibleRuns.length >= requiredEligibleRuns,
  run_manifest_count: manifests.length,
  runs: manifests,
  blockers:
    eligibleRuns.length >= requiredEligibleRuns
      ? []
      : [
          'Run Codex CLI and Claude Code over the v5 no-gold workspaces.',
          'Each eligible v5 run must include a command transcript, scored report, exact model attestation, and hidden_gold_access=false.',
        ],
}

writeJson(outputPath, readiness)

const runRows =
  manifests.length === 0
    ? '| none | none | none | 0 | no | no eligible v5 run manifests found |'
    : manifests
        .map((run) =>
          `| ${run.run_id} | ${run.agent_surface || 'missing'} | ${run.model}${run.model_version ? `<br>${run.model_version}` : ''} | ${
            run.task_count
          } | ${run.eligible ? 'yes' : 'no'} | ${run.rejection_reasons.join('<br>') || 'none'} |`,
        )
        .join('\n')

writeText(
  markdownPath,
  `# Agentic V5 Readiness

This gate checks whether the v5 candidate has eligible frontier tool-using agent runs.

## Status

- Suite: ${suite.suite_id}
- Tasks: ${suite.task_count}
- Required eligible frontier agent runs: ${requiredEligibleRuns}
- Eligible frontier agent runs: ${eligibleRuns.length}
- Ready: ${readiness.ready}
- Completion claim allowed: ${readiness.completion_claim_allowed}

## Run Manifests

| Run | Surface | Model/version | Tasks | Eligible | Rejection reasons |
| --- | --- | --- | ---: | --- | --- |
${runRows}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Wrote ${markdownPath}`)
