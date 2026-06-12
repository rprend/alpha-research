import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const wantsLive = args.has('--live')
const confirmedLive = args.has('--confirm-live')
const maxIterations = Number(args.get('--max-iterations') ?? 10)
const wavesPerIteration = Number(args.get('--waves-per-iteration') ?? 1)
const maxCostUsd = Number(args.get('--max-cost-usd') ?? 5)
const stopUsefulAccounts = Number(args.get('--stop-useful-accounts') ?? 50000)
const stopExcellentAccounts = Number(args.get('--stop-excellent-accounts') ?? 5000)
const stopReviewDecisions = Number(args.get('--stop-review-decisions') ?? 500)
const envFile = args.get('--env-file') ? String(args.get('--env-file')) : null

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runStep(id, command, stepArgs = []) {
  const startedAt = new Date().toISOString()
  const commandText = [command, ...stepArgs].join(' ')
  try {
    const stdout = execFileSync(command, stepArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    return {
      id,
      command: commandText,
      status: 'pass',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      output_tail: stdout.split('\n').filter(Boolean).slice(-20),
    }
  } catch (error) {
    return {
      id,
      command: commandText,
      status: 'fail',
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      error: error.message,
      stdout_tail: String(error.stdout ?? '').split('\n').filter(Boolean).slice(-20),
      stderr_tail: String(error.stderr ?? '').split('\n').filter(Boolean).slice(-20),
    }
  }
}

function readinessCounts() {
  const readiness = readJson(join(reportsDir, 'readiness.json'), {})
  return {
    useful_accounts: Number(readiness.counts?.useful_accounts ?? 0),
    excellent_accounts: Number(readiness.counts?.excellent_accounts ?? 0),
    review_decisions: Number(readiness.counts?.review_decisions ?? 0),
    complete: Boolean(readiness.complete),
  }
}

function targetsMet(counts) {
  return counts.complete ||
    (counts.useful_accounts >= stopUsefulAccounts &&
      counts.excellent_accounts >= stopExcellentAccounts &&
      counts.review_decisions >= stopReviewDecisions)
}

function liveArgs(remainingCost) {
  const stepArgs = [
    'docs/experiments/tiktok-creative-creator-graph/scripts/run-live-manifest.mjs',
    `--max-waves=${wavesPerIteration}`,
    `--max-cost-usd=${remainingCost.toFixed(2)}`,
  ]
  if (envFile) stepArgs.push(`--env-file=${envFile}`)
  if (wantsLive) {
    stepArgs.push('--live')
    if (confirmedLive) stepArgs.push('--confirm-live')
  } else {
    stepArgs.push('--skip-import', '--skip-rebuild')
  }
  return stepArgs
}

function assertCampaignAllowed() {
  if (maxIterations < 1) throw new Error('--max-iterations must be at least 1')
  if (wavesPerIteration < 1) throw new Error('--waves-per-iteration must be at least 1')
  if (maxCostUsd <= 0) throw new Error('--max-cost-usd must be greater than 0')
  if (wantsLive && !confirmedLive) {
    throw new Error('Live scale campaign requires --confirm-live. Omit --live for a guarded dry run.')
  }
}

function main() {
  assertCampaignAllowed()
  ensureDir(reportsDir)

  const startedAt = new Date().toISOString()
  const bootstrap = runStep('bootstrap_full_workflow', 'node', ['docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs'])
  const iterations = []
  let spent = 0
  let stopReason = bootstrap.status === 'pass' ? '' : 'bootstrap_failed'
  let counts = readinessCounts()

  if (!stopReason && targetsMet(counts)) stopReason = 'targets_met'

  for (let index = 0; !stopReason && index < maxIterations; index += 1) {
    const remainingCost = maxCostUsd - spent
    if (remainingCost <= 0) {
      stopReason = 'budget_exhausted'
      break
    }

    const run = runStep(`manifest_run_${index + 1}`, 'node', liveArgs(remainingCost))
    const manifestRun = readJson(join(reportsDir, 'live-manifest-run.json'), {})
    spent = Number((spent + Number(manifestRun.estimated_cost_usd ?? 0)).toFixed(2))
    counts = readinessCounts()

    iterations.push({
      sequence: index + 1,
      status: run.status,
      mode: manifestRun.mode ?? (wantsLive ? 'live' : 'dry_run'),
      selected_waves: manifestRun.selected_waves ?? 0,
      selected_wave_ids: manifestRun.selected_wave_ids ?? [],
      estimated_cost_usd: Number(manifestRun.estimated_cost_usd ?? 0),
      cumulative_estimated_cost_usd: spent,
      import_ran: Boolean(manifestRun.import_ran),
      rebuild_ran: Boolean(manifestRun.rebuild_ran),
      counts_after: counts,
      command: run.command,
      result: run,
    })

    if (run.status !== 'pass') {
      stopReason = 'manifest_run_failed'
      break
    }
    if (!wantsLive) {
      stopReason = 'dry_run_complete'
      break
    }
    if (targetsMet(counts)) {
      stopReason = 'targets_met'
      break
    }
    if (Number(manifestRun.selected_waves ?? 0) === 0) {
      stopReason = 'no_waves_selected'
      break
    }
  }

  if (!stopReason) stopReason = 'iteration_limit_reached'

  const summary = {
    generated_at: new Date().toISOString(),
    started_at: startedAt,
    mode: wantsLive ? 'live' : 'dry_run',
    live_confirmed: confirmedLive,
    max_iterations: maxIterations,
    waves_per_iteration: wavesPerIteration,
    max_cost_usd: maxCostUsd,
    estimated_cost_usd: spent,
    stop_targets: {
      useful_accounts: stopUsefulAccounts,
      excellent_accounts: stopExcellentAccounts,
      review_decisions: stopReviewDecisions,
    },
    stop_reason: stopReason,
    complete: stopReason === 'targets_met',
    bootstrap,
    iterations,
    final_counts: counts,
  }

  writeFileSync(join(reportsDir, 'scale-campaign-run.json'), `${JSON.stringify(summary, null, 2)}\n`)
  writeFileSync(join(reportsDir, 'scale-campaign-run.md'), `# Scale Campaign Run

Generated: ${summary.generated_at}

- Mode: ${summary.mode}
- Live confirmed: ${summary.live_confirmed}
- Max iterations: ${summary.max_iterations}
- Waves per iteration: ${summary.waves_per_iteration}
- Max cost: $${summary.max_cost_usd}
- Estimated cost: $${summary.estimated_cost_usd}
- Stop reason: ${summary.stop_reason}
- Complete: ${summary.complete}
- Useful accounts: ${summary.final_counts.useful_accounts}/${summary.stop_targets.useful_accounts}
- Excellent accounts: ${summary.final_counts.excellent_accounts}/${summary.stop_targets.excellent_accounts}
- Review decisions: ${summary.final_counts.review_decisions}/${summary.stop_targets.review_decisions}

## Iterations

${iterations.map((iteration) => `- ${iteration.sequence}: ${iteration.status}, ${iteration.selected_waves} wave(s), $${iteration.estimated_cost_usd}, ${iteration.selected_wave_ids.join('|') || 'none'}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (bootstrap.status !== 'pass' || iterations.some((iteration) => iteration.status !== 'pass')) process.exitCode = 1
}

main()
