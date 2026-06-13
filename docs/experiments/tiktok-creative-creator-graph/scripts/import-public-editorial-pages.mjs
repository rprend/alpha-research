import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')
const defaultSourceConfigPath = join(experimentDir, 'config/public-editorial-page-sources.json')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRowsPerSource = Number(args.get('--max-rows-per-source') ?? 250)
const dryRun = args.has('--dry-run')
const sourceConfigPath = args.get('--source-config') ? join(root, String(args.get('--source-config'))) : defaultSourceConfigPath
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'public_editorial_page'

const blockedHandles = new Set([
  'abcnetwork',
  'carlsjrofficial',
  'cerave',
  'elfyeah',
  'hrblock',
  'oscars',
  'sky',
  'tiktok',
  'tiktokcreators',
  'tiktoknewsroom',
  'tiktokshop',
])

const labelRules = [
  ['cinematographer', /\b(cinematograph|photograph|camera|lighting|videograph|shot|visual storytelling|commercial video)\b/i],
  ['vfx_animation', /\b(vfx|visual effects|animation|animator|stop motion|cgi|3d|effects|motion|illustrat|design)\b/i],
  ['editor', /\b(editor|editing|edits|video art|post[-\s]?production|transition|after effects|commercial storytelling)\b/i],
  ['director', /\b(director|directing|directed|commercial director|film director|showrunner)\b/i],
  ['filmmaker', /\b(filmmaker|film|filmtok|movietok|short film|cinema|documentary|storytelling|movie|tv)\b/i],
  ['film_educator', /\b(analysis|commentary|educator|learn|explainer|review|watchlist|movie guy|film fan|fandom)\b/i],
  ['standup_comedian', /\b(stand[-\s]?up|comedian|comedy club|comic)\b/i],
  ['sketch_comedian', /\b(sketch|character|impression|parody|comedy|humor|funny|improv)\b/i],
  ['actor_performer', /\b(actor|actress|performer|performance|theatre|theater|choreograph|dance|singer|musician|artist)\b/i],
  ['creative_technologist', /\b(creator|innovator|originator|technology|ai|business|builder|creative)\b/i],
  ['behind_the_scenes_creator', /\b(behind[-\s]?the[-\s]?scenes|bts|on[-\s]?set|industry|red carpet|premiere)\b/i],
]

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  if (!existsSync(path)) throw new Error(`Source config not found: ${path}`)
  return JSON.parse(readFileSync(path, 'utf8'))
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
  const raw = decodeEntities(String(value ?? '')).trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('@') || handle.includes('.com')) return ''
  if (blockedHandles.has(handle)) return ''
  return `@${handle}`
}

function sourceList() {
  const sources = readJson(sourceConfigPath)
  if (!Array.isArray(sources)) throw new Error(`Expected array in ${sourceConfigPath}`)
  const ids = String(args.get('--sources') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  const selected = ids.length ? sources.filter((source) => ids.includes(source.id)) : sources
  const missing = ids.filter((id) => !selected.some((source) => source.id === id))
  if (missing.length) throw new Error(`Unknown public editorial page source id(s): ${missing.join(', ')}`)
  return selected
}

function nearbyText(html, index) {
  const start = Math.max(0, index - 900)
  const end = Math.min(html.length, index + 1400)
  return stripTags(html.slice(start, end))
}

function labelFor(source, context) {
  const text = `${source.source_query} ${source.source_name} ${context}`
  for (const [label, pattern] of labelRules) {
    if (pattern.test(text)) return label
  }
  return source.fallback_label ?? source.target_label
}

function displayNameFor(handle, context) {
  const afterHandle = context.split(handle).at(1) ?? ''
  const beforeDash = afterHandle.match(/^\s*(?:\([^)]+\))?\s*[-–:]\s*([^.,;()]{2,80})/)?.[1]
  if (beforeDash) return beforeDash.trim()
  return handle.slice(1)
}

function rowsFromHtml(source, html) {
  const rows = []
  const seen = new Set()
  const patterns = [
    /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/gi,
    /(?<![A-Za-z0-9._-])@[A-Za-z0-9._-]{2,32}(?![A-Za-z0-9._-])/g,
  ]

  for (const pattern of patterns) {
    for (const match of String(html).matchAll(pattern)) {
      const handle = normalizeHandle(match[0])
      if (!handle || seen.has(handle)) continue
      const context = nearbyText(html, match.index ?? 0)
      const targetLabel = labelFor(source, context)
      seen.add(handle)
      rows.push({
        handle,
        profile_url: `https://www.tiktok.com/${handle}`,
        display_name: displayNameFor(handle, context),
        bio: context.slice(0, 500),
        source_type: 'public_editorial_page',
        source_name: source.source_name,
        source_url: source.url,
        source_query: source.source_query,
        target_label: targetLabel,
        source_target_labels: [targetLabel],
        acquisition_surface: 'public_editorial_page',
        provider,
        provider_execution_id: executionId,
        batch_id: source.id,
        rank: rows.length + 1,
      })
      if (rows.length >= maxRowsPerSource) return rows
    }
  }
  return rows
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-public-editorial-page-import/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`${source.id} request failed ${response.status}`)
  return response.text()
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const outputRows = []
  const sourceReports = []
  const seenHandles = new Set()
  const sources = sourceList()
  const outputPath = join(acquisitionResultsDir, `${executionId}-public-editorial-pages.jsonl`)

  for (const source of sources) {
    const startedAt = new Date().toISOString()
    try {
      const html = dryRun ? '' : await fetchSource(source)
      const rows = dryRun ? [] : rowsFromHtml(source, html)
      let addedRows = 0
      for (const row of rows) {
        if (seenHandles.has(row.handle)) continue
        seenHandles.add(row.handle)
        outputRows.push(row)
        addedRows += 1
      }
      sourceReports.push({
        source_id: source.id,
        source_url: source.url,
        status: dryRun ? 'dry_run' : 'succeeded',
        extracted_rows: rows.length,
        unique_rows_added: addedRows,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      sourceReports.push({
        source_id: source.id,
        source_url: source.url,
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
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    source_config_path: sourceConfigPath.replace(`${root}/`, ''),
    selected_sources: sources.length,
    output_rows: outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    succeeded_sources: sourceReports.filter((row) => row.status === 'succeeded').length,
    failed_sources: sourceReports.filter((row) => row.status === 'failed').length,
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    first_rows: outputRows.slice(0, 25),
    source_reports: sourceReports,
  }

  writeJson(join(reportsDir, 'public-editorial-page-import.json'), summary)
  writeFileSync(join(reportsDir, 'public-editorial-page-import.md'), `# Public Editorial Page Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Selected sources: ${summary.selected_sources}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Succeeded sources: ${summary.succeeded_sources}
- Failed sources: ${summary.failed_sources}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Sources

${sourceReports.map((row) => `- ${row.source_id}: ${row.status}, ${row.extracted_rows} extracted, ${row.unique_rows_added} added, ${row.source_url}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (summary.failed_sources) process.exitCode = 1
}

main()
