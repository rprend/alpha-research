import { existsSync } from 'node:fs'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import { basename, join, relative } from 'node:path'

import { DASHBOARD_JOURNEYS } from './dashboard-journeys.mjs'

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function rel(fromDir, toPath) {
  return relative(fromDir, toPath).replaceAll('\\', '/')
}

async function listDirs(path) {
  try {
    const entries = await readdir(path, { withFileTypes: true })
    return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()
  } catch {
    return []
  }
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'))
  } catch {
    return null
  }
}

async function firstLines(path, maxLines = 12) {
  try {
    return (await readFile(path, 'utf8')).split('\n').slice(0, maxLines).join('\n').trim()
  } catch {
    return ''
  }
}

async function collectRun(outRoot, journeyId, runId) {
  const runDir = join(outRoot, journeyId, runId)
  const screenshotsDir = join(runDir, 'screenshots')
  const snapshotsDir = join(runDir, 'snapshots')
  const metadata = await readJson(join(runDir, 'metadata.json'))
  const input = await readJson(join(runDir, 'input.json'))
  const screenshots = (await readdir(screenshotsDir).catch(() => []))
    .filter((name) => name.endsWith('.png'))
    .sort()
  const videos = (await readdir(join(runDir, 'videos')).catch(() => []))
    .filter((name) => name.endsWith('.webm'))
    .sort()
  const finalSnapshot = screenshots.at(-1)?.replace(/\.png$/u, '.txt') ?? null
  return {
    runDir,
    runId,
    metadata,
    input,
    screenshots,
    videos,
    finalText: finalSnapshot ? await firstLines(join(snapshotsDir, finalSnapshot)) : '',
    hasBriefing: existsSync(join(runDir, 'briefing.md')),
  }
}

export async function writeDashboardJourneyIndex(outRoot) {
  const rows = []
  for (const journey of DASHBOARD_JOURNEYS) {
    const journeyRoot = join(outRoot, journey.id)
    const runIds = await listDirs(journeyRoot)
    for (const runId of runIds) {
      rows.push({ journey, run: await collectRun(outRoot, journey.id, runId) })
    }
  }

  rows.sort((a, b) => `${b.run.runId}`.localeCompare(`${a.run.runId}`))

  const cards = rows.map(({ journey, run }) => {
    const firstScreenshot = run.screenshots[0] ? join(run.runDir, 'screenshots', run.screenshots[0]) : null
    const finalScreenshot = run.screenshots.at(-1) ? join(run.runDir, 'screenshots', run.screenshots.at(-1)) : null
    const video = run.videos[0] ? join(run.runDir, 'videos', run.videos[0]) : null
    return `
      <article class="card">
        <header>
          <p class="eyebrow">${escapeHtml(journey.id)} · ${escapeHtml(run.runId)}</p>
          <h2>${escapeHtml(journey.title)}</h2>
          <p>${escapeHtml(journey.intention)}</p>
        </header>
        <div class="meta">
          <span>${escapeHtml(run.metadata?.url ?? run.input?.url ?? '')}</span>
          <span>${escapeHtml(run.screenshots.length)} screenshots</span>
          <span>${video ? 'video captured' : 'no video'}</span>
          <span>${run.hasBriefing ? 'judged' : 'not judged'}</span>
        </div>
        ${finalScreenshot ? `<a href="${escapeHtml(rel(outRoot, finalScreenshot))}"><img src="${escapeHtml(rel(outRoot, finalScreenshot))}" alt="${escapeHtml(journey.id)} final screenshot"></a>` : ''}
        <pre>${escapeHtml(run.finalText || 'No visible text snapshot captured.')}</pre>
        <nav>
          ${firstScreenshot ? `<a href="${escapeHtml(rel(outRoot, firstScreenshot))}">Start screenshot</a>` : ''}
          ${finalScreenshot ? `<a href="${escapeHtml(rel(outRoot, finalScreenshot))}">Final screenshot</a>` : ''}
          ${video ? `<a href="${escapeHtml(rel(outRoot, video))}">Recording</a>` : ''}
          <a href="${escapeHtml(rel(outRoot, join(run.runDir, 'journey.md')))}">Journey</a>
          <a href="${escapeHtml(rel(outRoot, join(run.runDir, 'events.jsonl')))}">Events</a>
          ${run.hasBriefing ? `<a href="${escapeHtml(rel(outRoot, join(run.runDir, 'briefing.md')))}">Briefing</a>` : ''}
        </nav>
      </article>`
  }).join('\n')

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Dashboard Journey Evaluations</title>
    <style>
      :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      body { margin: 0; background: #f7f7f5; color: #171717; }
      main { max-width: 1180px; margin: 0 auto; padding: 40px 24px; }
      h1 { margin: 0 0 8px; font-size: 34px; letter-spacing: 0; }
      .lead { margin: 0 0 28px; color: #666; max-width: 780px; line-height: 1.55; }
      .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 18px; }
      .card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 18px; display: flex; flex-direction: column; gap: 14px; }
      .eyebrow { margin: 0 0 6px; color: #777; font-size: 12px; text-transform: uppercase; letter-spacing: .12em; }
      h2 { margin: 0 0 8px; font-size: 20px; }
      p { margin: 0; line-height: 1.5; }
      .meta { display: flex; flex-wrap: wrap; gap: 8px; color: #555; font-size: 12px; }
      .meta span { border: 1px solid #ddd; padding: 4px 7px; border-radius: 999px; background: #fafafa; }
      img { width: 100%; border: 1px solid #ddd; border-radius: 6px; background: #eee; }
      pre { margin: 0; padding: 12px; max-height: 220px; overflow: auto; background: #111; color: #f5f5f5; border-radius: 6px; font: 12px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; }
      nav { display: flex; flex-wrap: wrap; gap: 10px; }
      a { color: #0f5b99; text-decoration: none; }
      a:hover { text-decoration: underline; }
      @media (prefers-color-scheme: dark) {
        body { background: #101010; color: #f5f5f5; }
        .lead, .eyebrow, .meta { color: #aaa; }
        .card { background: #181818; border-color: #333; }
        .meta span { background: #222; border-color: #333; }
        img { border-color: #333; }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>Dashboard Journey Evaluations</h1>
      <p class="lead">Captured screenshots, videos, visible text snapshots, and judge briefings for Alpha Research dashboard journeys. Capture and judging are separate runs.</p>
      <section class="grid">
        ${cards || '<p>No journey runs captured yet.</p>'}
      </section>
    </main>
  </body>
</html>
`
  await writeFile(join(outRoot, 'index.html'), html)
  return join(outRoot, 'index.html')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const outRoot = process.argv[2] ?? '.tmp/dashboard-journey-runs'
  writeDashboardJourneyIndex(outRoot)
    .then((path) => console.log(`Wrote ${path}`))
    .catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
}
