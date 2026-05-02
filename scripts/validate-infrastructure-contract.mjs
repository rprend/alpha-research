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
  controlPlaneSource.includes('/artifacts') && controlPlaneSource.includes('/events') && controlPlaneSource.includes('/status'),
  'Runner event, status, and artifact callback endpoints must remain wired.',
)

assert(
  digitalOceanSource.includes('CANONICAL_DATASET_SLACK_WEBHOOK_URL=${shellEscape') &&
    digitalOceanSource.includes('EXA_API_KEY=${shellEscape'),
  'Remote runner must forward Exa and canonical Slack webhook secrets to dataset-improvement jobs.',
)

for (const requiredDocFragment of [
  'For `storageMode: "object-store-versioned"`',
  'Canonical public and standard analysis profiles must not resize the dataset volume',
  'Failed public/research environment launches must move the dataset to `failed`',
]) {
  assert(runnerDocs.includes(requiredDocFragment), `Control-plane docs are missing: ${requiredDocFragment}`)
}

assert(existsSync(join(root, 'scripts/live-infrastructure-smoke.mjs')), 'Missing live infrastructure smoke script.')

console.log('Infrastructure contract validation passed.')
