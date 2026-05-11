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

const digitalOceanSource = read('src/digitalocean.ts')
const controlPlaneSource = read('src/control-plane.ts')
const modalSource = read('src/modal.ts')
const modalWorkerSource = read('modal_workers/agent_worker.py')
const remoteRunnerSource = read('scripts/run_remote_agent.py')
const runnerDocs = read('docs/control-plane.md')

for (const token of [
  'storageMode?: string',
  'datasetAccess?: string',
  'publishMode?: string',
  'EXA_API_KEY?: string',
  'CANONICAL_DATASET_SLACK_WEBHOOK_URL?: string',
  "resources.storageMode === 'object-store-versioned'",
  "resources.profile !== 'large-ingest'",
  'usesVersionedObjectStoreResources',
]) {
  assert(digitalOceanSource.includes(token), `DigitalOcean resource contract is missing ${token}.`)
}

assert(
  digitalOceanSource.includes('return null') &&
    digitalOceanSource.includes("resources.storageMode === 'object-store-versioned' && resources.profile !== 'large-ingest'"),
  'Object-store canonical/analysis profiles must not request shared dataset volume resize.',
)

assert(
  controlPlaneSource.includes('Using versioned object-store resource policy; shared dataset volume resize is skipped.'),
  'Control plane must persist a run event when shared dataset volume resize is skipped.',
)

assert(
  controlPlaneSource.includes('UPDATE datasets SET deployment_status = ?, status = ?, updated_at = ? WHERE id = ?'),
  'Environment launch failures must mark the dataset failed.',
)

assert(
  controlPlaneSource.includes('this.appendRunEvent(runId, `Remote agent droplet ${droplet.name} launched'),
  'Remote runner launches must append durable run events.',
)

assert(
  controlPlaneSource.includes('REMOTE_AGENT_EXECUTOR') &&
    controlPlaneSource.includes('launchModalResearchJob') &&
    controlPlaneSource.includes('Submitting remote agent job to Modal.'),
  'Control plane must support Modal remote agent launches behind REMOTE_AGENT_EXECUTOR=modal.',
)

assert(
  controlPlaneSource.includes('/artifacts') && controlPlaneSource.includes('/events') && controlPlaneSource.includes('/status'),
  'Runner event, status, and artifact callback endpoints must remain wired.',
)

assert(
  digitalOceanSource.includes('CANONICAL_DATASET_SLACK_WEBHOOK_URL=${shellEscape') &&
    digitalOceanSource.includes('EXA_API_KEY=${shellEscape'),
  'Remote runner must forward Exa and canonical Slack webhook secrets to dataset-improvement jobs.',
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
  'For `storageMode: "object-store-versioned"`',
  'Canonical public and standard analysis profiles must not resize the dataset volume',
  'Failed public/research environment launches must move the dataset to `failed`',
  '`REMOTE_AGENT_EXECUTOR=modal` routes ordinary research runs to the Modal worker provider',
  'Modal runner state and outputs are written under `/results/<job id>`',
]) {
  assert(runnerDocs.includes(requiredDocFragment), `Control-plane docs are missing: ${requiredDocFragment}`)
}

assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')
assert(existsSync(join(root, 'scripts/submit_modal_job.py')), 'Missing Modal submit helper.')
assert(existsSync(join(root, 'scripts/sync_modal_dataset.py')), 'Missing Modal dataset sync helper.')

console.log('Infrastructure contract validation passed.')
