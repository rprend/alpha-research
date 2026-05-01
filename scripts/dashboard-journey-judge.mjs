import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { spawn } from 'node:child_process'
import { join, resolve } from 'node:path'

import { DASHBOARD_JOURNEYS, getDashboardJourney } from './dashboard-journeys.mjs'
import { writeDashboardJourneyIndex } from './dashboard-journey-report.mjs'

const JUDGE_TIMEOUT_MS = Number(process.env.DASHBOARD_JOURNEY_JUDGE_TIMEOUT_MS ?? 300000)

function parseArgs() {
  const args = process.argv.slice(2)
  const idsArg = args.find((arg) => arg.startsWith('--journeys='))?.split('=')[1]
  const outArg = args.find((arg) => arg.startsWith('--out='))?.split('=')[1]
  const runsArg = args.find((arg) => arg.startsWith('--runs='))?.split('=')[1]
  return {
    ids: idsArg ? idsArg.split(',').map((id) => id.trim()).filter(Boolean) : DASHBOARD_JOURNEYS.map((journey) => journey.id),
    outRoot: resolve(outArg ?? '.tmp/dashboard-journey-runs'),
    explicitRuns: runsArg ? runsArg.split(',').map((item) => resolve(item.trim())).filter(Boolean) : [],
  }
}

async function latestRunDir(root) {
  try {
    const entries = await readdir(root)
    const dirs = []
    for (const entry of entries) {
      const full = join(root, entry)
      if ((await stat(full)).isDirectory()) dirs.push(full)
    }
    return dirs.sort().at(-1) ?? null
  } catch {
    return null
  }
}

function judgePrompt(outDir) {
  return `You are judging the UX of the Alpha Research web dashboard for one canonical user journey.

Workspace: ${process.cwd()}
Captured run directory: ${outDir}

Read:
- ${join(outDir, 'journey.md')}
- ${join(outDir, 'input.json')}
- ${join(outDir, 'events.jsonl')}
- ${join(outDir, 'metadata.json')}
- text snapshots under ${join(outDir, 'snapshots')}
- screenshots under ${join(outDir, 'screenshots')}
- video metadata in metadata.json when available

Your job:
1. Reconstruct what the user experienced from the screenshots and visible-text snapshots first, then use DOM snapshots/events to verify exact text.
2. Decide whether the dashboard chose the right interaction and state: orientation, inventory, detail, run monitoring, artifact inspection, or terminal transcript.
3. Identify every confusing moment visible to a normal user. Be concrete and reference screenshot or snapshot filenames.
4. Separate product confusion from dataset confusion, auth confusion, run lifecycle confusion, artifact confusion, and visual/UI readability problems.
5. Judge whether displayed information was too sparse, right-sized, or too dense for this journey.
6. Return a Markdown briefing with:
   - Verdict: Pass, Partial, or Fail.
   - User input burden.
   - Correct behavior assessment.
   - Confusing moments ordered by severity.
   - Missing information that would have helped.
   - Information that should be removed or de-emphasized.
   - Suggested dashboard UI changes.
   - Evidence references to screenshots/snapshots/event timestamps.

Do not modify files. Return only the Markdown briefing. Focus on what a user would understand from the actual rendered dashboard.`
}

async function runJudge(outDir) {
  await mkdir(outDir, { recursive: true })
  const briefingPath = join(outDir, 'briefing.md')
  const child = spawn('codex', [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '--ignore-user-config',
    '--ignore-rules',
    '-m',
    process.env.DASHBOARD_JOURNEY_JUDGE_MODEL ?? 'gpt-5.4-mini',
    '-C',
    process.cwd(),
    '-o',
    briefingPath,
    judgePrompt(outDir),
  ], {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })

  const code = await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.kill('SIGTERM')
      resolve(null)
    }, JUDGE_TIMEOUT_MS)
    child.on('exit', (exitCode) => {
      clearTimeout(timeout)
      resolve(exitCode)
    })
  })
  await writeFile(join(outDir, 'judge.log'), output)
  if (!existsSync(briefingPath)) {
    await writeFile(briefingPath, output.trim()
      ? `${output.trim()}\n`
      : `# Judge Failed\n\nCodex exited with ${code} and produced no briefing output.\n`)
  }
}

async function main() {
  const { ids, outRoot, explicitRuns } = parseArgs()
  const runDirs = []
  if (explicitRuns.length > 0) {
    runDirs.push(...explicitRuns)
  } else {
    for (const id of ids) {
      if (!getDashboardJourney(id)) throw new Error(`Unknown dashboard journey id ${id}`)
      const latest = await latestRunDir(join(outRoot, id))
      if (!latest) throw new Error(`No captured dashboard run found for ${id} under ${join(outRoot, id)}`)
      runDirs.push(latest)
    }
  }

  for (const outDir of runDirs) {
    console.log(`Judging ${outDir}`)
    await runJudge(outDir)
    console.log(`Briefing ${join(outDir, 'briefing.md')}`)
  }
  const indexPath = await writeDashboardJourneyIndex(outRoot)
  console.log(`Report ${indexPath}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
