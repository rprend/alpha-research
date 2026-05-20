import { spawn } from 'node:child_process'
import { chromium } from 'playwright'

const timeoutMs = Number(process.env.QA_DASHBOARD_TIMEOUT_MS ?? 30_000)
const port = Number(process.env.QA_DASHBOARD_PORT ?? (4100 + Math.floor(Math.random() * 400)))
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
  return html
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
  await assertRoute('/?harness=1', 'Turn a vague research idea into a scoped plan you can approve')
  await assertRoute('/?harness=1&view=datasets', '<div id="app">')
  await assertRoute('/?harness=1&view=runs', '<div id="app">')
  await assertRoute('/?harness=1&view=datasets&scenario=data-error', '<div id="app">')
  const browser = await chromium.launch()
  try {
    const page = await browser.newPage()
    await page.goto(`${baseUrl}/?harness=1&view=datasets&scenario=data-error`, {
      waitUntil: 'networkidle',
    })
    const bodyText = await page.locator('body').innerText()
    if (!bodyText.includes('You are signed in, but we could not load your datasets.')) {
      throw new Error('Datasets data-error route did not render the dedicated signed-in failure state.')
    }
    if (!bodyText.includes('Retry')) {
      throw new Error('Datasets data-error route did not render a retry action.')
    }
    if (bodyText.includes('Harness scenario:')) {
      throw new Error('Datasets data-error route leaked harness jargon into the user-facing UI.')
    }
    if (bodyText.includes('No datasets yet')) {
      throw new Error('Datasets data-error route incorrectly rendered the empty datasets state.')
    }
  } finally {
    await browser.close()
  }
  console.log(`Dashboard harness smoke passed at ${baseUrl}`)
} catch (error) {
  console.error(output)
  throw error
} finally {
  child.kill('SIGTERM')
}
