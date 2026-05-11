import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

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

function isTerminalReady(status) {
  return status === 'ready' || status === 'completed'
}

const session = readSession()
const datasetPayload = await api(session, '/api/cli/datasets')
const datasets = datasetPayload.datasets ?? []
assert(datasets.length > 0, 'Live catalog has no datasets.')

for (const dataset of datasets) {
  assert(dataset.status === 'ready', `Dataset ${dataset.id} is not ready: ${dataset.status}`)
  assert(dataset.deploymentStatus === 'ready', `Dataset ${dataset.id} deployment is not ready: ${dataset.deploymentStatus}`)
  assert(!dataset.activeRunId, `Dataset ${dataset.id} still has active run ${dataset.activeRunId}.`)
  assert(dataset.manifestPath?.startsWith('/data/datasets/'), `Dataset ${dataset.id} is not mounted from Modal /data.`)
  assert(dataset.manifestPath?.endsWith('/manifest.json'), `Dataset ${dataset.id} has invalid manifest path.`)
}

const artifactSummary = []
for (const dataset of datasets) {
  const datasetId = dataset.id
  const runsPayload = await api(session, `/api/cli/runs?datasetId=${encodeURIComponent(datasetId)}`)
  const run = (runsPayload.runs ?? []).find((candidate) => isTerminalReady(candidate.status))
  assert(run, `No ready run found for ${datasetId}.`)

  const results = await api(session, `/api/cli/runs/${encodeURIComponent(run.id)}/results`)
  assert((results.events ?? []).length >= 1, `${datasetId} run did not persist run events.`)
  artifactSummary.push({
    datasetId,
    runId: run.id,
    events: results.events.length,
    artifacts: (results.artifacts ?? []).length,
  })
}

console.log(JSON.stringify({
  ok: true,
  checkedDatasets: datasets.length,
  checkedRuns: artifactSummary,
}, null, 2))
