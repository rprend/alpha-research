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

async function assertLandingPageUnderstanding() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' })
    await page.getByText('Open-source research platform', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Ask questions across large datasets, then inspect the evidence and outputs.' }).waitFor({ timeout: 15000 })
    await page.getByText('hosted research app plus an open-source CLI', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Talk to a human before you commit to self-serve setup.' }).waitFor({ timeout: 15000 })
    await page.getByText('Private, proprietary, or enterprise data', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Setup help covers private dataset fit, ingestion approach, access model, and the first research workflow', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Private and institutional corpus review', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Book a setup call' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Self-serve with the RESEARCH CLI' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Email the team' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Inspect a real research run' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'See Alpha Book example' }).waitFor({ timeout: 15000 })
    await page.getByText('What it is', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What Alpha Research returns', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Private dataset path via CLI', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('heading', { name: 'Inspect a concrete dataset, question, and output path before you install anything.' }).waitFor({ timeout: 15000 })
    await page.getByText('Proof, not promises', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Example artifact preview', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What a useful research output looks like', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText(/run-summary\.md/, { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText(/cited-passages\.csv/, { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Live examples and planned coverage', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('live now · 75,000 public domain books', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('planned', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('What happens on a setup call?', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Sign in' }).waitFor({ timeout: 15000 })
    if (await page.getByText('RResearch', { exact: true }).count()) {
      throw new Error('Landing page should not use the legacy RResearch label in primary navigation.')
    }
    if (await page.getByText('Open source, agentic knowledge bases for all of humanity\'s knowledge', { exact: true }).count()) {
      throw new Error('Landing page hero should use the clarified product definition, not the old abstract headline.')
    }
    if (await page.getByRole('button', { name: 'login' }).count()) {
      throw new Error('Landing page should not foreground the vague legacy login label.')
    }
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
    await page.getByRole('heading', { name: 'Alpha Book Sample · Describe run' }).waitFor({ timeout: 15000 })
    await page.getByText('Run id', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('run-harness-completed', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Prompt', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Artifacts (3)', { exact: true }).waitFor({ timeout: 15000 })
    await page.locator('button', { hasText: 'summary.md' }).first().waitFor({ timeout: 15000 })
    await page.locator('button', { hasText: 'result.json' }).first().waitFor({ timeout: 15000 })
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
    await artifactsPanel.locator('button', { hasText: 'summary.md' }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.locator('button', { hasText: 'result.json' }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Supporting files', { exact: true }).waitFor({ timeout: 15000 })
    await artifactsPanel.locator('button', { hasText: 'scripts/inspect_manifest.py' }).first().waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Advanced debugging', { exact: true }).waitFor({ timeout: 15000 })
    await artifactsPanel.getByRole('link', { name: 'Open remote Codex session' }).waitFor({ timeout: 15000 })
    await artifactsPanel.getByText('Optional. Open the underlying Codex transcript and tool output only if you need deeper debugging beyond this run summary and its saved artifacts.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Available as result.json.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Canonical answer to the run request. Read this first.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Machine-readable companion with the durable result data.', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('How to use this file', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Download' }).waitFor({ timeout: 15000 })
    await page.getByRole('link', { name: 'Open remote Codex session' }).first().waitFor({ timeout: 15000 })
    await page.getByText('Advanced debugging remains optional. This file is the normal review path; the remote Codex session is only for deeper transcript and tool inspection.', { exact: true }).waitFor({ timeout: 15000 })
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
    await page.getByText('Cancel keeps any saved artifacts and transcript evidence already attached to this run.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Cancel if this run is wrong or too expensive to keep running.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Review saved output' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancel run' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Cancel run' }).click()
    await page.getByText('Stop this job if it is wrong or no longer worth the time or cost. Cancellation cannot be undone.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Any artifacts already saved to this run', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('What stops immediately: active worker time, new artifacts, and further progress on this run.', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Keep running' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Confirm cancel' }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: 'Keep running' }).click()
    await page.getByRole('button', { name: 'Show run details' }).waitFor({ timeout: 15000 })
    if (await page.getByText('Run id', { exact: true }).count()) {
      throw new Error('Running run detail should not foreground run metadata while the user is waiting on live work.')
    }
  } finally {
    await browser.close()
  }
}

async function assertMobileRunCheckInSteering() {
  const browser = await chromium.launch({ headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
    await page.goto(`${baseUrl}/?harness=1&view=runs&runId=run-harness-running`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('heading', { name: 'Run is alive' }).waitFor({ timeout: 15000 })
    await page.getByText('No action needed', { exact: false }).waitFor({ timeout: 15000 })
    await page.getByText('Current phase', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Fetching public data sources', { exact: true }).first().waitFor({ timeout: 15000 })
    await page.getByText('Last heartbeat', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByText('Latest evidence', { exact: true }).waitFor({ timeout: 15000 })
    await page.getByRole('button', { name: /Open artifacts|Artifacts/i }).waitFor({ timeout: 15000 })
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
