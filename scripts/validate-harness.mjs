import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

const requiredDocs = [
  'AGENTS.md',
  'ARCHITECTURE.md',
  'docs/product/dashboard.md',
  'docs/control-plane.md',
  'docs/remote-agent-runner.md',
  'docs/observability.md',
  'docs/run-lifecycle.md',
  'docs/quality.md',
  'docs/dashboard-journey-eval.md',
  'docs/exec-plans/active/harness-engineering-foundation.md',
]

const requiredPackageScripts = [
  'build',
  'test',
  'test:harness',
  'test:infra',
  'smoke:infra:live',
  'qa:dashboard',
  'journey:dashboard:capture',
  'journey:dashboard:judge',
  'journey:dashboard:remediate',
  'cf:deploy:preview',
]

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

for (const doc of requiredDocs) {
  assert(existsSync(join(root, doc)), `Missing harness document: ${doc}`)
}

const packageJson = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
for (const script of requiredPackageScripts) {
  assert(packageJson.scripts?.[script], `Missing package script: ${script}`)
}

const appSource = readFileSync(join(root, 'src/App.tsx'), 'utf8')
assert(appSource.includes('isHarnessMode'), 'Dashboard is not wired to harness mode.')
assert(appSource.includes('harnessDatasets'), 'Dashboard does not expose harness datasets.')

const harnessSource = readFileSync(join(root, 'src/harness-data.ts'), 'utf8')
for (const token of [
  'harnessDatasets',
  'harnessRuns',
  'harnessSessions',
  'getHarnessRunResults',
  'getHarnessDebugView',
]) {
  assert(harnessSource.includes(token), `Missing harness export: ${token}`)
}

const controlPlaneSource = readFileSync(join(root, 'src/control-plane.ts'), 'utf8')
assert(controlPlaneSource.includes('/debug-view'), 'Run debug endpoint is missing.')
assert(controlPlaneSource.includes('/assistant-sessions/') && controlPlaneSource.includes('latestError'), 'Session debug endpoint is missing.')
assert(
  controlPlaneSource.includes('UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?'),
  'Failed environment launches must update dataset deployment/status.',
)
assert(
  controlPlaneSource.includes('launchModalResearchJob') &&
    controlPlaneSource.includes('Submitting remote agent job to Modal.'),
  'Control plane must submit remote runs through Modal.',
)
assert(existsSync(join(root, 'scripts/validate-infrastructure-contract.mjs')), 'Missing infrastructure contract validation script.')
assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')

const remoteRunnerSource = readFileSync(join(root, 'src/remote-agent-runner-script.ts'), 'utf8')
for (const token of [
  'collect_deliverable_paths',
  'expected_primary_artifact_name',
  'bookkeeping artifacts do not count as completion',
  'Remote agent run completed without required primary artifact',
  'deliverable artifact(s)',
  'OPENAI_PROXY_BASE_URL',
  'alpha-research-openai',
  'wire_api',
  'supports_websockets=false',
  'remote Codex runs must use the metered OpenAI proxy',
]) {
  assert(remoteRunnerSource.includes(token), `Remote runner completion guard is missing: ${token}`)
}

const workerSource = readFileSync(join(root, 'src/worker.ts'), 'utf8')
assert(
  workerSource.includes('proxyRemoteOpenAIRequest') &&
    workerSource.includes('remote_codex_runner') &&
    workerSource.includes('remote_codex_metering_failed'),
  'Worker must meter remote Codex OpenAI traffic before returning successful model responses.',
)
assert(workerSource.includes('async function datasetContentsForPrompt'), 'Assistant is missing dataset prompt context helper.')
assert(
  workerSource.includes('Dataset context files:') &&
    workerSource.includes('dataset_briefing_markdown') &&
    workerSource.includes('dataset_profile_json') &&
    workerSource.includes('dataset_schema_json') &&
    workerSource.includes('dataset_sample_rows_json'),
  'Assistant dataset prompt context must include briefing/profile/schema/sample sections.',
)
assert(
  workerSource.includes('Use the dataset context above before asking the user for schema, coverage, field availability, briefing, or dataset identity details.'),
  'Assistant prompt must tell the model not to ask for dataset facts already present in prompt context.',
)
assert(workerSource.includes("name: 'plan_remote_run'"), 'Assistant is missing the remote run planning tool.')
assert(
  workerSource.includes('Write a prompt for a remote Alpha Research run based on this chat history.'),
  'Remote run planner must generate prompts from plain-text chat history.',
)
assert(
  workerSource.includes("content !== 'Calling plan_remote_run'"),
  'Remote run planner should use stored chat history without its own tool-call entry.',
)
assert(
  !workerSource.includes('MODEL_HIDDEN_RESEARCH_AGENT_TOOLS'),
  'Hidden duplicate remote execution tools should be deleted instead of filtered out.',
)
assert(
  !workerSource.includes("name: 'fetch_public_data'") &&
    !workerSource.includes("name: 'query_remote_dataset'") &&
    !workerSource.includes("name: 'aggregate_remote_dataset'") &&
    !workerSource.includes("name: 'start_remote_agent_run'") &&
    !workerSource.includes("name: 'run_remote_transformation'") &&
    !workerSource.includes("name: 'run_remote_labeling'"),
  'Duplicate remote execution tools must not be registered as assistant tools.',
)

const dashboardJourneySource = readFileSync(join(root, 'scripts/dashboard-journeys.mjs'), 'utf8')
for (const token of [
  'DASHBOARD_JOURNEYS',
  'Dashboard Orientation',
  'Dataset Inventory',
  'Completed Run Transcript And Artifacts',
  'User Mind',
  'Choose The Right Dataset',
  'Mobile Run Check-In',
  'Public Homepage Product Understanding',
  'Privacy And Trust Before Data Use',
]) {
  assert(dashboardJourneySource.includes(token), `Missing dashboard journey coverage: ${token}`)
}

for (const script of [
  'scripts/dashboard-journey-capture.mjs',
  'scripts/dashboard-journey-judge.mjs',
  'scripts/dashboard-journey-report.mjs',
  'scripts/dashboard-journey-remediate.mjs',
]) {
  assert(existsSync(join(root, script)), `Missing dashboard journey script: ${script}`)
}

console.log('Harness contract validation passed.')
