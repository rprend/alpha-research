import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const provider = String(args.get('--provider') ?? 'apify')
const envFile = String(args.get('--env-file') ?? join(homedir(), '.codex/secrets.env'))
const maxWaves = Number(args.get('--max-waves') ?? 10)
const limit = Number(args.get('--limit') ?? 100)
const targetCostPerTaskUsd = Number(args.get('--cost-per-task-usd') ?? 0.25)
const budgetUsd = Number(args.get('--budget-usd') ?? 25)

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function writeCsv(path, rows) {
  if (!rows.length) {
    writeFileSync(path, '')
    return
  }
  const headers = Object.keys(rows[0])
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function renderTemplate(value, task) {
  if (Array.isArray(value)) return value.map((item) => renderTemplate(item, task))
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, renderTemplate(item, task)]))
  }
  if (typeof value === 'string') {
    if (value === '{{limit}}') return limit
    return value.replaceAll('{{query}}', task.query)
  }
  return value
}

function main() {
  const adapters = readJson(join(configDir, 'provider-adapters.json'))
  const adapter = adapters[provider]
  if (!adapter) throw new Error(`No provider adapter configured for ${provider}`)
  const envFileLoaded = loadEnvFile(envFile)
  const providerTokenAvailable = provider === 'apify' ? Boolean(process.env.APIFY_TOKEN) : true
  const acquisitionRunHistory = readJsonl(join(processedDir, 'acquisition_run_history.jsonl'))
  const providerHistory = acquisitionRunHistory.filter((row) => row.provider === provider && !row.dry_run)
  const providerZeroYieldRuns = providerHistory.filter((row) => Number(row.output_rows ?? 0) === 0 && Number(row.failed ?? 0) === 0)
  const latestProviderRun = providerHistory.at(-1)
  const providerViability = provider === 'apify' && !providerTokenAvailable
    ? 'missing_token'
    : providerZeroYieldRuns.length > 0 && !providerHistory.some((row) => Number(row.output_rows ?? 0) > 0)
      ? 'zero_yield_observed'
      : 'ready'

  const tasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))
  const taskById = new Map(tasks.map((task) => [task.batch_id, task]))
  const ledger = readJsonl(join(processedDir, 'wave_ledger.jsonl'))
  const selectedWaves = ledger.filter((wave) => wave.status === 'planned').slice(0, maxWaves)

  const rows = []
  for (const wave of selectedWaves) {
    const waveTasks = [taskById.get(wave.primary_task_id), taskById.get(wave.secondary_task_id)].filter(Boolean)
    for (const task of waveTasks) {
      const actor = adapter.actors[task.acquisition_surface]
      const ready = Boolean(actor) && providerViability !== 'missing_token'
      rows.push({
        wave_id: wave.wave_id,
        sequence: wave.sequence,
        provider,
        batch_id: task.batch_id,
        acquisition_surface: task.acquisition_surface,
        target_label: task.target_label ?? wave.primary_category ?? '',
        query: task.query,
        actor_id: actor?.actor_id ?? '',
        ready,
        provider_viability: providerViability,
        block_reason: ready ? '' : !actor ? `No ${provider} actor configured for ${task.acquisition_surface}` : `Provider ${provider} blocked: ${providerViability}`,
        requested_limit: limit,
        estimated_result_rows: ready ? limit : 0,
        estimated_cost_usd: ready ? Number(targetCostPerTaskUsd.toFixed(2)) : 0,
        input_json: ready ? JSON.stringify(renderTemplate(actor.input_template, task)) : '',
      })
    }
  }

  const estimatedCost = rows.reduce((sum, row) => sum + Number(row.estimated_cost_usd), 0)
  const readyRows = rows.filter((row) => row.ready)
  const blockedRows = rows.filter((row) => !row.ready)
  const summary = {
    generated_at: new Date().toISOString(),
    provider,
    env_file_loaded: envFileLoaded,
    provider_token_available: providerTokenAvailable,
    provider_viability: providerViability,
    provider_live_runs: providerHistory.length,
    provider_zero_yield_runs: providerZeroYieldRuns.length,
    latest_provider_output_rows: latestProviderRun?.output_rows ?? '',
    max_waves: maxWaves,
    selected_waves: selectedWaves.length,
    task_rows: rows.length,
    ready_tasks: readyRows.length,
    blocked_tasks: blockedRows.length,
    requested_limit_per_task: limit,
    estimated_result_rows: rows.reduce((sum, row) => sum + Number(row.estimated_result_rows), 0),
    pricing_assumption: {
      cost_per_task_usd: targetCostPerTaskUsd,
      budget_usd: budgetUsd,
    },
    estimated_cost_usd: Number(estimatedCost.toFixed(2)),
    within_budget: estimatedCost <= budgetUsd,
    next_wave: selectedWaves[0]?.wave_id ?? '',
    next_command: selectedWaves[0]?.run_command ?? '',
    blocked_rows: blockedRows,
    first_rows: rows.slice(0, 20),
  }

  writeJson(join(reportsDir, 'provider-preflight.json'), summary)
  writeJsonl(join(processedDir, 'provider_preflight.jsonl'), rows)
  writeCsv(join(processedDir, 'provider_preflight.csv'), rows)
  writeFileSync(join(reportsDir, 'provider-preflight.md'), `# Provider Preflight

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Provider viability: ${summary.provider_viability}
- Provider token available: ${summary.provider_token_available}
- Provider live runs: ${summary.provider_live_runs}
- Provider zero-yield runs: ${summary.provider_zero_yield_runs}
- Latest provider output rows: ${summary.latest_provider_output_rows === '' ? 'n/a' : summary.latest_provider_output_rows}
- Selected waves: ${summary.selected_waves}
- Task rows: ${summary.task_rows}
- Ready tasks: ${summary.ready_tasks}
- Blocked tasks: ${summary.blocked_tasks}
- Requested limit per task: ${summary.requested_limit_per_task}
- Estimated result rows: ${summary.estimated_result_rows}
- Estimated cost: $${summary.estimated_cost_usd}
- Budget: $${summary.pricing_assumption.budget_usd}
- Within budget: ${summary.within_budget}
- Next wave: ${summary.next_wave || 'none'}

Next command:

\`\`\`bash
${summary.next_command || 'No planned waves available.'}
\`\`\`

## First Rows

| Wave | Batch | Surface | Query | Actor | Ready | Viability | Est. rows | Est. cost |
| --- | --- | --- | --- | --- | --- | --- | ---: | ---: |
${summary.first_rows.map((row) => `| ${row.wave_id} | ${row.batch_id} | ${row.acquisition_surface} | ${row.query} | ${row.actor_id} | ${row.ready} | ${row.provider_viability} | ${row.estimated_result_rows} | $${row.estimated_cost_usd} |`).join('\n')}

Full preflight: \`data/processed/provider_preflight.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
  if (estimatedCost > budgetUsd) process.exitCode = 1
}

main()
