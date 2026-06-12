import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')
const defaultSourceConfigPath = join(experimentDir, 'config/editorial-list-sources.json')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRowsPerSource = Number(args.get('--max-rows-per-source') ?? 100)
const dryRun = args.has('--dry-run')
const listSources = args.has('--list-sources')
const provider = 'editorial_list_public_web'
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const sourceConfigPath = args.get('--source-config') ? join(root, String(args.get('--source-config'))) : defaultSourceConfigPath
const keywordLabelRules = [
  ['cinematographer', /\b(cinematograph|photograph|camera|lighting|drone|aerial|shot on|sony|canon|fuji|film look)\b/i],
  ['vfx_animation', /\b(vfx|visual effects|animation|animator|3d|blender|cgi|motion graphics|digital art|illustrat|character design)\b/i],
  ['editor', /\b(editor|editing|edit|post[-\s]?production|color grading|davinci|premiere|after effects)\b/i],
  ['director', /\b(director|directed by|commercial director|film director|music video director)\b/i],
  ['filmmaker', /\b(filmmaker|film|movie|short film|screen|cinema|horror|tv|video creator|documentary)\b/i],
  ['film_educator', /\b(review|explained|breakdown|learn|tutorial|education|teacher|tips|how to|analysis)\b/i],
  ['standup_comedian', /\b(stand[-\s]?up|comedian|comedy special|tour|netflix special)\b/i],
  ['sketch_comedian', /\b(sketch|comedy|parody|character|funny|humor|improv)\b/i],
  ['actor_performer', /\b(actor|actress|performer|theater|theatre|voice actor)\b/i],
  ['creative_technologist', /\b(technology|producer|music producer|sound design|creative tech|software|ai|generative|interactive|tools)\b/i],
  ['behind_the_scenes_creator', /\b(behind the scenes|bts|making of|process|build|setup|workflow)\b/i],
]

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function loadSources() {
  if (!existsSync(sourceConfigPath)) throw new Error(`Editorial list source config not found: ${sourceConfigPath}`)
  const value = readJson(sourceConfigPath)
  if (!Array.isArray(value)) throw new Error(`Editorial list source config must be an array: ${sourceConfigPath}`)
  return value.map((source) => {
    for (const key of ['id', 'url', 'source_query', 'target_label', 'source_name']) {
      if (!source[key]) throw new Error(`Editorial list source is missing ${key}: ${JSON.stringify(source)}`)
    }
    return {
      ...source,
      fallback_label: source.fallback_label ?? source.target_label,
    }
  })
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

function parseFollowers(value) {
  const text = String(value ?? '').replaceAll(',', '').trim()
  const match = text.match(/([0-9]+(?:\.[0-9]+)?)\s*([KMB])?/i)
  if (!match) return 0
  const amount = Number(match[1])
  const unit = match[2]?.toLowerCase()
  const multiplier = unit === 'b' ? 1_000_000_000 : unit === 'm' ? 1_000_000 : unit === 'k' ? 1_000 : 1
  return Number.isFinite(amount) ? Math.round(amount * multiplier) : 0
}

function sectionsFromHtml(html) {
  return String(html).split(/<h3[^>]*>\s*<span[^>]*>\s*\d+\.|<h3[^>]*>\s*\d+\./i).slice(1)
}

function extractName(section) {
  const headingText = stripTags(section.split('</h3>')[0] ?? '')
  return headingText.replace(/^\d+\.\s*/, '').trim()
}

function extractBio(section) {
  const bioMatch = section.match(/<strong>\s*Bio\s*<\/strong>([\s\S]*?)<strong>\s*TikTok Account\s*<\/strong>/i)
  return scrubContactText(stripTags(bioMatch?.[1] ?? ''))
    .replace(/\s+/g, ' ')
    .trim()
}

function scrubContactText(value) {
  return String(value ?? '')
    .replace(/\*{3,}@[^\s]+/g, '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/\b(?:business|contact|email|inquiries?|enquiries?|booking|bookings?)\s*:?\s*/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractTikTokHandle(section) {
  const contextual = [
    section.match(/<strong>\s*TikTok Account\s*<\/strong>[\s\S]{0,400}?data-handle="(@[A-Za-z0-9._-]+)"/i)?.[1],
    section.match(/<strong>\s*TikTok Account\s*<\/strong>[\s\S]{0,400}?href="https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1],
    section.match(/<strong>\s*TikTok Account\s*<\/strong>[\s\S]{0,400}?(@[A-Za-z0-9._-]+)/i)?.[1],
  ]
  for (const value of contextual) {
    const handle = normalizeHandle(value?.startsWith('@') ? value : `@${value}`)
    if (handle) return handle
  }
  return ''
}

function extractFollowers(section) {
  const match = section.match(/<strong>\s*TikTok Followers\s*<\/strong>\s*([^<]+)/i)
  return parseFollowers(stripTags(match?.[1] ?? ''))
}

function labelForSourceRow(source, section, bio, displayName) {
  const text = `${source.source_query} ${source.source_name} ${displayName} ${bio} ${stripTags(section)}`.toLowerCase()
  for (const [label, pattern] of keywordLabelRules) {
    if (pattern.test(text)) return label
  }
  return source.fallback_label ?? source.target_label
}

function extractRowsFromHtml(source, html) {
  const rows = []
  const seen = new Set()
  for (const [index, section] of sectionsFromHtml(html).entries()) {
    const handle = extractTikTokHandle(section)
    if (!handle || seen.has(handle)) continue
    seen.add(handle)
    const displayName = extractName(section) || handle.slice(1)
    const bio = extractBio(section)
    const followerCount = extractFollowers(section)
    const targetLabel = labelForSourceRow(source, section, bio, displayName)
    rows.push({
      handle,
      display_name: displayName,
      bio,
      profile_url: `https://www.tiktok.com/${handle}`,
      follower_count: followerCount,
      source_type: 'editorial_list',
      source_name: source.source_name,
      source_url: source.url,
      source_query: source.source_query,
      target_label: targetLabel,
      source_target_labels: [targetLabel],
      provider,
      provider_execution_id: executionId,
      batch_id: source.id,
      rank: index + 1,
    })
    if (rows.length >= maxRowsPerSource) break
  }
  return rows
}

async function fetchSource(source) {
  const response = await fetch(source.url, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-editorial-list-import/1.0)',
      accept: 'text/html,application/xhtml+xml',
    },
  })
  if (!response.ok) throw new Error(`${source.id} request failed ${response.status}`)
  return response.text()
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const sources = loadSources()
  if (listSources) {
    console.log(JSON.stringify({
      source_config_path: sourceConfigPath.replace(`${root}/`, ''),
      sources: sources.map((source) => ({
        id: source.id,
        target_label: source.target_label,
        fallback_label: source.fallback_label,
        url: source.url,
      })),
    }, null, 2))
    return
  }

  const selectedSourceIds = String(args.get('--sources') ?? '').split(',').map((item) => item.trim()).filter(Boolean)
  const selectedSources = selectedSourceIds.length
    ? sources.filter((source) => selectedSourceIds.includes(source.id))
    : sources
  const missingSourceIds = selectedSourceIds.filter((id) => !selectedSources.some((source) => source.id === id))
  if (missingSourceIds.length) throw new Error(`Unknown editorial list source id(s): ${missingSourceIds.join(', ')}`)
  const outputPath = join(acquisitionResultsDir, `${executionId}-editorial-list-import.jsonl`)
  const outputRows = []
  const sourceReports = []
  const seenHandles = new Set()

  for (const source of selectedSources) {
    const startedAt = new Date().toISOString()
    try {
      const html = dryRun ? '' : await fetchSource(source)
      const sourceRows = dryRun ? [] : extractRowsFromHtml(source, html)
      let addedRows = 0
      for (const row of sourceRows) {
        if (seenHandles.has(row.handle)) continue
        seenHandles.add(row.handle)
        outputRows.push(row)
        addedRows += 1
      }
      sourceReports.push({
        source_id: source.id,
        source_url: source.url,
        status: dryRun ? 'dry_run' : 'succeeded',
        extracted_rows: sourceRows.length,
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

  if (!dryRun) writeJsonl(outputPath, outputRows)
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    selected_sources: selectedSources.length,
    output_rows: outputRows.length,
    output_path: dryRun ? '' : outputPath.replace(`${root}/`, ''),
    source_reports: sourceReports,
    first_rows: outputRows.slice(0, 25),
  }
  writeJson(join(reportsDir, 'editorial-list-import.json'), summary)
  writeFileSync(join(reportsDir, 'editorial-list-import.md'), `# Editorial List Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Selected sources: ${summary.selected_sources}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}

## Sources

${sourceReports.map((row) => `- ${row.source_id}: ${row.status}, ${row.extracted_rows} extracted, ${row.unique_rows_added} added, ${row.source_url}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (sourceReports.some((row) => row.status === 'failed')) process.exitCode = 1
}

main()
