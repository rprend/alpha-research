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
    await page.getByText('Signed in', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Recent work' }).waitFor({ timeout: 15000 })
    await page.getByText('Chat', { exact: false }).first().waitFor({ timeout: 15000 })
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
  await assertRenderedDatasetDetail()
  console.log(`Dashboard harness smoke passed at ${baseUrl}`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  child.kill('SIGTERM')
}
