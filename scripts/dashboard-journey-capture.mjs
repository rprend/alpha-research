import { mkdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { chromium } from 'playwright'

import {
  DASHBOARD_JOURNEYS,
  getDashboardJourney,
  markdownForDashboardJourney,
} from './dashboard-journeys.mjs'
import { writeDashboardJourneyIndex } from './dashboard-journey-report.mjs'

const DEFAULT_BASE_URL = 'https://dashboard.alpharesearch.nyc'
const SNAPSHOT_MS = Number(process.env.DASHBOARD_JOURNEY_SNAPSHOT_MS ?? 5000)
const WIDTH = Number(process.env.DASHBOARD_JOURNEY_WIDTH ?? 1440)
const HEIGHT = Number(process.env.DASHBOARD_JOURNEY_HEIGHT ?? 1000)

function parseArgs() {
  const args = process.argv.slice(2)
  const idsArg = args.find((arg) => arg.startsWith('--journeys='))?.split('=')[1]
  const outArg = args.find((arg) => arg.startsWith('--out='))?.split('=')[1]
  const baseUrlArg = args.find((arg) => arg.startsWith('--base-url='))?.split('=')[1]
  const headed = args.includes('--headed')
  return {
    ids: idsArg ? idsArg.split(',').map((id) => id.trim()).filter(Boolean) : DASHBOARD_JOURNEYS.map((journey) => journey.id),
    outRoot: resolve(outArg ?? '.tmp/dashboard-journey-runs'),
    baseUrl: baseUrlArg ?? process.env.DASHBOARD_JOURNEY_BASE_URL ?? DEFAULT_BASE_URL,
    headed,
  }
}

function timestamp() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, 'Z')
}

function absoluteUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString()
}

async function gitValue(args) {
  const { spawnSync } = await import('node:child_process')
  const result = spawnSync('git', args, { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : null
}

async function visibleTranscript(page) {
  return page.evaluate(() => {
    const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement
        if (!parent || ignored.has(parent.tagName)) return NodeFilter.FILTER_REJECT
        const style = window.getComputedStyle(parent)
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
          return NodeFilter.FILTER_REJECT
        }
        return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
      },
    })
    const lines = []
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim()
      if (text) lines.push(text)
    }
    return lines.join('\n')
  })
}

async function waitForVisibleText(page, text, timeout) {
  await page.waitForFunction(
    (needle) => {
      const ignored = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT'])
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const parent = node.parentElement
          if (!parent || ignored.has(parent.tagName)) return NodeFilter.FILTER_REJECT
          const style = window.getComputedStyle(parent)
          if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return NodeFilter.FILTER_REJECT
          }
          return node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
        },
      })
      while (walker.nextNode()) {
        if (walker.currentNode.textContent?.includes(needle)) return true
      }
      return false
    },
    text,
    { timeout },
  )
}

async function captureSnapshot({ page, outDir, screenshotsDir, snapshotsDir, events, startedAt, indexRef }, label) {
  const base = `${String(indexRef.value++).padStart(4, '0')}-${label}`
  const screenshotPath = join(screenshotsDir, `${base}.png`)
  const snapshotPath = join(snapshotsDir, `${base}.txt`)
  const domPath = join(snapshotsDir, `${base}.html`)
  const transcript = await visibleTranscript(page)
  await page.screenshot({ path: screenshotPath, fullPage: true })
  await writeFile(snapshotPath, transcript)
  await writeFile(domPath, await page.content())
  events.push(JSON.stringify({
    atMs: Date.now() - startedAt,
    type: 'snapshot',
    label,
    screenshotPath,
    snapshotPath,
    domPath,
  }))
}

async function runStep(page, step, events, startedAt) {
  events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: 'step', step }))
  if (step.type === 'viewport') {
    await page.setViewportSize({ width: step.width, height: step.height })
    return
  }
  if (step.type === 'wait') {
    await page.waitForTimeout(step.ms)
    return
  }
  if (step.type === 'waitForText') {
    await waitForVisibleText(page, step.text, step.timeoutMs ?? 15000)
    return
  }
  if (step.type === 'clickText') {
    await page.getByText(step.text, { exact: false }).first().click()
    return
  }
  if (step.type === 'fillLabel') {
    await page.getByLabel(step.label).fill(step.value)
    return
  }
  if (step.type === 'clickLabel') {
    await page.getByLabel(step.label).click()
    return
  }
  throw new Error(`Unknown dashboard journey step: ${JSON.stringify(step)}`)
}

async function launchBrowser(headed) {
  const options = { headless: !headed }
  if (process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH) {
    return chromium.launch({
      ...options,
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,
    })
  }
  return chromium.launch(options)
}

async function captureJourney(journey, outRoot, baseUrl, headed) {
  const runTimestamp = timestamp()
  const outDir = join(outRoot, journey.id, runTimestamp)
  const screenshotsDir = join(outDir, 'screenshots')
  const snapshotsDir = join(outDir, 'snapshots')
  const videosDir = join(outDir, 'videos')
  await mkdir(screenshotsDir, { recursive: true })
  await mkdir(snapshotsDir, { recursive: true })
  await mkdir(videosDir, { recursive: true })

  const url = absoluteUrl(baseUrl, journey.path)
  await writeFile(join(outDir, 'journey.md'), markdownForDashboardJourney(journey))
  await writeFile(join(outDir, 'input.json'), JSON.stringify({
    journeyId: journey.id,
    title: journey.title,
    url,
    baseUrl,
    viewport: { width: WIDTH, height: HEIGHT },
    snapshotMs: SNAPSHOT_MS,
    steps: journey.steps,
  }, null, 2))

  const events = []
  const startedAt = Date.now()
  const indexRef = { value: 0 }
  let browser
  let videoPath = null
  let interval

  try {
    browser = await launchBrowser(headed)
    const context = await browser.newContext({
      viewport: { width: WIDTH, height: HEIGHT },
      recordVideo: { dir: videosDir, size: { width: WIDTH, height: HEIGHT } },
    })
    const page = await context.newPage()
    page.on('console', (message) => {
      events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: 'console', level: message.type(), text: message.text() }))
    })
    page.on('pageerror', (error) => {
      events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: 'pageerror', message: error.message }))
    })

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await captureSnapshot({ page, outDir, screenshotsDir, snapshotsDir, events, startedAt, indexRef }, 'start')

    interval = setInterval(() => {
      void captureSnapshot({ page, outDir, screenshotsDir, snapshotsDir, events, startedAt, indexRef }, `${Math.round((Date.now() - startedAt) / 1000)}s`)
        .catch((error) => events.push(JSON.stringify({ atMs: Date.now() - startedAt, type: 'snapshot_error', message: error.message })))
    }, SNAPSHOT_MS)

    for (const [stepIndex, step] of journey.steps.entries()) {
      await runStep(page, step, events, startedAt)
      await captureSnapshot({ page, outDir, screenshotsDir, snapshotsDir, events, startedAt, indexRef }, `step-${stepIndex + 1}`)
    }

    clearInterval(interval)
    interval = undefined
    await captureSnapshot({ page, outDir, screenshotsDir, snapshotsDir, events, startedAt, indexRef }, 'final')
    const video = page.video()
    await context.close()
    videoPath = video ? await video.path().catch(() => null) : null
  } finally {
    if (interval) clearInterval(interval)
    if (browser) await browser.close().catch(() => undefined)
  }

  await writeFile(join(outDir, 'events.jsonl'), `${events.join('\n')}\n`)
  await writeFile(join(outDir, 'metadata.json'), JSON.stringify({
    journeyId: journey.id,
    title: journey.title,
    startedAt: new Date(startedAt).toISOString(),
    elapsedMs: Date.now() - startedAt,
    url,
    viewport: { width: WIDTH, height: HEIGHT },
    gitSha: await gitValue(['rev-parse', 'HEAD']),
    gitBranch: await gitValue(['branch', '--show-current']),
    videoPath,
  }, null, 2))
  return outDir
}

async function main() {
  const { ids, outRoot, baseUrl, headed } = parseArgs()
  await mkdir(outRoot, { recursive: true })
  for (const id of ids) {
    const journey = getDashboardJourney(id)
    if (!journey) throw new Error(`Unknown dashboard journey id ${id}`)
    console.log(`Capturing ${journey.id}: ${journey.title}`)
    const outDir = await captureJourney(journey, outRoot, baseUrl, headed)
    console.log(`Captured ${outDir}`)
  }
  const indexPath = await writeDashboardJourneyIndex(outRoot)
  console.log(`Report ${indexPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
