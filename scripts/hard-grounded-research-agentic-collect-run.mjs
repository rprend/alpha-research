import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const workspacesManifestPath = join(generatedDir, 'agentic-workspaces-manifest.json')
const runsDir = join(experimentDir, 'agentic-runs')

function argValue(name, fallback = null) {
  const prefix = `--${name}=`
  const arg = process.argv.find((value) => value.startsWith(prefix))
  return arg ? arg.slice(prefix.length) : fallback
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function requireArg(name) {
  const value = argValue(name)
  if (!value) {
    throw new Error(`Missing required --${name}=...`)
  }
  return value
}

const runId = requireArg('run-id')
const agentSurface = requireArg('agent-surface')
const model = requireArg('model')
const modelVersion = argValue('model-version', model)
const frontierModelAttestation = requireArg('frontier-model-attestation')
const transcriptPath = requireArg('transcript')
const toolsEnabled = argValue('tools', 'shell,filesystem,search')
  .split(',')
  .map((tool) => tool.trim())
  .filter(Boolean)
const answersRootArg = argValue('answers-root', 'docs/experiments/hard-grounded-research-benchmark/generated/agentic-workspaces')
const answersRoot = isAbsolute(answersRootArg) ? answersRootArg : join(root, answersRootArg)
const manifest = readJson(workspacesManifestPath)
const outDir = join(runsDir, runId)
const submissionPath = join(outDir, 'submission.json')
const reportPath = join(outDir, 'report.json')
const runManifestPath = join(outDir, 'run-manifest.json')

const answers = []
const missing = []
for (const task of manifest.tasks) {
  const answerPath = join(answersRoot, task.task_id, 'answer.json')
  if (!existsSync(answerPath)) {
    missing.push(relative(root, answerPath))
    continue
  }
  answers.push(readJson(answerPath))
}

if (missing.length > 0) {
  throw new Error(`Missing answer files:\n${missing.join('\n')}`)
}

const submission = {
  benchmark_id: manifest.benchmark_id,
  suite_id: manifest.suite_id,
  system_id: runId,
  agent_surface: agentSurface,
  model,
  model_version: modelVersion,
  fixture: false,
  hidden_gold_access: false,
  answers,
}

writeJson(submissionPath, submission)

const evaluateArgs = [
  'scripts/hard-grounded-research-agentic-evaluate.mjs',
  `--submission=${relative(root, submissionPath)}`,
  `--report=${relative(root, reportPath)}`,
]
const { spawnSync } = await import('node:child_process')
const result = spawnSync(process.execPath, evaluateArgs, {
  cwd: root,
  stdio: 'inherit',
})
if (result.status !== 0) {
  throw new Error(`Agentic evaluation failed with status ${result.status}`)
}

const runManifest = {
  benchmark_id: manifest.benchmark_id,
  suite_id: manifest.suite_id,
  run_id: runId,
  agent_surface: agentSurface,
  model,
  model_version: modelVersion,
  inference_date: new Date().toISOString(),
  frontier_model_attestation: frontierModelAttestation,
  evaluation_source: manifest.suite_id,
  task_count: manifest.task_count,
  tools_enabled: toolsEnabled,
  hidden_gold_access: false,
  single_call_packet_run: false,
  answers_root: relative(root, answersRoot),
  submission_path: relative(root, submissionPath),
  scored_report_path: relative(root, reportPath),
  command_transcript_path: transcriptPath,
}

writeJson(runManifestPath, runManifest)
console.log(`Wrote ${relative(root, submissionPath)}`)
console.log(`Wrote ${relative(root, reportPath)}`)
console.log(`Wrote ${relative(root, runManifestPath)}`)
