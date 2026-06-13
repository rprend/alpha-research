import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxQueries = Number(args.get('--max-queries') ?? 10)
const maxResultsPerQuery = Number(args.get('--max-results-per-query') ?? 10)
const minFrontierRank = Number(args.get('--min-rank') ?? 1)
const maxFrontierRank = Number(args.get('--max-rank') ?? 100)
const provider = String(args.get('--provider') ?? 'duckduckgo_html')
const dryRun = args.has('--dry-run')

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJsonl(path) {
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

function decodeEntities(value) {
  return String(value ?? '')
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'")
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

function stripTags(value) {
  return decodeEntities(String(value ?? '').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const handle = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1] ?? ''
  return handle ? `@${handle.toLowerCase()}` : ''
}

function normalizeTikTokProfileUrl(value) {
  const handle = normalizeHandle(value)
  return handle ? `https://www.tiktok.com/${handle}` : ''
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

function extractDuckDuckGoResults(html, query) {
  const rows = []
  const blocks = html.split(/<div class="result[^"]*">/g).slice(1)
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/)
    if (!anchor) continue
    const url = duckDuckGoResultUrlFromHref(anchor[1])
    const handle = normalizeHandle(url)
    if (!handle) continue
    const snippetMatch = block.match(/<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>|<div[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/div>/)
    rows.push({
      query,
      title: stripTags(anchor[2]),
      snippet: stripTags(snippetMatch?.[1] ?? snippetMatch?.[2] ?? ''),
      url,
      profile_url: normalizeTikTokProfileUrl(url),
      handle,
    })
  }
  return rows
}

function extractBingResults(html, query) {
  const rows = []
  const blocks = html.split(/<li class="b_algo"/g).slice(1)
  for (const block of blocks) {
    const anchor = block.match(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i)
    if (!anchor) continue
    const url = bingResultUrlFromHref(anchor[1])
    const handle = normalizeHandle(url)
    if (!handle) continue
    const snippetMatch = block.match(/<p[^>]*>([\s\S]*?)<\/p>/i)
    rows.push({
      query,
      title: stripTags(anchor[2]),
      snippet: stripTags(snippetMatch?.[1] ?? ''),
      url,
      profile_url: normalizeTikTokProfileUrl(url),
      handle,
    })
  }
  return rows
}

function extractResults(html, query) {
  assertSearchResponseUsable(html, query)
  if (provider === 'duckduckgo_html') return extractDuckDuckGoResults(html, query)
  if (provider === 'bing_html') return extractBingResults(html, query)
  throw new Error(`Unsupported search provider: ${provider}`)
}

function searchQueryFor(frontier) {
  const target = String(frontier.target ?? '').trim()
  if (/site:tiktok\.com\/@/i.test(target)) return target
  if (frontier.acquisition_surface === 'cross_platform_search') {
    return /tiktok\.com\/@/i.test(target) ? target : `${target} "tiktok.com/@"`
  }
  return `site:tiktok.com/@ ${target}`
}

async function search(frontier) {
  const query = searchQueryFor(frontier)
  const url = provider === 'bing_html'
    ? `https://www.bing.com/search?q=${encodeURIComponent(query)}`
    : `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  const response = await fetch(url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-tiktok-frontier/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`${provider} request failed ${response.status}`)
  return extractResults(await response.text(), query)
}

function selectedFrontierRows() {
  const rows = readJsonl(join(processedDir, 'candidate_frontier.jsonl'))
  return rows
    .filter((row) => Number(row.frontier_rank) >= minFrontierRank && Number(row.frontier_rank) <= maxFrontierRank)
    .filter((row) => ['query', 'search_query'].includes(row.target_kind))
    .filter((row) => ['search_index', 'category_gap_search', 'cross_platform_search'].includes(row.acquisition_surface))
    .slice(0, maxQueries)
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const executionId = new Date().toISOString().replace(/[:.]/g, '-')
  const frontierRows = selectedFrontierRows()
  const outputPath = join(acquisitionResultsDir, `${executionId}-search-frontier.jsonl`)
  const outputRows = []
  const queryReports = []
  const seenHandles = new Set()

  for (const frontier of frontierRows) {
    const startedAt = new Date().toISOString()
    try {
      const searchQuery = searchQueryFor(frontier)
      const results = dryRun ? [] : await search(frontier)
      const limited = results.slice(0, maxResultsPerQuery)
      for (const result of limited) {
        if (seenHandles.has(result.handle)) continue
        seenHandles.add(result.handle)
        outputRows.push({
          ...result,
          source_query: searchQuery,
          acquisition_surface: frontier.acquisition_surface,
          target_label: frontier.target_label ?? '',
          batch_id: String(frontier.source_batch_ids ?? '').split('|').filter(Boolean)[0] ?? '',
          frontier_rank: frontier.frontier_rank,
          frontier_score: frontier.frontier_score,
          provider,
          provider_execution_id: executionId,
        })
      }
      queryReports.push({
        frontier_rank: frontier.frontier_rank,
        query: searchQuery,
        status: dryRun ? 'dry_run' : 'succeeded',
        result_rows: limited.length,
        unique_rows_added: outputRows.length,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      queryReports.push({
        frontier_rank: frontier.frontier_rank,
        query: frontier.target,
        status: 'failed',
        error: error.message,
        result_rows: 0,
        unique_rows_added: outputRows.length,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    }
  }

  if (!dryRun) writeJsonl(outputPath, outputRows)
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    selected_queries: frontierRows.length,
    max_queries: maxQueries,
    max_results_per_query: maxResultsPerQuery,
    output_rows: outputRows.length,
    output_path: dryRun ? '' : outputPath.replace(`${root}/`, ''),
    succeeded_queries: queryReports.filter((row) => row.status === 'succeeded').length,
    failed_queries: queryReports.filter((row) => row.status === 'failed').length,
    first_rows: outputRows.slice(0, 25),
    queries: queryReports,
  }

  writeJson(join(reportsDir, 'search-frontier-run.json'), summary)
  writeFileSync(join(reportsDir, 'search-frontier-run.md'), `# Search Frontier Run

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Selected queries: ${summary.selected_queries}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Succeeded queries: ${summary.succeeded_queries}
- Failed queries: ${summary.failed_queries}

## Queries

${queryReports.map((row) => `- ${row.frontier_rank}: ${row.status}, ${row.result_rows} row(s), ${row.query}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed_queries) process.exitCode = 1
}

main()
