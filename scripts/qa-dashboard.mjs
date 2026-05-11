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

async function assertPageTextMissing(page, forbiddenText, message) {
  const bodyText = await page.locator('body').innerText()
  if (bodyText.includes(forbiddenText)) {
    throw new Error(message ?? `Page unexpectedly displayed "${forbiddenText}".`)
  }
}

async function assertRenderedOrientation() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=assistant`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'What do you want to research?' }).waitFor({ timeout: 15000 })
    await page.locator('img.aui-thread-welcome-image[src="/alpha-book-man.png"]').waitFor({ timeout: 15000 })
    await page.getByPlaceholder('Send a message...').waitFor({ timeout: 15000 })
    await page.getByText('Signed in', { exact: false }).first().waitFor({ timeout: 15000 })
    await page.getByText('Alpha Book research planning', { exact: true }).waitFor({ timeout: 15000 })
    await assertPageTextMissing(page, 'Show recent chats', 'Recent chats should be visible without a disclosure toggle.')
    await assertPageTextMissing(page, 'Hide recent chats', 'Recent chats should be visible without a disclosure toggle.')
    await assertPageTextMissing(page, 'Most recent', 'Recent chat rows should not show recency badges.')
    await assertPageTextMissing(page, 'CLI handoff', 'Recent chat rows should not show CLI handoff metadata.')
    await assertPageTextMissing(page, 'Syncing transcript', 'Recent chat rows should not show transcript sync metadata.')
    await assertPageTextMissing(page, 'function_call_output', 'Recent chat rows should not expose raw tool output.')
  } finally {
    await browser.close()
  }
}

async function assertLandingPageUnderstanding() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Open source, agentic knowledge bases for all of humanity\'s knowledge' }).waitFor({ timeout: 15000 })
    await page.locator('img.hero-figure-image[alt="Illustration for Alpha Research"]').waitFor({ timeout: 15000 })
    await page.getByText('Alpha Research builds open source agentic knowledge bases.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'RResearch' }).first().waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Bring your own dataset' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Want a custom integration? Book a call' }).waitFor({ timeout: 15000 })
    await page.getByText('Powering', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('AlphaEcon', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Knowledge bases allow agents to work like knowledge workers', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Andrej Karpathy', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'When to use Alpha Research' }).waitFor({ timeout: 15000 })
    await assertPageTextMissing(page, 'What it is', 'Landing page should not render the intermediate card-based homepage.')
    await assertPageTextMissing(page, 'Who it is for', 'Landing page should not render the intermediate card-based homepage.')
    await assertPageTextMissing(page, 'Why it matters', 'Landing page should not render the intermediate card-based homepage.')
    await assertPageTextMissing(page, 'What Alpha Research returns', 'Landing page should not render the intermediate workflow card.')
  } finally {
    await browser.close()
  }
}

async function assertCliInstallJourneySteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/cli/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Bring your own dataset' }).waitFor({ timeout: 15000 })
    await page.getByText('exact install command', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Copy install command' }).waitFor({ timeout: 15000 })
    await page.getByText('macOS or Linux terminal', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('git', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('node', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('npm', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('1. Install', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('2. Authenticate', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('3. Point At Dataset', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('alpharesearch.nyc/cli/login', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Privacy and trust' }).waitFor({ timeout: 15000 })
    await page.getByText('does not upload your dataset', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('uploads the source file you choose', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('dataset id, run id, and current status', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open dashboard datasets and runs' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Dataset Examples' }).waitFor({ timeout: 15000 })
    await page.getByText('accessions.csv', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('data.example.gov/api/permits', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Use with Codex or Claude Code', { exact: true }).waitFor({ timeout: 15000 })
    if (await page.getByText('Sign in if needed.', { exact: true }).count()) {
      throw new Error('CLI page should replace the vague auth wording with explicit browser-login guidance.')
    }
    if (await page.getByText('prior art', { exact: false }).count()) {
      throw new Error('CLI page should prioritize install and dataset onboarding over broad marketing language.')
    }
  } finally {
    await browser.close()
  }
}

async function assertPrivacyTrustJourneySteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/privacy/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Privacy' }).waitFor({ timeout: 15000 })
    await page.getByText('Before you connect a dataset or sign in', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Collected today' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Not collected on this page' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Questions or sensitive use cases' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Cloudflare and operational logging' }).waitFor({ timeout: 15000 })
    await page.getByText('IP address, browser or device metadata, requested URL, timestamp', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('does not publish a fixed retention window', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'What changes when you sign in or use the CLI' }).waitFor({ timeout: 15000 })
    await page.getByText('datasets, runs, artifacts, and saved sessions', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Email ryan@zenobiapay.com' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Back to the RESEARCH CLI setup page' }).waitFor({ timeout: 15000 })
    if (await page.getByText('RResearch', { exact: true }).count()) {
      throw new Error('Privacy page should not use the legacy RResearch label.')
    }
    if (await page.getByText('If Alpha Research later adds product features', { exact: false }).count()) {
      throw new Error('Privacy page should answer current-state trust questions, not defer to a placeholder future-policy sentence.')
    }
  } finally {
    await browser.close()
  }
}

async function assertBlogLaunchJourneySteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/blog/launching-alpha-research/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Alpha Book is live, and there are three clear ways to try it.' }).waitFor({ timeout: 15000 })
    await page.getByText('Alpha Research is the company. Alpha Book is the first live research dataset.', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Try Alpha Book' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open dashboard' }).first().waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Use the RESEARCH CLI' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'What to do after reading' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Alpha Book', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Dashboard', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'RESEARCH CLI', exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open dashboard datasets and runs' }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Use Alpha Book with your coding agent' }).waitFor({ timeout: 15000 })
    await page.getByText('Expected result:', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open Alpha Book skill instructions' }).waitFor({ timeout: 15000 })
    if (await page.getByText('RResearch', { exact: true }).count()) {
      throw new Error('Launch blog page should not use the legacy RResearch label.')
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
    await page.getByRole('heading', { name: 'What do you want to research?' }).waitFor({ timeout: 15000 })
    await page.getByLabel('Message input').fill([
      'Dataset: City Housing Archive',
      'Variables: monthly rent, lease start date, neighborhood, bedrooms, concession flag',
      'Time window: 2019-2024',
      'Method: compare rent growth cohorts before and after concession spikes, then test whether neighborhood-level supply shifts explain outliers',
      'Outputs: one executive summary, one cohort comparison table, and one CSV with the retained analysis dataset',
    ].join('\n'))
    await page.getByLabel('Send message').click()
    await page.getByText('Remote agent heartbeat: validating requested fields against the dataset schema and preserving the launch specification.', { exact: false }).waitFor({ timeout: 15000 })
    if (new URL(page.url()).searchParams.get('view') !== 'assistant') {
      throw new Error('Launching a well-specified run should keep the user in the assistant session.')
    }
    await page.locator('[data-inline-run-block]').waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Run logs' }).waitFor({ timeout: 15000 })
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
    await page.getByRole('heading', { name: 'Datasets', exact: true }).waitFor({ timeout: 15000 })
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

async function assertAuthenticatedDatasetLoadFailure() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&scenario=data-error`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Datasets', exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Data temporarily unavailable', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'We could not load your datasets.' }).waitFor({ timeout: 15000 })
    await page.getByText('Your account is still signed in', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Retry' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Contact support' }).waitFor({ timeout: 15000 })
    if (await page.getByText('No datasets yet', { exact: true }).count()) {
      throw new Error('Dataset fetch failure should not render the normal empty-workspace state.')
    }
    if (await page.getByText('Harness scenario', { exact: false }).count()) {
      throw new Error('Dataset fetch failure should not leak harness wording into user-facing copy.')
    }
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

async function assertBusyDatasetConflictSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=datasets&datasetId=dataset-alpha-econ`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Alpha Econ Prototype' }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset is busy', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Another run is already using this dataset.' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'run-harness-running' }).waitFor({ timeout: 15000 })
    await page.getByText('Environment build in progress', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'View blocking run' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Refresh status' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancel blocking run' }).waitFor({ timeout: 15000 })
    await page.getByText('Source coverage', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Freshness and deployment', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Known gaps', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Briefing status', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('New work is blocked until environment build in progress finishes or is cancelled.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Describe dataset' }).waitFor({ timeout: 15000 })
    await page.getByText('Dataset briefing is blocked by an active run.', { exact: true }).waitFor({ timeout: 15000 })
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
    await page.getByRole('heading', { name: 'What do you want to research?' }).waitFor({ timeout: 15000 })
    await page.locator('img.aui-thread-welcome-image[src="/alpha-book-man.png"]').waitFor({ timeout: 15000 })
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
    await page.getByRole('heading', { name: 'Alpha Book Sample · Describe run' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open briefing artifact' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Open profile artifact' }).waitFor({ timeout: 15000 })
    await page.locator('iframe[title="report.html"]').waitFor({ timeout: 15000 })
    const viewportCanScroll = await page.evaluate(() => document.scrollingElement ? document.scrollingElement.scrollHeight > document.scrollingElement.clientHeight : false)
    const runPaneCanScroll = await page.locator('main').evaluate((main) => {
      const pane = main.querySelector('[data-run-detail-scroll]')
      return pane ? pane.scrollHeight > pane.clientHeight : false
    })
    if (!viewportCanScroll && !runPaneCanScroll) {
      throw new Error('Run detail page should expose a scrollable surface for long summaries and transcripts.')
    }
    await assertPageTextMissing(page, 'Requested vs produced', 'Run summary should not render the old card-heavy artifact audit on the main page.')
    await assertPageTextMissing(page, 'Run finished', 'Run summary should not duplicate completion in a second card.')
    await assertPageTextMissing(page, 'Primary result', 'Run summary should not use extra result cards for the primary artifact.')
    await assertPageTextMissing(page, 'function_call_output', 'Run transcript should not expose raw function-call output JSON.')
    await page.getByRole('button', { name: 'Artifacts' }).first().click()
    const artifactsPanel = page.getByLabel('Run artifacts')
    await artifactsPanel.getByText('report.html', { exact: true }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.locator('button', { hasText: 'summary.md' }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.locator('button', { hasText: 'result.json' }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.locator('button', { hasText: 'scripts/inspect_manifest.py' }).first().waitFor({ timeout: 15000 })
    await page.getByText('2 / 2', { exact: true }).waitFor({ timeout: 15000 })
  } finally {
    await browser.close()
  }
}

async function assertRunningRunStatusSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-running`, { waitUntil: 'domcontentloaded' })
    await page.getByText('The runner is fetching public data sources and assembling the housing and labor environment.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Remote agent heartbeat: fetching public data sources.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Source Inventory Snapshot · File', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancel' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByText('Stop this job if it is wrong or no longer worth the time or cost. Cancellation cannot be undone.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Any artifacts already saved to this run', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What stops immediately: active worker time, new artifacts, and further progress on this run.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Keep running' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Confirm cancel' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Keep running' }).click()
  } finally {
    await browser.close()
  }
}

async function assertMobileRunCheckInSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-running`, { waitUntil: 'domcontentloaded' })
    await page.getByText('The runner is fetching public data sources and assembling the housing and labor environment.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Remote agent heartbeat: fetching public data sources.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /Artifacts/i }).waitFor({ timeout: 15000 })
    if (await page.getByLabel('Scroll to bottom').count()) {
      throw new Error('Mobile run check-in should not foreground the transcript scroll utility.')
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
    await page.getByText('Describe this corpus and suggest first research questions.', { exact: true }).waitFor({ timeout: 15000 })
    await page.locator('[data-inline-run-block]').waitFor({ timeout: 15000 })
    await page.locator('iframe[title="report.html"]').waitFor({ timeout: 15000 })
    await page.getByPlaceholder('Send a message...').waitFor({ timeout: 15000 })
    await assertPageTextMissing(page, 'Continue last thread', 'Selected chats should open directly into the transcript, not a resume card.')
    await assertPageTextMissing(page, 'Research target', 'Assistant resume card labels should not be visible.')
    await assertPageTextMissing(page, 'Linked run', 'Assistant resume card labels should not be visible.')
    await assertPageTextMissing(page, 'Next step', 'Assistant resume card labels should not be visible.')
    await assertPageTextMissing(page, 'Session recap', 'Assistant resume card labels should not be visible.')
    await assertPageTextMissing(page, 'Most recent', 'Sidebar recent chat rows should not show recency badges.')
    await assertPageTextMissing(page, 'CLI handoff', 'Sidebar recent chat rows should not show generated session metadata.')
    await assertPageTextMissing(page, 'Syncing transcript', 'Sidebar recent chat rows should not show generated session metadata.')
    await assertPageTextMissing(page, 'function_call_output', 'Sidebar and resume surfaces should not expose raw tool output.')
  } finally {
    await browser.close()
  }
}

async function assertStuckRunSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-failed`, { waitUntil: 'domcontentloaded' })
    await page.getByText('The worker stopped responding before it reported whether the run finished.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Retry' }).waitFor({ timeout: 15000 })
    await page.getByText('Run marked worker_unreachable because the remote droplet stopped heartbeating before reporting a terminal result.', { exact: true }).waitFor({ timeout: 15000 })
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
    await page.getByText('Describe the Alpha Book sample and identify research-ready fields.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Build a public-data environment for housing and labor indicators.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Find novels that reference railways before 1850.', { exact: true }).waitFor({ timeout: 15000 })
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

async function assertSignedOutDashboardGate() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(`${baseUrl}/?logged_out=1&view=dashboard&datasetId=dataset-alpha-book`, { waitUntil: 'domcontentloaded' })
    await page.getByText('Sign in to continue to your dataset', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText("You're signed out. Sign in to keep going, and we'll bring you back to your dataset after login.", { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Chats', { exact: true }).count()) {
      throw new Error('Signed-out dashboard gate should not expose workspace sidebar chrome.')
    }
    const [request] = await Promise.all([
      page.waitForRequest((candidate) => candidate.url().includes('/api/auth/start')),
      page.getByRole('button', { name: 'Sign in' }).click(),
    ])
    const loginUrl = new URL(request.url())
    const bridgeReturn = loginUrl.searchParams.get('return_to')
    if (!bridgeReturn?.includes('/api/auth/bridge?return_to=')) {
      throw new Error(`Signed-out dashboard gate did not route through the auth bridge: ${request.url()}`)
    }
    if (!bridgeReturn.includes(encodeURIComponent(`${baseUrl}/?view=dashboard&datasetId=dataset-alpha-book`))) {
      throw new Error(`Signed-out dashboard gate did not preserve the requested destination: ${request.url()}`)
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
  await assertLandingPageUnderstanding()
  await assertCliInstallJourneySteering()
  await assertPrivacyTrustJourneySteering()
  await assertBlogLaunchJourneySteering()
  await assertRenderedOrientation()
  await assertWellSpecifiedRunLaunch()
  await assertRenderedDatasetInventory()
  await assertTopicGuidedDatasetSelection()
  await assertRenderedEmptyDatasetSetup()
  await assertAuthenticatedDatasetLoadFailure()
  await assertRenderedDatasetDetail()
  await assertBusyDatasetConflictSteering()
  await assertDatasetScopedAskRouting()
  await assertDescribeRunSteering()
  await assertCompletedRunArtifactsSteering()
  await assertRunningRunStatusSteering()
  await assertMobileRunCheckInSteering()
  await assertResumeLastResearchThread()
  await assertStuckRunSteering()
  await assertRenderedRunsInventory()
  await assertTerminalSessionContinuity()
  await assertSignedOutDashboardGate()
  console.log(`Dashboard harness smoke passed at ${baseUrl}`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  child.kill('SIGTERM')
}
