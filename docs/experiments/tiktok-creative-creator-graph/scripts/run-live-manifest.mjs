import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxWaves = Number(args.get('--max-waves') ?? 1)
const maxCostUsd = Number(args.get('--max-cost-usd') ?? 5)
const envFile = String(args.get('--env-file') ?? join(homedir(), '.codex/secrets.env'))
const wantsLive = args.has('--live')
const confirmedLive = args.has('--confirm-live')
const skipImport = args.has('--skip-import')
const skipRebuild = args.has('--skip-rebuild')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`Could not parse ${path}:${index + 1}: ${error.message}`)
    }
  })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function loadEnvFile(path) {
  if (!existsSync(path)) return false
  const lines = readFileSync(path, 'utf8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
    if (!match) continue
    const [, key, rawValue] = match
    if (process.env[key]) continue
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '')
  }
  return true
}

function splitCommand(command) {
  return String(command).split(/\s+/).filter(Boolean)
}

function runCommand(id, commandText) {
  const [command, ...commandArgs] = splitCommand(commandText)
  const startedAt = new Date().toISOString()
  try {
    const stdout = execFileSync(command, commandArgs, {
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

function selectRows(rows) {
  const selected = []
  let cost = 0
  for (const row of rows.filter((candidate) => candidate.ready)) {
    const nextCost = cost + Number(row.estimated_cost_usd ?? 0)
    if (selected.length >= maxWaves) break
    if (nextCost > maxCostUsd) break
    selected.push(row)
    cost = nextCost
  }
  return selected
}

function assertRunAllowed(manifest, selectedRows) {
  if (!manifest?.within_budget) {
    throw new Error('Live manifest execution requires a passing live-run manifest within budget.')
  }
  if (wantsLive && !confirmedLive) {
    throw new Error('Live manifest execution requires --confirm-live. Omit --live for guarded dry-run sequencing.')
  }
  if (wantsLive && manifest.provider === 'apify' && !process.env.APIFY_TOKEN) {
    throw new Error('Live manifest execution requires APIFY_TOKEN in the environment.')
  }
}

function main() {
  ensureDir(reportsDir)
  const envFileLoaded = loadEnvFile(envFile)
  const manifest = readJson(join(reportsDir, 'live-run-manifest.json'), {})
  const rows = readJsonl(join(processedDir, 'live_run_manifest.jsonl'))
  const selectedRows = selectRows(rows)
  assertRunAllowed(manifest, selectedRows)

  const steps = []
  for (const row of selectedRows) {
    const command = wantsLive ? row.live_command : row.dry_run_command
    steps.push({
      kind: wantsLive ? 'live_wave' : 'dry_run_wave',
      wave_id: row.wave_id,
      sequence: row.sequence,
      estimated_cost_usd: row.estimated_cost_usd,
      command,
      result: runCommand(`${wantsLive ? 'live' : 'dry'}_${row.wave_id}`, command),
    })
    if (steps.at(-1).result.status !== 'pass') break
  }

  const waveStepsPassed = steps.every((step) => step.result.status === 'pass')
  const postSteps = []
  if (waveStepsPassed && wantsLive && !skipImport) {
    postSteps.push(runCommand('import_acquisition_results', 'node docs/experiments/tiktok-creative-creator-graph/scripts/import-acquisition-results.mjs'))
  }
  if (waveStepsPassed && wantsLive && !skipRebuild) {
    postSteps.push(runCommand('run_full_workflow', 'node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs'))
  }

  const summary = {
    generated_at: new Date().toISOString(),
    mode: wantsLive ? 'live' : 'dry_run',
    live_confirmed: confirmedLive,
    provider: manifest.provider ?? '',
    env_file_loaded: envFileLoaded,
    provider_token_available: manifest.provider === 'apify' ? Boolean(process.env.APIFY_TOKEN) : true,
    selected_waves: selectedRows.length,
    max_waves: maxWaves,
    estimated_cost_usd: Number(selectedRows.reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0).toFixed(2)),
    max_cost_usd: maxCostUsd,
    selected_wave_ids: selectedRows.map((row) => row.wave_id),
    skipped_reason: selectedRows.length ? '' : 'no_ready_manifest_rows',
    complete: selectedRows.length === 0 || (waveStepsPassed && postSteps.every((step) => step.status === 'pass')),
    import_ran: postSteps.some((step) => step.id === 'import_acquisition_results'),
    rebuild_ran: postSteps.some((step) => step.id === 'run_full_workflow'),
    steps,
    post_steps: postSteps,
  }

  writeJson(join(reportsDir, 'live-manifest-run.json'), summary)
  writeJsonl(join(processedDir, 'live_manifest_run_steps.jsonl'), [
    ...steps.map((step) => ({
      kind: step.kind,
      wave_id: step.wave_id,
      sequence: step.sequence,
      estimated_cost_usd: step.estimated_cost_usd,
      command: step.command,
      status: step.result.status,
      started_at: step.result.started_at,
      finished_at: step.result.finished_at,
    })),
    ...postSteps.map((step) => ({
      kind: 'post_step',
      wave_id: '',
      sequence: '',
      estimated_cost_usd: '',
      command: step.command,
      status: step.status,
      started_at: step.started_at,
      finished_at: step.finished_at,
    })),
  ])
  writeFileSync(join(reportsDir, 'live-manifest-run.md'), `# Live Manifest Run

Generated: ${summary.generated_at}

- Mode: ${summary.mode}
- Provider: ${summary.provider}
- Env file loaded: ${summary.env_file_loaded}
- Provider token available: ${summary.provider_token_available}
- Selected waves: ${summary.selected_waves}
- Skipped reason: ${summary.skipped_reason || 'none'}
- Estimated cost: $${summary.estimated_cost_usd}
- Max cost: $${summary.max_cost_usd}
- Complete: ${summary.complete}
- Import ran: ${summary.import_ran}
- Rebuild ran: ${summary.rebuild_ran}

## Wave Steps

${steps.map((step) => `- ${step.wave_id}: ${step.result.status} (\`${step.command}\`)`).join('\n') || '- None'}

## Post Steps

${postSteps.map((step) => `- ${step.id}: ${step.status} (\`${step.command}\`)`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.complete) process.exitCode = 1
}

main()
