import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const processedDir = join(experimentDir, 'data/processed')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const provider = String(args.get('--provider') ?? 'apify')
const maxTasks = Number(args.get('--max-tasks') ?? 5)
const limit = Number(args.get('--limit') ?? 100)
const dryRun = args.has('--dry-run') || !process.env.APIFY_TOKEN
const priorityMax = Number(args.get('--priority-max') ?? 1)
const waveArg = args.get('--wave')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function appendJsonl(path, row) {
  appendFileSync(path, `${JSON.stringify(row)}\n`)
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

function providerRowsForTask(items, task, run) {
  return items.map((item) => ({
    ...item,
    query: task.query,
    search_query: item.searchQuery?.term ?? item.searchQuery ?? task.query,
    acquisition_surface: task.acquisition_surface,
    target_label: task.target_label ?? '',
    target_label_gap: task.target_label_gap ?? '',
    category_coverage_reason: task.category_coverage_reason ?? '',
    batch_id: task.batch_id,
    provider,
    provider_run_id: run.run_id,
  }))
}

async function apifyJson(path, options = {}) {
  const url = `${adapter.base_url}${path}${path.includes('?') ? '&' : '?'}token=${encodeURIComponent(process.env.APIFY_TOKEN)}`
  const response = await fetch(url, options)
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Apify request failed ${response.status}: ${body.slice(0, 500)}`)
  }
  return response.json()
}

async function runApifyActor(task, actorConfig) {
  const input = renderTemplate(actorConfig.input_template, task)
  const run = await apifyJson(`/acts/${actorConfig.actor_id}/runs`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  const runId = run.data?.id
  if (!runId) throw new Error(`Apify did not return run id for ${task.batch_id}`)

  let finalRun = run
  for (let attempt = 0; attempt < 60; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 5000))
    finalRun = await apifyJson(`/actor-runs/${runId}`)
    const status = finalRun.data?.status
    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) break
  }

  const status = finalRun.data?.status
  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run ${runId} ended with status ${status}`)
  }

  const datasetId = finalRun.data?.defaultDatasetId
  const items = await apifyJson(`/datasets/${datasetId}/items?clean=true&format=json`)
  return {
    run_id: runId,
    dataset_id: datasetId,
    status,
    items: Array.isArray(items) ? items : [],
  }
}

const adapters = readJson(join(configDir, 'provider-adapters.json'))
const adapter = adapters[provider]
if (!adapter) throw new Error(`No provider adapter configured for ${provider}`)

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const allTasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))
  const taskById = new Map(allTasks.map((task) => [task.batch_id, task]))
  const scaleWaves = readJsonl(join(processedDir, 'scale_waves.jsonl'))
  const selectedWave = waveArg
    ? scaleWaves.find((row) => row.wave_id === waveArg || row.wave_id === `scale_wave_${String(waveArg).padStart(4, '0')}`)
    : null
  if (waveArg && !selectedWave) {
    throw new Error(`No scale wave found for --wave=${waveArg}. Run build-scale-waves.mjs first.`)
  }
  const waveTasks = selectedWave
    ? [taskById.get(selectedWave.primary_task_id), taskById.get(selectedWave.secondary_task_id)].filter(Boolean)
    : []
  const tasks = (selectedWave ? waveTasks : allTasks.filter((task) => Number(task.priority) <= priorityMax))
    .slice(0, maxTasks)
  const runnableTasks = tasks.filter((task) => adapter.actors[task.acquisition_surface])
  const skippedTasks = tasks.filter((task) => !adapter.actors[task.acquisition_surface])

  const executionId = new Date().toISOString().replace(/[:.]/g, '-')
  const results = skippedTasks.map((task) => ({
    execution_id: executionId,
    provider,
    batch_id: task.batch_id,
    acquisition_surface: task.acquisition_surface,
    query: task.query,
    target_label: task.target_label ?? '',
    actor_id: '',
    input: {},
    dry_run: true,
    status: 'skipped_no_adapter',
    output_rows: 0,
    output_path: '',
    started_at: new Date().toISOString(),
    finished_at: new Date().toISOString(),
  }))

  for (const task of runnableTasks) {
    const actorConfig = adapter.actors[task.acquisition_surface]
    const input = renderTemplate(actorConfig.input_template, task)
    const base = {
      execution_id: executionId,
      provider,
      batch_id: task.batch_id,
      acquisition_surface: task.acquisition_surface,
      query: task.query,
      target_label: task.target_label ?? '',
      actor_id: actorConfig.actor_id,
      input,
      dry_run: dryRun,
      started_at: new Date().toISOString(),
    }

    if (dryRun) {
      results.push({
        ...base,
        status: 'dry_run',
        output_rows: 0,
        output_path: '',
        finished_at: new Date().toISOString(),
      })
      continue
    }

    try {
      const run = await runApifyActor(task, actorConfig)
      const outputPath = join(acquisitionResultsDir, `${executionId}-${task.batch_id}.jsonl`)
      const rows = providerRowsForTask(run.items, task, run)
      writeJsonl(outputPath, rows)
      results.push({
        ...base,
        status: 'succeeded',
        provider_run_id: run.run_id,
        provider_dataset_id: run.dataset_id,
        output_rows: rows.length,
        output_path: outputPath.replace(`${root}/`, ''),
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      results.push({
        ...base,
        status: 'failed',
        error: error.message,
        output_rows: 0,
        output_path: '',
        finished_at: new Date().toISOString(),
      })
    }
  }

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    wave_id: selectedWave?.wave_id ?? '',
    wave_found: waveArg ? Boolean(selectedWave) : null,
    dry_run: dryRun,
    selected_tasks: tasks.length,
    runnable_tasks: runnableTasks.length,
    skipped_tasks: skippedTasks.length,
    succeeded: results.filter((row) => row.status === 'succeeded').length,
    failed: results.filter((row) => row.status === 'failed').length,
    dry_run_tasks: results.filter((row) => row.status === 'dry_run').length,
    output_rows: results.reduce((sum, row) => sum + Number(row.output_rows ?? 0), 0),
    results,
  }

  writeJson(join(reportsDir, 'acquisition-run.json'), summary)
  appendJsonl(join(processedDir, 'acquisition_run_history.jsonl'), summary)
  writeFileSync(join(reportsDir, 'acquisition-run.md'), `# Acquisition Run

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Wave: ${summary.wave_id || 'none'}
- Dry run: ${summary.dry_run}
- Selected tasks: ${summary.selected_tasks}
- Runnable tasks: ${summary.runnable_tasks}
- Skipped tasks: ${summary.skipped_tasks}
- Succeeded: ${summary.succeeded}
- Failed: ${summary.failed}
- Dry-run tasks: ${summary.dry_run_tasks}
- Output rows: ${summary.output_rows}

## Tasks

| Batch | Surface | Target Label | Query | Status | Rows |
| --- | --- | --- | --- | --- | ---: |
${summary.results.map((row) => `| ${row.batch_id} | ${row.acquisition_surface} | ${row.target_label ?? ''} | ${row.query} | ${row.status} | ${row.output_rows} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed) process.exit(1)
}

main()
