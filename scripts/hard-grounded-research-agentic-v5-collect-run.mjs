import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v5-candidate')
const suitePath = join(candidateDir, 'suite.json')
const workspaceRoot = join(candidateDir, 'workspaces')
const runsDir = join(experimentDir, 'agentic-v5-runs')

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function requireArg(name) {
  const value = argValue(name)
  if (!value) throw new Error(`Missing --${name}=...`)
  return value
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

const runId = requireArg('run-id')
const agentSurface = requireArg('agent-surface')
const model = requireArg('model')
const modelVersion = argValue('model-version', model)
const frontierModelAttestation = requireArg('frontier-model-attestation')
const transcriptPath = requireArg('transcript')
const answersRootArg = argValue('answers-root', workspaceRoot)
const answersRoot = isAbsolute(answersRootArg) ? answersRootArg : join(root, answersRootArg)
const toolsEnabled = argValue('tools', 'shell,filesystem,search')
  .split(',')
  .map((tool) => tool.trim())
  .filter(Boolean)

const suite = readJson(suitePath)
const outDir = join(runsDir, runId)
const submissionPath = join(outDir, 'submission.json')
const reportPath = join(outDir, 'report.json')
const runManifestPath = join(outDir, 'run-manifest.json')

const answers = []
const missing = []
for (const task of suite.tasks) {
  const answerPath = join(answersRoot, task.task_id, 'answer.json')
  if (!existsSync(answerPath)) {
    missing.push(relative(root, answerPath))
    continue
  }
  answers.push(readJson(answerPath))
}
if (missing.length > 0) throw new Error(`Missing answer files:\n${missing.slice(0, 20).join('\n')}${missing.length > 20 ? '\n...' : ''}`)

const submission = {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  system_id: runId,
  agent_surface: agentSurface,
  model,
  model_version: modelVersion,
  fixture: false,
  hidden_gold_access: false,
  answers,
}
writeJson(submissionPath, submission)

const result = spawnSync(
  process.execPath,
  [
    'scripts/hard-grounded-research-agentic-v5-evaluate.mjs',
    `--submission=${relative(root, submissionPath)}`,
    `--report=${relative(root, reportPath)}`,
  ],
  { cwd: root, stdio: 'inherit' },
)
if (result.status !== 0) throw new Error(`v5 evaluation failed with status ${result.status}`)

writeJson(runManifestPath, {
  benchmark_id: suite.benchmark_id,
  suite_id: suite.suite_id,
  run_id: runId,
  agent_surface: agentSurface,
  model,
  model_version: modelVersion,
  inference_date: new Date().toISOString(),
  frontier_model_attestation: frontierModelAttestation,
  evaluation_source: suite.suite_id,
  task_count: suite.task_count,
  tools_enabled: toolsEnabled,
  hidden_gold_access: false,
  single_call_packet_run: false,
  answers_root: relative(root, answersRoot),
  submission_path: relative(root, submissionPath),
  scored_report_path: relative(root, reportPath),
  command_transcript_path: transcriptPath,
})

console.log(`Wrote ${relative(root, submissionPath)}`)
console.log(`Wrote ${relative(root, reportPath)}`)
console.log(`Wrote ${relative(root, runManifestPath)}`)
