import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

const controlPlaneSource = read('src/control-plane.ts')
const modalSource = read('src/modal.ts')
const modalWorkerSource = read('modal_workers/agent_worker.py')
const remoteRunnerSource = read('scripts/run_remote_agent.py')
const runnerDocs = read('docs/control-plane.md')
const workerSource = read('src/worker.ts')

const retiredProviderName = ['Digital', 'Ocean'].join('')
const retiredProviderEnvPrefix = retiredProviderName.toUpperCase()
const retiredProviderModuleName = retiredProviderName.toLowerCase()
const retiredCliName = ['do', 'ctl'].join('')
const retiredPoolPath = ['runner', 'pool'].join('-')
const retiredMachineName = ['drop', 'let'].join('')

for (const forbidden of [
  retiredProviderName,
  retiredProviderEnvPrefix,
  retiredProviderModuleName,
  retiredCliName,
  retiredPoolPath,
  retiredMachineName,
]) {
  assert(!controlPlaneSource.includes(forbidden), `Control plane still references retired provider term: ${forbidden}`)
  assert(!workerSource.includes(forbidden), `Worker still references retired provider term: ${forbidden}`)
}

assert(
  controlPlaneSource.includes('launchModalResearchJob') &&
    controlPlaneSource.includes('Submitting remote agent job to Modal.') &&
    controlPlaneSource.includes('Preparing Modal agent job.'),
  'Control plane must launch remote runs through Modal.',
)

assert(
  controlPlaneSource.includes('datasetReadOnly: true') &&
    controlPlaneSource.includes('datasetReadOnly: false') &&
    controlPlaneSource.includes('/data/datasets/'),
  'Control plane must distinguish read-only analysis jobs from writable dataset jobs on the Modal dataset mount.',
)

assert(
  workerSource.includes('/api/admin/canonical-datasets/bootstrap') &&
    workerSource.includes('/api/admin/subscriptions/grant') &&
    workerSource.includes('ALPHA_RESEARCH_ADMIN_TOKEN') &&
    controlPlaneSource.includes('/admin/canonical-datasets/bootstrap') &&
    controlPlaneSource.includes('/subscriptions') &&
    controlPlaneSource.includes("jobKind: 'canonical-dataset-bootstrap'") &&
    controlPlaneSource.includes('userSessionRequired: false') &&
    controlPlaneSource.includes('PLATFORM_DATASET_OWNER_EMAIL'),
  'Admin canonical dataset bootstrap and subscription grant endpoints must be authenticated and routed through the control plane.',
)

assert(
  controlPlaneSource.includes('canonicalWriteRequested') &&
    controlPlaneSource.includes("resources.datasetAccess === 'write-version'") &&
    controlPlaneSource.includes('datasetReadOnly: !canonicalWriteRequested'),
  'Admin remote-agent canonical write executions must launch writable Modal dataset jobs.',
)

assert(
  controlPlaneSource.includes('canOwnerRunDataset') &&
    controlPlaneSource.includes("dataset.mode === 'canonical_public'") &&
    controlPlaneSource.includes('!this.canOwnerRunDataset(dataset, ownerEmail)'),
  'Canonical public datasets must be runnable by authenticated users, not only by the platform owner.',
)

assert(
  controlPlaneSource.includes('/artifacts') && controlPlaneSource.includes('/events') && controlPlaneSource.includes('/status'),
  'Runner event, status, and artifact callback endpoints must remain wired.',
)

for (const token of [
  'MODAL_AGENT_ENDPOINT_URL',
  'MODAL_AGENT_SUBMIT_TOKEN',
  'callbackEventsUrl',
  'callbackStatusUrl',
  'callbackArtifactsUrl',
  'callbackSessionEntriesUrl',
  'openAIProxyBaseUrl',
]) {
  assert(modalSource.includes(token), `Modal provider contract is missing ${token}.`)
}

for (const token of [
  'Volume.from_name(DATASET_VOLUME_NAME',
  'Volume.from_name(RESULTS_VOLUME_NAME',
  'CANONICAL_SLACK_SECRET_NAME',
  'dataset_volume.read_only()',
  '"/data"',
  '"/results"',
  '"/workspace"',
  'Secret.from_name(SECRET_NAME)',
  'Secret.from_name(CANONICAL_SLACK_SECRET_NAME)',
  'OPENAI_PROXY_BASE_URL',
  'run_codex_job',
  'run_dataset_job',
  'submit_codex_job',
]) {
  assert(modalWorkerSource.includes(token), `Modal worker contract is missing ${token}.`)
}

assert(
  remoteRunnerSource.includes('RUN_STATE_DIR = Path(os.environ.get("RUN_STATE_DIR"') &&
    remoteRunnerSource.includes('RUN_STATUS_PATH = Path(os.environ.get("RUN_STATUS_PATH"') &&
    remoteRunnerSource.includes('DATASET_READ_ONLY'),
  'Remote runner must support Modal state paths and read-only dataset prompts.',
)

assert(
  workerSource.includes('/openai') &&
    workerSource.includes('normalizeOpenAIProxyPath') &&
    workerSource.includes('remote_codex_runner') &&
    workerSource.includes('remote_codex_metering_failed') &&
    workerSource.includes('billing-check') &&
    workerSource.includes('billing-events') &&
    controlPlaneSource.includes('/billing-events') &&
    controlPlaneSource.includes('this.billingOverviewForRun(run)') &&
    controlPlaneSource.includes('canonical-dataset-bootstrap') &&
    controlPlaneSource.includes('PLATFORM_DATASET_OWNER_EMAIL'),
  'Remote Codex OpenAI traffic must be proxied and billed against the run owner or service-owned run allowance.',
)

assert(
  modalSource.includes('/openai/v1') &&
    runnerDocs.includes('/api/internal/runs/:runId/openai/v1/*'),
  'Remote Codex OpenAI proxy base URL must include /v1 so Codex reaches OpenAI-compatible endpoints.',
)

assert(
  remoteRunnerSource.includes('OPENAI_PROXY_BASE_URL') &&
    remoteRunnerSource.includes('model_provider="alpha-research-openai"') &&
    remoteRunnerSource.includes('wire_api="responses"') &&
    remoteRunnerSource.includes('supports_websockets=false') &&
    remoteRunnerSource.includes('CODEX_API_KEY') &&
    remoteRunnerSource.includes('Missing OPENAI_PROXY_BASE_URL'),
  'Remote runner must fail closed and point Codex at the metered OpenAI proxy over HTTP Responses.',
)

assert(
  remoteRunnerSource.includes('RUN_TYPE == "canonical-dataset-bootstrap"') &&
    remoteRunnerSource.includes('dataset_briefing.md') &&
    remoteRunnerSource.includes('Do not write report.html unless it is explicitly requested'),
  'Remote runner must treat canonical dataset bootstrap as a dataset-maintenance job, not a report.html research run.',
)

assert(
  controlPlaneSource.includes('requestedExecution') &&
    remoteRunnerSource.includes('requested_codex_mode') &&
    remoteRunnerSource.includes('pty.openpty()') &&
    remoteRunnerSource.includes('prompt_envelope_text') &&
    remoteRunnerSource.includes('codex {requested_codex_mode()} failed with exit code'),
  'Canonical bootstrap runner must pass through execution config and support Codex TUI mode.',
)

for (const requiredDocFragment of [
  'Modal jobs mount the shared public dataset volume at `/data`',
  'Modal runner state and outputs are written under `/results/<job id>`',
  'Workers must not write credentials into prompts, logs, artifacts, or mounted volumes',
  'Remote Codex model traffic must go through the metered OpenAI proxy',
  'Admin canonical dataset bootstrap requests and subscription grants are authenticated with `ALPHA_RESEARCH_ADMIN_TOKEN`',
]) {
  assert(runnerDocs.includes(requiredDocFragment), `Control-plane docs are missing: ${requiredDocFragment}`)
}

assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')
assert(existsSync(join(root, 'scripts/submit_modal_job.py')), 'Missing Modal submit helper.')
assert(existsSync(join(root, 'scripts/sync_modal_dataset.py')), 'Missing Modal dataset sync helper.')

console.log('Infrastructure contract validation passed.')
