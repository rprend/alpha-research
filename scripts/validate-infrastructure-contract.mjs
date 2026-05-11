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
]) {
  assert(modalSource.includes(token), `Modal provider contract is missing ${token}.`)
}

for (const token of [
  'Volume.from_name(DATASET_VOLUME_NAME',
  'Volume.from_name(RESULTS_VOLUME_NAME',
  'dataset_volume.read_only()',
  '"/data"',
  '"/results"',
  '"/workspace"',
  'Secret.from_name(SECRET_NAME)',
  'OPENAI_API_KEY',
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

for (const requiredDocFragment of [
  'Modal jobs mount the shared public dataset volume at `/data`',
  'Modal runner state and outputs are written under `/results/<job id>`',
  'Workers must not write credentials into prompts, logs, artifacts, or mounted volumes',
]) {
  assert(runnerDocs.includes(requiredDocFragment), `Control-plane docs are missing: ${requiredDocFragment}`)
}

assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')
assert(existsSync(join(root, 'scripts/submit_modal_job.py')), 'Missing Modal submit helper.')
assert(existsSync(join(root, 'scripts/sync_modal_dataset.py')), 'Missing Modal dataset sync helper.')

console.log('Infrastructure contract validation passed.')
