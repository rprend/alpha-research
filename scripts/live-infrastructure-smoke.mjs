import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const canonicalDatasetIds = [
  'econ',
  'sociology',
  'philosophy',
  'history',
  'literature',
  'political-science',
  'anthropology',
  'linguistics',
  'classics',
]

const legacyLargeVolumeAllowlist = new Set(['econ'])
const sessionPath = join(process.env.HOME ?? '', '.research', 'session.json')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

function readSession() {
  assert(existsSync(sessionPath), `Missing RESEARCH CLI session at ${sessionPath}`)
  const session = JSON.parse(readFileSync(sessionPath, 'utf8'))
  assert(typeof session.origin === 'string' && session.origin.startsWith('https://'), 'Session origin is missing or invalid.')
  assert(typeof session.accessToken === 'string' && session.accessToken.length > 0, 'Session access token is missing.')
  return session
}

async function api(session, path) {
  const response = await fetch(`${session.origin}${path}`, {
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
    },
  })
  const body = await response.json().catch(() => ({}))
  assert(response.ok, `API ${path} failed (${response.status}): ${JSON.stringify(body)}`)
  return body
}

function listVolumes() {
  const output = execFileSync('doctl', ['compute', 'volume', 'list', '--output', 'json'], {
    encoding: 'utf8',
  })
  return JSON.parse(output)
}

function listDroplets() {
  const output = execFileSync('doctl', ['compute', 'droplet', 'list', '--output', 'json'], {
    encoding: 'utf8',
  })
  return JSON.parse(output)
}

function volumeNameForDataset(datasetId) {
  return `ar-dataset-${datasetId}`
}

function isTerminalReady(status) {
  return status === 'ready' || status === 'completed'
}

const session = readSession()
const datasetPayload = await api(session, '/api/cli/datasets')
const datasetById = new Map((datasetPayload.datasets ?? []).map((dataset) => [dataset.id, dataset]))

for (const datasetId of canonicalDatasetIds) {
  const dataset = datasetById.get(datasetId)
  assert(dataset, `Canonical dataset ${datasetId} is missing from the live catalog.`)
  assert(dataset.status === 'ready', `Canonical dataset ${datasetId} is not ready: ${dataset.status}`)
  assert(dataset.deploymentStatus === 'ready', `Canonical dataset ${datasetId} deployment is not ready: ${dataset.deploymentStatus}`)
  assert(!dataset.activeRunId, `Canonical dataset ${datasetId} still has active run ${dataset.activeRunId}.`)
  assert(dataset.manifestPath?.endsWith('/manifest.json'), `Canonical dataset ${datasetId} has invalid manifest path.`)
}

const volumes = listVolumes()
const volumeByName = new Map(volumes.map((volume) => [volume.name, volume]))

for (const datasetId of canonicalDatasetIds) {
  const volume = volumeByName.get(volumeNameForDataset(datasetId))
  assert(volume, `Missing DigitalOcean dataset volume for ${datasetId}.`)
  const size = Number(volume.size_gigabytes)
  if (!legacyLargeVolumeAllowlist.has(datasetId)) {
    assert(size <= 10, `Dataset ${datasetId} should not have been resized above 10GiB; found ${size}GiB.`)
  }
}

const droplets = listDroplets()
const activeEnvironmentRunners = droplets.filter((droplet) =>
  droplet.status !== 'off' &&
  Array.isArray(droplet.tags) &&
  droplet.tags.includes('alpha-research') &&
  droplet.tags.includes('run-environment')
)
assert(activeEnvironmentRunners.length === 0, `Environment runners are still active: ${activeEnvironmentRunners.map((droplet) => droplet.name).join(', ')}`)

const artifactSummary = []
for (const datasetId of canonicalDatasetIds.filter((id) => id !== 'econ')) {
  const runsPayload = await api(session, `/api/cli/runs?datasetId=${encodeURIComponent(datasetId)}`)
  const environmentRun = (runsPayload.runs ?? []).find((run) => run.type === 'environment' && isTerminalReady(run.status))
  assert(environmentRun, `No ready environment run found for ${datasetId}.`)

  const results = await api(session, `/api/cli/runs/${encodeURIComponent(environmentRun.id)}/results`)
  const eventMessages = (results.events ?? []).map((event) => event.message)
  assert(eventMessages.some((message) => message.includes('shared dataset volume resize is skipped')), `${datasetId} run does not prove resize skip.`)
  assert((results.events ?? []).length >= 3, `${datasetId} run did not persist enough run events.`)
  assert((results.artifacts ?? []).length >= 2, `${datasetId} run did not persist expected artifacts.`)
  artifactSummary.push({
    datasetId,
    runId: environmentRun.id,
    events: results.events.length,
    artifacts: results.artifacts.length,
  })
}

console.log(JSON.stringify({
  ok: true,
  checkedDatasets: canonicalDatasetIds.length,
  checkedArtifactRuns: artifactSummary,
  note: 'econ is allowed to retain its legacy 500GiB volume; new canonical datasets must remain <=10GiB.',
}, null, 2))
