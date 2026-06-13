import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
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
const envFile = String(args.get('--env-file') ?? join(homedir(), '.codex/secrets.env'))
const maxTasks = Number(args.get('--max-tasks') ?? 5)
const limit = Number(args.get('--limit') ?? 100)
const wantsLive = args.has('--live')
const confirmedLive = args.has('--confirm-live')
const dryRun = args.has('--dry-run') || !wantsLive
const recordHistory = wantsLive || args.has('--record-history')
const priorityMax = Number(args.get('--priority-max') ?? 1)
const waveArg = args.get('--wave')

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

const envFileLoaded = loadEnvFile(envFile)
const hasProviderToken = Boolean(process.env.APIFY_TOKEN)

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

function readJsonIfExists(path) {
  if (!existsSync(path)) return null
  return JSON.parse(readFileSync(path, 'utf8'))
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

function decodeEntities(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replace(/&#(x?[0-9a-f]+);/gi, (_match, code) => {
      const radix = String(code).startsWith('x') ? 16 : 10
      const point = Number.parseInt(String(code).replace(/^x/i, ''), radix)
      return Number.isFinite(point) ? String.fromCodePoint(point) : ''
    })
}

function stripTags(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle) return ''
  if (handle.includes('@') || handle.includes('.com')) return ''
  return `@${handle}`
}

function profileUrlFor(value) {
  const handle = normalizeHandle(value)
  return handle ? `https://www.tiktok.com/${handle}` : ''
}

function extractTikTokUrls(text) {
  const urls = []
  const candidates = [String(text ?? '')]
  try {
    candidates.push(decodeURIComponent(String(text ?? '')))
  } catch {
    // Keep the raw value only when it is not URI-encoded.
  }
  const pattern = /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/gi
  for (const match of candidates.join('\n').matchAll(pattern)) {
    const profileUrl = profileUrlFor(match[0].replace(/[),.;]+$/g, ''))
    if (profileUrl) urls.push(profileUrl)
  }
  return Array.from(new Set(urls))
}

function bingResultUrlFromHref(href) {
  const decoded = decodeEntities(href)
  if (decoded.startsWith('/')) return `https://www.bing.com${decoded}`
  return decoded
}

function assertPublicSearchUsable(html, task) {
  const text = stripTags(html).toLowerCase()
  if (/captcha|unusual traffic|verify you are human/.test(text)) {
    throw new Error(`public_web search blocked by verification challenge for ${task.batch_id}`)
  }
}

function rowsFromSearchResult(result, task, seen) {
  const rows = []
  for (const profileUrl of new Set([
    ...extractTikTokUrls(result.url),
    ...extractTikTokUrls(result.title),
    ...extractTikTokUrls(result.snippet),
  ])) {
    const handle = normalizeHandle(profileUrl)
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    rows.push({
      handle,
      profile_url: profileUrl,
      display_name: result.title.replace(/\s+-?\s*on TikTok.*/i, '').trim(),
      bio: result.snippet,
      source_type: task.acquisition_surface === 'cross_platform_search' ? 'cross_platform_search' : 'public_web_search',
      source_name: `Public web acquisition ${task.batch_id}`,
      source_query: task.query,
      source_url: result.url,
      target_label: task.target_label ?? '',
      source_target_labels: task.target_label ? [task.target_label] : [],
      acquisition_surface: task.acquisition_surface,
      provider,
      provider_execution_id: '',
      batch_id: task.batch_id,
    })
  }
  return rows
}

function publicSearchRowsFromHtml(html, task) {
  assertPublicSearchUsable(html, task)
  const rows = []
  const seen = new Set()
  const blocks = String(html).split(/<li class="b_algo"/g).slice(1)

  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    if (!anchor) continue
    const url = bingResultUrlFromHref(anchor[1])
    const title = stripTags(anchor[2])
    const snippet = stripTags(snippetMatch?.[1] ?? '')
    rows.push(...rowsFromSearchResult({ url, title, snippet }, task, seen))
  }

  if (!rows.length) {
    for (const profileUrl of extractTikTokUrls(html)) {
      const handle = normalizeHandle(profileUrl)
      if (!handle || seen.has(handle)) continue
      seen.add(handle)
      rows.push({
        handle,
        profile_url: profileUrl,
        display_name: handle.slice(1),
        bio: '',
        source_type: task.acquisition_surface === 'cross_platform_search' ? 'cross_platform_search' : 'public_web_search',
        source_name: `Public web acquisition ${task.batch_id}`,
        source_query: task.query,
        source_url: '',
        target_label: task.target_label ?? '',
        source_target_labels: task.target_label ? [task.target_label] : [],
        acquisition_surface: task.acquisition_surface,
        provider,
        provider_execution_id: '',
        batch_id: task.batch_id,
      })
    }
  }

  return rows.slice(0, limit)
}

function publicSearchRowsFromRss(xml, task) {
  const rows = []
  const seen = new Set()
  const items = String(xml ?? '').matchAll(/<item>([\s\S]*?)<\/item>/gi)
  for (const itemMatch of items) {
    const item = itemMatch[1]
    rows.push(...rowsFromSearchResult({
      title: decodeEntities(item.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ''),
      snippet: stripTags(item.match(/<description>([\s\S]*?)<\/description>/i)?.[1] ?? ''),
      url: decodeEntities(item.match(/<link>([\s\S]*?)<\/link>/i)?.[1] ?? ''),
    }, task, seen))
  }
  return rows.slice(0, limit)
}

async function runPublicWebSearch(task) {
  const actorId = adapter.actors[task.acquisition_surface]?.actor_id ?? adapter.default_actor_id ?? 'bing_html'
  const rssMode = actorId === 'bing_rss'
  const url = rssMode
    ? `https://www.bing.com/search?format=rss&q=${encodeURIComponent(task.query)}`
    : `https://www.bing.com/search?q=${encodeURIComponent(task.query)}`
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-public-web-acquisition/1.0)',
      accept: rssMode ? 'application/rss+xml,text/xml' : 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`public_web request failed ${response.status}`)
  const body = await response.text()
  const items = rssMode ? publicSearchRowsFromRss(body, task) : publicSearchRowsFromHtml(body, task)
  return {
    run_id: `public_web:${actorId}:${task.batch_id}:${Date.now()}`,
    dataset_id: '',
    status: 'SUCCEEDED',
    items,
  }
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

async function runProviderTask(task, actorConfig) {
  if (provider === 'apify') return runApifyActor(task, actorConfig)
  if (provider === 'public_web' && ['bing_html', 'bing_rss'].includes(actorConfig.actor_id)) return runPublicWebSearch(task)
  throw new Error(`Provider ${provider} cannot execute ${task.acquisition_surface} with actor ${actorConfig.actor_id}`)
}

const adapters = readJson(join(configDir, 'provider-adapters.json'))
const adapter = adapters[provider]
if (!adapter) throw new Error(`No provider adapter configured for ${provider}`)

function assertLiveRunAllowed(selectedWave, tasks) {
  if (dryRun) return
  if (provider === 'apify' && !hasProviderToken) {
    throw new Error('Live provider execution requires APIFY_TOKEN in the environment. Run with --dry-run or provide the token through the configured secrets flow.')
  }
  if (!confirmedLive) {
    throw new Error('Live provider execution requires --confirm-live. Run with --dry-run or pass --live --confirm-live after checking provider preflight.')
  }
  if (provider === 'public_web') return
  if (!selectedWave) {
    throw new Error('Live provider execution requires a specific --wave so spend is tied to the scale wave ledger.')
  }
  const preflight = readJsonIfExists(join(reportsDir, 'provider-preflight.json'))
  const preflightRows = readJsonl(join(processedDir, 'provider_preflight.jsonl'))
  if (!preflight || !preflightRows.length) {
    throw new Error('Live provider execution requires provider preflight. Run build-provider-preflight.mjs first.')
  }
  if (!preflight.within_budget || Number(preflight.blocked_tasks) > 0) {
    throw new Error('Live provider execution blocked: provider preflight is over budget or has blocked tasks.')
  }
  const coveredBatchIds = new Set(preflightRows.filter((row) => row.wave_id === selectedWave.wave_id && row.ready).map((row) => row.batch_id))
  const missing = tasks.filter((task) => !coveredBatchIds.has(task.batch_id)).map((task) => task.batch_id)
  if (missing.length) {
    throw new Error(`Live provider execution blocked: preflight does not cover ${selectedWave.wave_id} task(s): ${missing.join(', ')}`)
  }
}

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
  const candidateTasks = selectedWave ? waveTasks : allTasks.filter((task) => Number(task.priority) <= priorityMax)
  const runnableCandidates = candidateTasks.filter((task) => adapter.actors[task.acquisition_surface])
  const skippedCandidates = candidateTasks.filter((task) => !adapter.actors[task.acquisition_surface])
  const runnableTasks = runnableCandidates.slice(0, maxTasks)
  const remainingSlots = Math.max(0, maxTasks - runnableTasks.length)
  const skippedTasks = skippedCandidates.slice(0, remainingSlots)
  const tasks = [...runnableTasks, ...skippedTasks]
  assertLiveRunAllowed(selectedWave, tasks)

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
      const run = await runProviderTask(task, actorConfig)
      const outputPath = join(acquisitionResultsDir, `${executionId}-${task.batch_id}.jsonl`)
      const rows = provider === 'public_web'
        ? run.items.map((item) => ({ ...item, provider_execution_id: executionId, provider_run_id: run.run_id }))
        : providerRowsForTask(run.items, task, run)
      if (rows.length) writeJsonl(outputPath, rows)
      results.push({
        ...base,
        status: rows.length ? 'succeeded' : 'zero_yield',
        provider_run_id: run.run_id,
        provider_dataset_id: run.dataset_id,
        output_rows: rows.length,
        output_path: rows.length ? outputPath.replace(`${root}/`, '') : '',
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
    env_file_loaded: envFileLoaded,
    provider_token_available: hasProviderToken,
    wave_id: selectedWave?.wave_id ?? '',
    wave_found: waveArg ? Boolean(selectedWave) : null,
    dry_run: dryRun,
    live_requested: wantsLive,
    live_confirmed: confirmedLive,
    history_recorded: recordHistory,
    selected_tasks: tasks.length,
    runnable_tasks: runnableTasks.length,
    skipped_tasks: skippedTasks.length,
    succeeded: results.filter((row) => row.status === 'succeeded').length,
    zero_yield: results.filter((row) => row.status === 'zero_yield').length,
    failed: results.filter((row) => row.status === 'failed').length,
    dry_run_tasks: results.filter((row) => row.status === 'dry_run').length,
    output_rows: results.reduce((sum, row) => sum + Number(row.output_rows ?? 0), 0),
    results,
  }

  writeJson(join(reportsDir, 'acquisition-run.json'), summary)
  if (recordHistory) appendJsonl(join(processedDir, 'acquisition_run_history.jsonl'), summary)
  writeFileSync(join(reportsDir, 'acquisition-run.md'), `# Acquisition Run

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Env file loaded: ${summary.env_file_loaded}
- Provider token available: ${summary.provider_token_available}
- Wave: ${summary.wave_id || 'none'}
- Dry run: ${summary.dry_run}
- Live requested: ${summary.live_requested}
- Live confirmed: ${summary.live_confirmed}
- History recorded: ${summary.history_recorded}
- Selected tasks: ${summary.selected_tasks}
- Runnable tasks: ${summary.runnable_tasks}
- Skipped tasks: ${summary.skipped_tasks}
- Succeeded: ${summary.succeeded}
- Zero-yield: ${summary.zero_yield}
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
