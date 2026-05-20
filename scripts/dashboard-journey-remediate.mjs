import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { openSync } from 'node:fs'
import { spawn, spawnSync } from 'node:child_process'
import { basename, join, resolve } from 'node:path'

import { DASHBOARD_JOURNEYS, getDashboardJourney } from './dashboard-journeys.mjs'

const DEFAULT_OUT_ROOT = '.tmp/dashboard-journey-runs'
const DEFAULT_REMEDIATION_ROOT = '.tmp/dashboard-journey-remediation'

function parseArgs() {
  const args = process.argv.slice(2)
  const idsArg = args.find((arg) => arg.startsWith('--journeys='))?.split('=')[1]
  const outArg = args.find((arg) => arg.startsWith('--out='))?.split('=')[1]
  const remediationArg = args.find((arg) => arg.startsWith('--remediation-out='))?.split('=')[1]
  const runsArg = args.find((arg) => arg.startsWith('--runs='))?.split('=')[1]
  const modelArg = args.find((arg) => arg.startsWith('--model='))?.split('=')[1]
  const modeArg = args.find((arg) => arg.startsWith('--mode='))?.split('=')[1]
  const onlyVerdictsArg = args.find((arg) => arg.startsWith('--only-verdicts='))?.split('=')[1]
  const execute = args.includes('--execute')
  const detach = args.includes('--detach')
  const dryRun = args.includes('--dry-run') || (!execute && !detach)
  return {
    ids: idsArg ? idsArg.split(',').map((id) => id.trim()).filter(Boolean) : DASHBOARD_JOURNEYS.map((journey) => journey.id),
    outRoot: resolve(outArg ?? DEFAULT_OUT_ROOT),
    remediationRoot: resolve(remediationArg ?? DEFAULT_REMEDIATION_ROOT),
    explicitRuns: runsArg ? runsArg.split(',').map((item) => resolve(item.trim())).filter(Boolean) : [],
    model: modelArg ?? process.env.DASHBOARD_JOURNEY_REMEDIATION_MODEL ?? 'gpt-5.4',
    mode: modeArg ?? 'current',
    onlyVerdicts: onlyVerdictsArg ? onlyVerdictsArg.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean) : null,
    execute,
    detach,
    dryRun,
  }
}

async function latestRunDir(root) {
  const entries = await readdir(root)
  const dirs = []
  for (const entry of entries) {
    const full = join(root, entry)
    if ((await stat(full)).isDirectory()) dirs.push(full)
  }
  return dirs.sort().at(-1) ?? null
}

function git(args, options = {}) {
  const result = spawnSync('git', args, {
    cwd: options.cwd ?? process.cwd(),
    encoding: 'utf8',
  })
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`git ${args.join(' ')} failed:\n${result.stderr || result.stdout}`)
  }
  return result.stdout.trim()
}

function currentBranch() {
  return git(['branch', '--show-current'])
}

function safeBranchName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9._/-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

async function ensureWorktree(journeyId, remediationRoot) {
  const branch = safeBranchName(`codex/dashboard-journey-${journeyId.toLowerCase()}-remediation`)
  const worktreePath = join(remediationRoot, 'worktrees', journeyId)
  await mkdir(join(remediationRoot, 'worktrees'), { recursive: true })
  if (existsSync(worktreePath)) {
    return { branch, worktreePath, created: false }
  }

  const branchExists = spawnSync('git', ['rev-parse', '--verify', branch], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).status === 0
  const args = branchExists
    ? ['worktree', 'add', worktreePath, branch]
    : ['worktree', 'add', '-b', branch, worktreePath, currentBranch()]
  git(args)
  return { branch, worktreePath, created: true }
}

function extractVerdict(briefing) {
  const plain = briefing.replace(/[*_#`]/g, '').replace(/\r/g, '')
  const index = plain.toLowerCase().indexOf('verdict')
  const windowText = index >= 0 ? plain.slice(index, index + 160) : plain.slice(0, 160)
  return windowText.match(/\b(Pass|Partial|Fail)\b/i)?.[1]?.toLowerCase() ?? 'unknown'
}

async function collectRun(outRoot, journeyId) {
  const journey = getDashboardJourney(journeyId)
  if (!journey) throw new Error(`Unknown dashboard journey id ${journeyId}`)
  const runDir = await latestRunDir(join(outRoot, journeyId))
  if (!runDir) throw new Error(`No captured run found for ${journeyId}`)
  return { journey, runDir }
}

function remediationPrompt({ journey, runDir, briefing, metadata, input }) {
  return `We ran a Dashboard Journey Evaluation and need you to update Alpha Research so this journey aligns with the intended product expectation in future runs.

Journey:
- ID: ${journey.id}
- Title: ${journey.title}
- Product step: ${journey.productStep}
- User mind: ${journey.userMind}
- User knows: ${journey.userKnows.join('; ')}
- User does not know: ${journey.userDoesNotKnow.join('; ')}
- Trigger: ${journey.trigger}
- Correct product steering: ${journey.correctProductSteering}
- Failure modes to catch: ${journey.failureModes.join('; ')}
- Judge question: ${journey.judgeQuestion}

Captured evidence directory:
${runDir}

Important files to inspect:
- ${join(runDir, 'journey.md')}
- ${join(runDir, 'briefing.md')}
- ${join(runDir, 'events.jsonl')}
- ${join(runDir, 'metadata.json')}
- ${join(runDir, 'snapshots')}
- ${join(runDir, 'screenshots')}
- ${join(runDir, 'videos')}

Captured run metadata:
\`\`\`json
${metadata}
\`\`\`

Captured input:
\`\`\`json
${input}
\`\`\`

Journey Eval Briefing:
\`\`\`markdown
${briefing}
\`\`\`

Task:
Update the Alpha Research product implementation in this repository to fix the surfaced issues for this journey so that when we run the same journey in the future, the observed dashboard/website/RESEARCH CLI handoff behavior aligns with the Journey's Correct Product Steering and Judge Question.

Requirements:
- Use the briefing as evidence, but inspect the actual captured snapshots/screenshots/DOM files before changing code.
- Fix the product behavior, UI copy, affordances, data state, or journey plumbing that caused the mismatch.
- Do not add backwards-compatibility shims, compatibility-only branches, or legacy fallbacks unless they are truly required by the current product.
- Do not degrade performance.
- Preserve or improve accessibility and responsive behavior.
- Keep changes scoped to this journey's surfaced issues unless a shared improvement is clearly necessary.
- Add or update tests, harness data, journey scenarios, or docs when behavior changes.
- Run the relevant validation before finishing. At minimum, run \`pnpm build\` and \`pnpm test\`; run \`pnpm run qa:dashboard\` if the UI changed.
- If this journey cannot be fully fixed in this repository, implement the highest-value repository-local fix and document the remaining external blocker in your final response.
- Commit your changes in the current checkout with a concise message.

Do not merely summarize the issue. Make the code/product changes needed to get the journey working as expected.`
}

async function writeJobFiles({ journey, runDir, briefing, metadata, input, remediationRoot }) {
  const jobDir = join(remediationRoot, 'jobs', journey.id)
  await mkdir(jobDir, { recursive: true })
  const promptPath = join(jobDir, 'prompt.md')
  const logPath = join(jobDir, 'codex.log')
  const statusPath = join(jobDir, 'status.json')
  await writeFile(promptPath, remediationPrompt({ journey, runDir, briefing, metadata, input }))
  await writeFile(statusPath, JSON.stringify({
    journeyId: journey.id,
    title: journey.title,
    runDir,
    promptPath,
    logPath,
    status: 'prepared',
    preparedAt: new Date().toISOString(),
  }, null, 2))
  return { jobDir, promptPath, logPath, statusPath }
}

async function startCodex({ cwd, model, promptPath, logPath, detach }) {
  const args = [
    'exec',
    '--dangerously-bypass-approvals-and-sandbox',
    '-m',
    model,
    '-C',
    cwd,
  ]
  if (detach) {
    const outFd = openSync(logPath, 'a')
    const child = spawn('sh', ['-c', 'prompt="$1"; shift; codex "$@" < "$prompt"', 'codex-remediate', promptPath, ...args], {
      cwd,
      env: process.env,
      detached: true,
      stdio: ['ignore', outFd, outFd],
    })
    child.unref()
    return { pid: child.pid, code: null }
  }

  const child = spawn('codex', args, {
    cwd,
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  child.stdin.end(await readFile(promptPath, 'utf8'))
  let output = ''
  child.stdout.on('data', (chunk) => { output += chunk.toString() })
  child.stderr.on('data', (chunk) => { output += chunk.toString() })
  const code = await new Promise((resolve) => child.on('exit', resolve))
  await writeFile(logPath, output)
  return { pid: null, code }
}

async function main() {
  const options = parseArgs()
  if (!['current', 'worktree'].includes(options.mode)) {
    throw new Error(`Unsupported remediation mode "${options.mode}". Use --mode=current or --mode=worktree.`)
  }
  if (options.detach && options.mode !== 'worktree') {
    throw new Error('Detached remediation requires --mode=worktree. Use --execute for sequential current-branch remediation.')
  }
  await mkdir(options.remediationRoot, { recursive: true })
  const selected = []

  if (options.explicitRuns.length > 0) {
    for (const runDir of options.explicitRuns) {
      const journeyId = basename(resolve(runDir, '..'))
      const journey = getDashboardJourney(journeyId)
      if (!journey) throw new Error(`Could not infer known journey from run path ${runDir}`)
      selected.push({ journey, runDir })
    }
  } else {
    for (const id of options.ids) {
      selected.push(await collectRun(options.outRoot, id))
    }
  }

  const launched = []
  for (const item of selected) {
    const briefingPath = join(item.runDir, 'briefing.md')
    if (!existsSync(briefingPath)) {
      throw new Error(`Missing briefing for ${item.journey.id}: ${briefingPath}`)
    }
    const [briefing, metadata, input] = await Promise.all([
      readFile(briefingPath, 'utf8'),
      readFile(join(item.runDir, 'metadata.json'), 'utf8').catch(() => '{}'),
      readFile(join(item.runDir, 'input.json'), 'utf8').catch(() => '{}'),
    ])
    const verdict = extractVerdict(briefing)
    if (options.onlyVerdicts && !options.onlyVerdicts.includes(verdict)) {
      console.log(`Skipping ${item.journey.id}: verdict ${verdict}`)
      continue
    }

    const job = await writeJobFiles({
      journey: item.journey,
      runDir: item.runDir,
      briefing,
      metadata,
      input,
      remediationRoot: options.remediationRoot,
    })
    const plannedBranch = safeBranchName(`codex/dashboard-journey-${item.journey.id.toLowerCase()}-remediation`)
    const plannedWorktreePath = join(options.remediationRoot, 'worktrees', item.journey.id)
    const work = options.dryRun
      ? {
          branch: options.mode === 'worktree' ? plannedBranch : currentBranch(),
          worktreePath: options.mode === 'worktree' ? plannedWorktreePath : process.cwd(),
          created: false,
        }
      : options.mode === 'worktree'
        ? await ensureWorktree(item.journey.id, options.remediationRoot)
        : { branch: currentBranch(), worktreePath: process.cwd(), created: false }
    const command = `codex exec --dangerously-bypass-approvals-and-sandbox -m ${options.model} -C ${JSON.stringify(work.worktreePath)} < ${job.promptPath}`

    if (options.dryRun) {
      console.log(`[dry-run] ${item.journey.id} ${item.journey.title}`)
      console.log(`  verdict: ${verdict}`)
      console.log(`  prompt: ${job.promptPath}`)
      console.log(`  cwd: ${work.worktreePath}`)
      console.log(`  branch: ${work.branch}`)
      console.log(`  command: ${command}`)
      continue
    }

    await writeFile(job.statusPath, JSON.stringify({
      journeyId: item.journey.id,
      title: item.journey.title,
      verdict,
      runDir: item.runDir,
      promptPath: job.promptPath,
      logPath: job.logPath,
      branch: work.branch,
      worktreePath: work.worktreePath,
      status: options.detach ? 'started' : 'running',
      startedAt: new Date().toISOString(),
    }, null, 2))

    console.log(`Starting ${item.journey.id}: ${item.journey.title}`)
    const result = await startCodex({
      cwd: work.worktreePath,
      model: options.model,
      promptPath: job.promptPath,
      logPath: job.logPath,
      detach: options.detach,
    })
    await writeFile(job.statusPath, JSON.stringify({
      journeyId: item.journey.id,
      title: item.journey.title,
      verdict,
      runDir: item.runDir,
      promptPath: job.promptPath,
      logPath: job.logPath,
      branch: work.branch,
      worktreePath: work.worktreePath,
      status: options.detach ? 'started' : result.code === 0 ? 'completed' : 'failed',
      pid: result.pid,
      exitCode: result.code,
      updatedAt: new Date().toISOString(),
    }, null, 2))
    launched.push({ journeyId: item.journey.id, ...result })
    console.log(options.detach
      ? `Started ${item.journey.id} pid=${result.pid} log=${job.logPath}`
      : `Finished ${item.journey.id} exit=${result.code} log=${job.logPath}`)
  }

  await writeFile(join(options.remediationRoot, 'manifest.json'), JSON.stringify({
    generatedAt: new Date().toISOString(),
    outRoot: options.outRoot,
    remediationRoot: options.remediationRoot,
    model: options.model,
    mode: options.mode,
    dryRun: options.dryRun,
    detach: options.detach,
    count: launched.length,
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
