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
    await page.getByRole('heading', { name: 'Draft a research plan before you run anything.' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Draft a plan' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Browse datasets' }).waitFor({ timeout: 15000 })
    await page.getByText('You can start here without CLI setup.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Recommended plan', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Before running anything expensive' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Launch a well-specified run' }).waitFor({ timeout: 15000 })
    await page.getByText('Run launch expectations', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Use complete spec' }).waitFor({ timeout: 15000 })
    await page.getByText('Operational choices to confirm', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Sample data ready:', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Is the housing market in trouble? Turn that into a concrete plan using City Housing Archive.' }).waitFor({ timeout: 15000 })
    await page.getByText('Signed in', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Show recent chats (2)' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Remote session', { exact: false }).first().isVisible().catch(() => false)) {
      throw new Error('First signed-in landing should not foreground recent session rows before the user opens recent work.')
    }
  } finally {
    await browser.close()
  }
}

async function assertWellSpecifiedRunLaunch() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=assistant`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Launch a well-specified run' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Use complete spec' }).click()
    await page.getByLabel('Message input').evaluate((node) => {
      if (!(node instanceof HTMLTextAreaElement)) {
        throw new Error('Expected message input to be a textarea.')
      }
      if (!node.value.includes('Dataset: City Housing Archive')) {
        throw new Error(`Prepared spec was not inserted into the composer: ${node.value}`)
      }
    })
    await page.getByLabel('Send message').click()
    await page.getByText('run-harness-specified', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Running', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Executive Summary, Cohort Comparison Table, Spec Preservation Record', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('The durable answer files stay attached to this run.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('The runner preserved the launch specification and is checking the requested fields against the dataset schema before analysis starts.', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRenderedDatasetInventory() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Datasets', exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Your datasets', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Public datasets', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Ready for research', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Still building', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('View dataset details', { exact: true }).first().waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertTopicGuidedDatasetSelection() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&topic=housing-affordability`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Datasets', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Best datasets for Housing Affordability', exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Recommended next step', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Open City Housing Archive', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Coverage:', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Freshness:', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Limitation:', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Relevant to Housing Affordability', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open recommended dataset' }).click()
    await page.getByRole('heading', { name: 'City Housing Archive' }).waitFor({ timeout: 15000 })
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
    await page.getByText('Project Gutenberg book metadata with title, author, year, and normalized text references.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Trust summary', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Validated', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('75,000 rows and 4 required fields are present in the current profile.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Caveat', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('This is a curated sample for fast exploration, not a full-corpus source of record.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Sample rows' }).waitFor({ timeout: 15000 })
    await page.getByText('Pride and Prejudice', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Ask about this dataset', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Ask about Alpha Book Sample' }).waitFor({ timeout: 15000 })
    await page.getByText('do not need to copy a dataset id', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('clarify scope', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Refresh briefing' }).waitFor({ timeout: 15000 })
    await page.getByText('Developer details', { exact: true }).waitFor({ timeout: 15000 })
    if (await page.getByText('harness QA', { exact: false }).count()) {
      throw new Error('Dataset detail should not surface harness QA wording in the trust path.')
    }
    if (await page.getByText('Alpha Book research planning', { exact: true }).count()) {
      throw new Error('Dataset detail should not show unrelated chat history in the primary sidebar.')
    }
  } finally {
    await browser.close()
  }
}

async function assertDatasetFreshnessSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&datasetId=dataset-alpha-econ`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Alpha Econ Prototype' }).waitFor({ timeout: 15000 })
    await page.getByText('Not ready', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Not ready for analysis yet.' }).waitFor({ timeout: 15000 })
    await page.getByText('Source coverage', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Freshness and deployment', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Known gaps', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Briefing status', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Deployed dataset files are not mounted yet.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('No briefing yet because the dataset is not ready enough to describe.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('The deployed dataset files are not mounted yet, so the briefing and analysis remain blocked.', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Describe dataset' }).waitFor({ timeout: 15000 })
    await page.getByText('No dataset briefing is available yet.', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertDatasetScopedAskRouting() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&datasetId=dataset-alpha-book`, { waitUntil: 'domcontentloaded' })
    await page.getByLabel('Your research question').fill('Which authors look most useful to compare first?')
    await page.getByRole('button', { name: 'Ask about Alpha Book Sample' }).click()
    await page.getByRole('heading', { name: 'Ask about Alpha Book Sample' }).waitFor({ timeout: 15000 })
    await page.getByText('already attached to this chat', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('clarify broad requests before it launches any expensive work', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByLabel('Message input').waitFor({ timeout: 15000 })
    await page.getByLabel('Message input').evaluate((node) => {
      if (!(node instanceof HTMLTextAreaElement)) {
        throw new Error('Expected message input to be a textarea.')
      }
      if (node.value !== 'Which authors look most useful to compare first?') {
        throw new Error(`Unexpected draft value: ${node.value}`)
      }
    })
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
    await page.getByRole('button', { name: 'Open briefing artifact' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open profile artifact' }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertCompletedRunArtifactsSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-completed`, { waitUntil: 'domcontentloaded' })
    const runSummary = page.getByRole('heading', { name: 'Run summary' }).locator('xpath=ancestor::section[1]')
    await runSummary.waitFor({ timeout: 15000 })
    await runSummary.getByText('Original prompt', { exact: true }).waitFor({ timeout: 15000 })
    await runSummary.getByText('Describe the Alpha Book sample and identify research-ready fields.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Requested artifacts', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Produced artifacts', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Requested vs produced', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Produced as summary.md.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Produced as result.json.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Timeline evidence', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Latest recorded event', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Run finished' }).waitFor({ timeout: 15000 })
    await page.getByText('Read summary.md for the answer first.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Primary result', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('summary.md', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open answer' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open artifacts (3)' }).first().click()
    const artifactsPanel = page.getByLabel('Run artifacts')
    await artifactsPanel.getByText('Results and artifacts', { exact: true }).waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Original request', { exact: true }).waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Describe the Alpha Book sample and identify research-ready fields.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Final outputs', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'summary.md' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'result.json' }).waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Supporting files', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'scripts/inspect_manifest.py' }).waitFor({ timeout: 15000 })
    await page.getByText('Available as result.json.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Canonical answer to the run request. Read this first.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Machine-readable companion with the durable result data.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('How to use this file', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Download' }).waitFor({ timeout: 15000 })
    await page.getByText('Branch 2 of 2', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRunningRunStatusSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-running`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Run is alive' }).waitFor({ timeout: 15000 })
    await page.getByText('Current phase', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Last heartbeat', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('The runner is fetching public data sources and assembling the housing and labor environment.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Auto-refreshing every 5 seconds', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('You do not need to refresh this page manually.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Safe to leave this open while the run continues.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Show run details' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Run id', { exact: true }).count()) {
      throw new Error('Running run detail should not foreground run metadata while the user is waiting on live work.')
    }
  } finally {
    await browser.close()
  }
}

async function assertResumeLastResearchThread() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=assistant&sessionId=session-harness-cli`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Continue last thread', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Alpha Book research planning' }).waitFor({ timeout: 15000 })
    await page.getByText('Last active', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Research target', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Alpha Book Sample', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Linked run', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Describe for Alpha Book Sample', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('4 saved outputs', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Session recap', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('The corpus is ready for search, literary classification, and provenance-aware sampling.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open linked run' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open briefing artifact' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Ask a follow-up' }).waitFor({ timeout: 15000 })
    await page.getByText('Most recent', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('About Alpha Book Sample · Transcript complete', { exact: false }).first().waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertStuckRunSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-failed`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Worker lost connection' }).waitFor({ timeout: 15000 })
    await page.getByText('The worker stopped responding before it reported whether the run finished.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What completed', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('No requested outputs completed', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What is missing', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset Briefing, Dataset Profile', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Can you trust saved output?', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('No durable output was saved before the worker lost contact.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Retry in chat' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open debug evidence' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open artifacts' }).click()
    await page.getByText('This run did not save any durable files. Expected outputs stay listed so you can see what was lost.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('2 expected outputs missing', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset Briefing', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset Profile', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('No recoverable files were saved for this run.', { exact: true }).waitFor({ timeout: 15000 })
    if (await page.getByText('CLI orchestration session initialized.', { exact: true }).count()) {
      throw new Error('Stuck run detail should not lead with CLI orchestration internals.')
    }
    if (await page.getByText('Stored config', { exact: true }).count()) {
      throw new Error('Stuck run detail should not foreground stored config.')
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
    await page.getByText('Latest completed', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Describe the Alpha Book sample and identify research-ready fields.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Worker stopped responding before the run finished.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('4 artifacts ready', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Connection to the worker dropped before a final result was reported.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Inspect recovery' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Inspect outputs' }).waitFor({ timeout: 15000 })
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
    await page.getByRole('heading', { name: 'Alpha Book describe terminal session' }).waitFor({ timeout: 15000 })
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
  await assertWellSpecifiedRunLaunch()
  await assertRenderedDatasetInventory()
  await assertTopicGuidedDatasetSelection()
  await assertRenderedEmptyDatasetSetup()
  await assertRenderedDatasetDetail()
  await assertDatasetFreshnessSteering()
  await assertDatasetScopedAskRouting()
  await assertDescribeRunSteering()
  await assertCompletedRunArtifactsSteering()
  await assertRunningRunStatusSteering()
  await assertResumeLastResearchThread()
  await assertStuckRunSteering()
  await assertRenderedRunsInventory()
  await assertTerminalSessionContinuity()
  console.log(`Dashboard harness smoke passed at ${baseUrl}`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  child.kill('SIGTERM')
}
