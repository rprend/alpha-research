import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configPath = join(experimentDir, 'config/public-web-search-queries.json')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const provider = String(args.get('--provider') ?? 'duckduckgo_html')
const maxQueries = Number(args.get('--max-queries') ?? 12)
const maxResultsPerQuery = Number(args.get('--max-results-per-query') ?? 25)
const dryRun = args.has('--dry-run')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Config not found: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
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

function normalizeProfileUrl(value) {
  const handle = normalizeHandle(value)
  return handle ? `https://www.tiktok.com/${handle}` : ''
}

function extractTikTokUrls(text) {
  const urls = []
  const pattern = /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/gi
  for (const match of String(text ?? '').matchAll(pattern)) {
    const url = match[0].replace(/[),.;]+$/g, '')
    const profileUrl = normalizeProfileUrl(url)
    if (profileUrl) urls.push(profileUrl)
  }
  return Array.from(new Set(urls))
}

function duckDuckGoResultUrlFromHref(href) {
  const decoded = decodeEntities(href)
  if (decoded.includes('/l/?')) {
    const url = new URL(decoded.startsWith('http') ? decoded : `https://duckduckgo.com${decoded}`)
    return decodeURIComponent(url.searchParams.get('uddg') ?? '')
  }
  return decoded
}

function bingResultUrlFromHref(href) {
  const decoded = decodeEntities(href)
  if (decoded.startsWith('/')) return `https://www.bing.com${decoded}`
  return decoded
}

function assertSearchResponseUsable(html, query) {
  const text = stripTags(html).toLowerCase()
  if (provider === 'duckduckgo_html' && /anomaly|unfortunately|human verification/.test(text)) {
    throw new Error(`duckduckgo_html blocked by anomaly challenge for query: ${query}`)
  }
  if (provider === 'bing_html' && /captcha|unusual traffic|verify you are human/.test(text)) {
    throw new Error(`bing_html blocked by verification challenge for query: ${query}`)
  }
}

function resultRowsFromCandidate(queryConfig, result) {
  const urls = new Set([
    ...extractTikTokUrls(result.url),
    ...extractTikTokUrls(result.title),
    ...extractTikTokUrls(result.snippet),
  ])
  const rows = []
  for (const profileUrl of urls) {
    const handle = normalizeHandle(profileUrl)
    if (!handle) continue
    rows.push({
      handle,
      profile_url: profileUrl,
      display_name: result.title.replace(/\s+-?\s*on TikTok.*/i, '').trim(),
      bio: result.snippet,
      source_type: 'public_web_search',
      source_name: queryConfig.source_name,
      source_query: queryConfig.query,
      source_url: result.url,
      target_label: queryConfig.target_label,
      source_target_labels: [queryConfig.target_label],
      acquisition_surface: 'public_web_search',
      provider,
      provider_execution_id: executionId,
      batch_id: queryConfig.id,
    })
  }
  return rows
}

function extractDuckDuckGoResults(html) {
  const rows = []
  const blocks = html.split(/<div class="result[^"]*">/g).slice(1)
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!anchor) continue
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/)
    rows.push({
      title: stripTags(anchor[2]),
      snippet: stripTags(snippetMatch?.[1] ?? snippetMatch?.[2] ?? ''),
      url: duckDuckGoResultUrlFromHref(anchor[1]),
    })
  }
  return rows
}

function extractBingResults(html) {
  const rows = []
  const blocks = html.split(/<li class="b_algo"/g).slice(1)
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!anchor) continue
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    rows.push({
      title: stripTags(anchor[2]),
      snippet: stripTags(snippetMatch?.[1] ?? ''),
      url: bingResultUrlFromHref(anchor[1]),
    })
  }
  if (!rows.length) {
    const profileUrls = extractTikTokUrls(html)
    return profileUrls.map((url) => ({
      title: normalizeHandle(url),
      snippet: '',
      url,
    }))
  }
  return rows
}

function extractResults(html, queryConfig) {
  assertSearchResponseUsable(html, queryConfig.query)
  const searchRows = provider === 'bing_html' ? extractBingResults(html) : extractDuckDuckGoResults(html)
  return searchRows.flatMap((result) => resultRowsFromCandidate(queryConfig, result))
}

async function search(queryConfig) {
  const url = provider === 'bing_html'
    ? `https://www.bing.com/search?q=${encodeURIComponent(queryConfig.query)}`
    : `https://duckduckgo.com/html/?q=${encodeURIComponent(queryConfig.query)}`
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-public-web-search/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`${provider} request failed ${response.status}`)
  return extractResults(await response.text(), queryConfig)
}

function selectedQueries() {
  const config = readJson(configPath)
  if (!Array.isArray(config.queries)) throw new Error(`Expected queries array in ${configPath}`)
  const ids = String(args.get('--queries') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  const queries = ids.length ? config.queries.filter((query) => ids.includes(query.id)) : config.queries
  const missing = ids.filter((id) => !queries.some((query) => query.id === id))
  if (missing.length) throw new Error(`Unknown public web query id(s): ${missing.join(', ')}`)
  return queries.slice(0, maxQueries)
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const outputRows = []
  const reports = []
  const seenHandles = new Set()
  const queries = selectedQueries()
  const outputPath = join(acquisitionResultsDir, `${executionId}-public-web-search.jsonl`)

  for (const queryConfig of queries) {
    const startedAt = new Date().toISOString()
    try {
      const rows = dryRun ? [] : (await search(queryConfig)).slice(0, maxResultsPerQuery)
      let addedRows = 0
      for (const row of rows) {
        if (seenHandles.has(row.handle)) continue
        seenHandles.add(row.handle)
        outputRows.push(row)
        addedRows += 1
      }
      reports.push({
        query_id: queryConfig.id,
        query: queryConfig.query,
        target_label: queryConfig.target_label,
        status: dryRun ? 'dry_run' : 'succeeded',
        extracted_rows: rows.length,
        unique_rows_added: addedRows,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      reports.push({
        query_id: queryConfig.id,
        query: queryConfig.query,
        target_label: queryConfig.target_label,
        status: 'failed',
        error: error.message,
        extracted_rows: 0,
        unique_rows_added: 0,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    }
  }

  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)
  writeCsv(join(experimentDir, 'data/processed/public_web_search_results.csv'), outputRows)
  writeJsonl(join(experimentDir, 'data/processed/public_web_search_results.jsonl'), outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    selected_queries: queries.length,
    output_rows: outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    succeeded_queries: reports.filter((report) => report.status === 'succeeded').length,
    failed_queries: reports.filter((report) => report.status === 'failed').length,
    first_rows: outputRows.slice(0, 25),
    queries: reports,
  }

  writeJson(join(reportsDir, 'public-web-search.json'), summary)
  writeFileSync(join(reportsDir, 'public-web-search.md'), `# Public Web Search

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Selected queries: ${summary.selected_queries}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Succeeded queries: ${summary.succeeded_queries}
- Failed queries: ${summary.failed_queries}

## Queries

${reports.map((report) => `- ${report.query_id}: ${report.status}, ${report.extracted_rows} extracted, ${report.unique_rows_added} added`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed_queries) process.exitCode = 1
}

main()
