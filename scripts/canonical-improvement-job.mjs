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

const sessionPath = join(process.env.HOME ?? '', '.research', 'session.json')
const dryRun = process.argv.includes('--dry-run')
const skipSlackVerify = process.argv.includes('--skip-slack-verify')

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

function listWorkerSecretNames() {
  const output = execFileSync('pnpm', ['wrangler', 'secret', 'list'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const parsed = JSON.parse(output)
  assert(Array.isArray(parsed), 'Wrangler secret list did not return an array.')
  return new Set(parsed.map((item) => item?.name).filter((name) => typeof name === 'string'))
}

async function api(session, path, init = {}) {
  const response = await fetch(`${session.origin}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.accessToken}`,
      ...(init.headers ?? {}),
    },
  })
  const body = await response.json().catch(() => ({}))
  assert(response.ok, `API ${path} failed (${response.status}): ${JSON.stringify(body)}`)
  return body
}

function isReadyDataset(dataset) {
  return dataset
    && dataset.status === 'ready'
    && dataset.deploymentStatus === 'ready'
    && !dataset.activeRunId
    && typeof dataset.manifestPath === 'string'
    && dataset.manifestPath.endsWith('/manifest.json')
}

function datasetSkipReason(dataset) {
  if (!dataset) return 'dataset is missing from the live catalog'
  if (dataset.status !== 'ready') return `dataset status is ${dataset.status}`
  if (dataset.deploymentStatus !== 'ready') return `deployment status is ${dataset.deploymentStatus}`
  if (dataset.activeRunId) return `dataset has active run ${dataset.activeRunId}`
  if (!String(dataset.manifestPath ?? '').endsWith('/manifest.json')) return 'dataset manifest path is missing or invalid'
  return 'dataset is ready'
}

async function verifyExa() {
  const apiKey = process.env.EXA_API_KEY
  if (!apiKey) {
    return { ok: false, detail: 'EXA_API_KEY is not present in the local environment.' }
  }
  const response = await fetch('https://api.exa.ai/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      query: 'Alpha Research canonical dataset improvement setup verification',
      numResults: 1,
    }),
  })
  if (!response.ok) {
    return { ok: false, detail: `Exa search returned HTTP ${response.status}.` }
  }
  const payload = await response.json().catch(() => ({}))
  const count = Array.isArray(payload.results) ? payload.results.length : 0
  return { ok: true, detail: `Exa search returned ${count} result${count === 1 ? '' : 's'}.` }
}

async function verifySlack() {
  const webhookUrl = process.env.CANONICAL_DATASET_SLACK_WEBHOOK_URL
  if (!webhookUrl) {
    return { ok: false, detail: 'CANONICAL_DATASET_SLACK_WEBHOOK_URL is not present in the local environment.' }
  }
  if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
    return { ok: false, detail: 'Slack webhook URL is not a hooks.slack.com URL.' }
  }
  if (skipSlackVerify || dryRun) {
    return { ok: true, detail: dryRun ? 'Slack webhook URL shape verified; POST skipped during dry run.' : 'Slack POST skipped by flag.' }
  }
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: `Canonical dataset improvement setup verification from alpha-research at ${new Date().toISOString()}.`,
    }),
  })
  if (!response.ok) {
    return { ok: false, detail: `Slack webhook returned HTTP ${response.status}.` }
  }
  const text = await response.text()
  return { ok: text.trim() === 'ok', detail: `Slack webhook responded ${JSON.stringify(text.trim())}.` }
}

function buildPrompt(dataset) {
  return [
    `Improve the canonical Alpha Research dataset "${dataset.name}" (${dataset.id}).`,
    '',
    'This is the canonical dataset self-improvement proof job.',
    'Use the mounted dataset and manifest to identify one concrete, low-risk improvement to the dataset documentation, provenance notes, schema profile, source freshness notes, or validation checks.',
    'If web research is needed, use the EXA_API_KEY environment variable without printing it.',
    'If notifying Slack is appropriate, use CANONICAL_DATASET_SLACK_WEBHOOK_URL without printing it.',
    'Do not expose secrets in logs, artifacts, prompts, summaries, commands, or files.',
    '',
    'Required artifact files:',
    '- summary.md with the selected improvement, what evidence was inspected, whether Exa was usable, whether Slack notification was attempted, and any exact skip reason.',
    '- result.json with datasetId, improvementType, exaVerified, slackVerifiedOrSkipped, changedFiles, and followUp.',
    '',
    'Keep the proof bounded: do not rewrite large dataset files, do not start nested agents, and prefer documentation/profile improvements over heavy transforms.',
  ].join('\n')
}

const session = readSession()
const secretNames = listWorkerSecretNames()
const requiredSecrets = ['EXA_API_KEY', 'CANONICAL_DATASET_SLACK_WEBHOOK_URL']
const missingWorkerSecrets = requiredSecrets.filter((name) => !secretNames.has(name))
assert(missingWorkerSecrets.length === 0, `Missing worker secrets: ${missingWorkerSecrets.join(', ')}`)

const [exaCheck, slackCheck] = await Promise.all([verifyExa(), verifySlack()])
assert(exaCheck.ok, exaCheck.detail)
assert(slackCheck.ok, slackCheck.detail)

const datasetPayload = await api(session, '/api/cli/datasets')
const datasets = datasetPayload.datasets ?? []
const datasetById = new Map(datasets.map((dataset) => [dataset.id, dataset]))
const selectedDataset = canonicalDatasetIds.map((id) => datasetById.get(id)).find(isReadyDataset)

if (!selectedDataset) {
  const skipReasons = canonicalDatasetIds.map((id) => ({
    datasetId: id,
    reason: datasetSkipReason(datasetById.get(id)),
  }))
  console.log(JSON.stringify({
    ok: true,
    dryRun,
    started: false,
    skipReason: 'No ready canonical dataset without an active run was available.',
    workerSecretsPresent: requiredSecrets,
    capabilityChecks: { exa: exaCheck.detail, slack: slackCheck.detail },
    datasets: skipReasons,
  }, null, 2))
  process.exit(0)
}

const requestBody = {
  type: 'agent',
  prompt: buildPrompt(selectedDataset),
  artifacts: [
    { type: 'markdown', title: 'Canonical Dataset Improvement Summary' },
    { type: 'json', title: 'Canonical Dataset Improvement Result' },
  ],
  config: {
    canonicalDatasetImprovement: true,
    proofRun: true,
    capabilityChecks: {
      exa: exaCheck.detail,
      slack: slackCheck.detail,
    },
  },
}

if (dryRun) {
  console.log(JSON.stringify({
    ok: true,
    dryRun: true,
    started: false,
    selectedDataset: {
      id: selectedDataset.id,
      name: selectedDataset.name,
      status: selectedDataset.status,
      deploymentStatus: selectedDataset.deploymentStatus,
      manifestPath: selectedDataset.manifestPath,
    },
    workerSecretsPresent: requiredSecrets,
    capabilityChecks: { exa: exaCheck.detail, slack: slackCheck.detail },
    wouldPost: {
      path: `/api/cli/datasets/${selectedDataset.id}/runs`,
      type: requestBody.type,
      promptPreview: requestBody.prompt.slice(0, 280),
    },
  }, null, 2))
  process.exit(0)
}

const runPayload = await api(session, `/api/cli/datasets/${encodeURIComponent(selectedDataset.id)}/runs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(requestBody),
})

console.log(JSON.stringify({
  ok: true,
  dryRun: false,
  started: true,
  selectedDataset: {
    id: selectedDataset.id,
    name: selectedDataset.name,
  },
  run: runPayload.run,
  dashboardUrl: `${session.origin.replace('https://alpharesearch.nyc', 'https://dashboard.alpharesearch.nyc')}/runs/${runPayload.run.id}`,
  workerSecretsPresent: requiredSecrets,
  capabilityChecks: { exa: exaCheck.detail, slack: slackCheck.detail },
}, null, 2))
