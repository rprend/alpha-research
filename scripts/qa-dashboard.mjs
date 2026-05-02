import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const timeoutMs = Number(process.env.QA_DASHBOARD_TIMEOUT_MS ?? 30_000)
const port = Number(process.env.QA_DASHBOARD_PORT ?? 4173)
const baseUrl = `http://127.0.0.1:${port}`

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${baseUrl}/?harness=1`)
      if (response.ok) {
        return
      }
    } catch {
      // keep polling
    }
    await wait(500)
  }
  throw new Error(`Dashboard preview did not become ready at ${baseUrl}`)
}

async function assertRoute(path, expectedText) {
  const response = await fetch(`${baseUrl}${path}`)
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`)
  }
  const html = await response.text()
  if (!html.includes('<div id="app">')) {
    throw new Error(`GET ${path} did not return the Vite app shell.`)
  }
  if (expectedText && !html.includes(expectedText)) {
    throw new Error(`GET ${path} did not include expected marker: ${expectedText}`)
  }
}

async function assertRenderedOrientation() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=assistant`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Start a new research chat.' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Browse datasets' }).waitFor({ timeout: 15000 })
    await page.getByText('You can start here without CLI setup.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Sample data ready:', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'What can Alpha Research help me do with the data already here?' }).waitFor({ timeout: 15000 })
    await page.getByText('Signed in', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Show recent chats (2)' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Remote session', { exact: false }).first().isVisible().catch(() => false)) {
      throw new Error('First signed-in landing should not foreground recent session rows before the user opens recent work.')
    }
  } finally {
    await browser.close()
  }
}

async function assertRenderedDatasetInventory() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Datasets' }).waitFor({ timeout: 15000 })
    await page.getByText('Your datasets', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Public datasets', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Ready for research', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Still building', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('View dataset details', { exact: true }).first().waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRenderedEmptyDatasetSetup() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&scenario=empty`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Datasets' }).waitFor({ timeout: 15000 })
    await page.getByText('Expected for a new workspace', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Set up your first dataset', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Nothing failed here.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('research datasets create --name "My first dataset"', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open CLI setup' }).waitFor({ timeout: 15000 })
    await page.getByText('A file or source to ingest', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('A short description of what the data covers', { exact: false }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRenderedDatasetDetail() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&datasetId=dataset-alpha-book`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Alpha Book Sample' }).waitFor({ timeout: 15000 })
    await page.getByText('Trust summary', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Source provenance', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Refresh briefing' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Sample rows' }).waitFor({ timeout: 15000 })
    await page.getByText('Developer details', { exact: true }).waitFor({ timeout: 15000 })
    if (await page.getByText('Alpha Book research planning', { exact: true }).count()) {
      throw new Error('Dataset detail should not show unrelated chat history in the primary sidebar.')
    }
  } finally {
    await browser.close()
  }
}

async function assertDescribeRunSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&datasetId=dataset-alpha-book`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Refresh briefing' }).click()
    await page.getByRole('heading', { name: 'Dataset briefing ready' }).waitFor({ timeout: 15000 })
    await page.getByText('The durable briefing stays attached to this run as an artifact', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open briefing artifact' }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset Briefing', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset Profile', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertCompletedRunArtifactsSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-completed`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Run finished' }).waitFor({ timeout: 15000 })
    await page.getByText('Read summary.md for the answer first.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Primary result', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('summary.md', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open answer' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open artifacts (3)' }).first().click()
    await page.getByText('Artifacts', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('User-facing result to read first.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Machine-readable companion for downstream tooling.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Observed progress and transcript', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRunningRunStatusSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-running`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Alpha Econ Prototype is still running' }).waitFor({ timeout: 15000 })
    await page.getByText('The runner is fetching public data sources and assembling the housing and labor environment.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Auto-refreshing every 5 seconds', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('You do not need to refresh this page manually.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Safe to leave this open while the run continues.', { exact: true }).waitFor({ timeout: 15000 })
    if (await page.getByText('Stored config', { exact: true }).count()) {
      throw new Error('Running run detail should not foreground stored config while the user is waiting on live work.')
    }
  } finally {
    await browser.close()
  }
}

async function assertRenderedRunsInventory() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Needs attention', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Running now', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Outputs ready', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Worker stopped responding before the run finished.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('4 artifacts ready', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open recovery path' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open outputs' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Alpha Book research planning', { exact: true }).count()) {
      throw new Error('Runs inventory should de-emphasize the research chat sidebar during triage.')
    }
  } finally {
    await browser.close()
  }
}

async function assertTerminalSessionContinuity() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=terminal-sessions&sessionId=session-harness-remote`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Describe run terminal session' }).waitFor({ timeout: 15000 })
    await page.getByText('Transcript complete', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('This transcript belongs to the Describe run for Alpha Book Sample.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Outputs from this session', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'summary.md' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'result.json' }).waitFor({ timeout: 15000 })
    if (await page.getByText('No terminal session turns yet', { exact: true }).count()) {
      throw new Error('Terminal session detail should not present a dead-end empty-state message.')
    }
  } finally {
    await browser.close()
  }
}

const child = spawn(
  'pnpm',
  ['preview', '--host', '127.0.0.1', '--port', String(port)],
  {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      VITE_ALPHA_RESEARCH_HARNESS: '1',
    },
  },
)

let output = ''
child.stdout.on('data', (chunk) => {
  output += chunk.toString()
})
child.stderr.on('data', (chunk) => {
  output += chunk.toString()
})

try {
  await waitForServer()
  await assertRoute('/?harness=1', '<div id="app">')
  await assertRoute('/?harness=1&view=datasets', '<div id="app">')
  await assertRoute('/?harness=1&view=runs', '<div id="app">')
  await assertRenderedOrientation()
  await assertRenderedDatasetInventory()
  await assertRenderedEmptyDatasetSetup()
  await assertRenderedDatasetDetail()
  await assertDescribeRunSteering()
  await assertCompletedRunArtifactsSteering()
  await assertRunningRunStatusSteering()
  await assertRenderedRunsInventory()
  await assertTerminalSessionContinuity()
  console.log(`Dashboard harness smoke passed at ${baseUrl}`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  child.kill('SIGTERM')
}
