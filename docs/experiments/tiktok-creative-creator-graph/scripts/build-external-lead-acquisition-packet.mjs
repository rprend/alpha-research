import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const reportsDir = join(experimentDir, 'reports')
const processedDir = join(experimentDir, 'data/processed')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')

const defaultAssignments = 120
const defaultLeadTarget = 250
const requiredLeadColumns = [
  'handle',
  'profile_url',
  'display_name',
  'bio',
  'target_label',
  'source_name',
  'source_url',
  'source_query',
  'follower_count',
  'likes_count',
  'video_count',
  'verified',
]

const labelHints = {
  filmmaker: ['short film', 'filmmaker', 'film director', 'film set', 'shot breakdown', '#filmmaker', '#shortfilm'],
  director: ['director reel', 'music video director', 'commercial director', 'directed by', 'writer director'],
  cinematographer: ['cinematographer', 'dp', 'dop', 'lighting breakdown', 'camera test', '#cinematography'],
  editor: ['video editor', 'editing breakdown', 'DaVinci Resolve', 'Premiere Pro', 'color grading'],
  vfx_animation: ['vfx artist', 'animator', 'Blender', 'motion graphics', 'visual effects', '#vfxartist'],
  sketch_comedian: ['sketch comedy', 'character comedy', 'improv', 'comedy sketch', 'original sketch'],
  standup_comedian: ['standup comedian', 'stand-up', 'open mic', 'crowd work', 'comedy club'],
  actor_performer: ['actor', 'performer', 'monologue', 'self tape', 'improv'],
  film_educator: ['film tutorial', 'shot breakdown', 'film school', 'cinema analysis', 'camera tutorial'],
  behind_the_scenes_creator: ['behind the scenes', 'on set', 'set life', 'production diary', 'film crew'],
  creative_technologist: ['ai video', 'Runway', 'Pika', 'creative coding', 'generative ai filmmaker'],
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
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

function queryFor(row) {
  return row.primary_query || row.secondary_query || labelHints[row.primary_category]?.[0] || row.primary_category
}

function surfaceFor(row) {
  return row.primary_surface || row.secondary_surface || 'external_search'
}

function sourceTargetFor(surface) {
  if (surface === 'tiktok_hashtag_export') return 'TikTok hashtag/search result pages'
  if (surface === 'cross_platform_search') return 'Cross-platform pages that expose TikTok profile links'
  if (surface === 'category_gap_search') return 'Search engine result pages for TikTok profile snippets'
  if (surface === 'search_index') return 'Search engine result pages and creator list pages'
  return 'Public pages with TikTok profile links'
}

function importCommand(fileName) {
  return `node docs/experiments/tiktok-creative-creator-graph/scripts/import-external-lead-list.mjs --input=docs/experiments/tiktok-creative-creator-graph/data/raw/external-leads/completed/${fileName}`
}

function compactQuery(query) {
  return String(query ?? '').replace(/^site:tiktok\.com\/@\s*/i, '').replaceAll('"', '').trim()
}

function hashtagFromQuery(query, label) {
  const compact = compactQuery(query)
  const firstToken = compact.split(/\s+/).find((token) => /^[a-z0-9_#-]+$/i.test(token)) ?? label
  return firstToken.replace(/^#/, '').replace(/[^a-z0-9_]/gi, '').toLowerCase()
}

function sourceUrlsFor({ surface, query, label }) {
  const compact = compactQuery(query)
  const urls = [
    `https://www.tiktok.com/search/user?q=${encodeURIComponent(compact || label)}`,
    `https://www.tiktok.com/search/video?q=${encodeURIComponent(compact || label)}`,
  ]

  if (surface === 'tiktok_hashtag_export') {
    urls.unshift(`https://www.tiktok.com/tag/${encodeURIComponent(hashtagFromQuery(query, label))}`)
  }

  urls.push(`https://www.google.com/search?q=${encodeURIComponent(query || `site:tiktok.com/@ ${label}`)}`)
  urls.push(`https://www.bing.com/search?q=${encodeURIComponent(query || `site:tiktok.com/@ ${label}`)}`)

  return Array.from(new Set(urls))
}

function assignmentRows(scaleWaves, categoryCoverage, maxAssignments) {
  const coverageByLabel = new Map((categoryCoverage?.rows ?? []).map((row) => [row.label, row]))
  const sortedWaves = [...scaleWaves].sort((a, b) => Number(a.sequence) - Number(b.sequence))
  return sortedWaves.slice(0, maxAssignments).map((wave, index) => {
    const label = wave.primary_category || 'unclassified'
    const coverage = coverageByLabel.get(label) ?? {}
    const fileName = `${String(index + 1).padStart(4, '0')}-${label}.csv`
    const query = queryFor(wave)
    const surface = surfaceFor(wave)
    const hints = labelHints[label] ?? []
    const sourceUrls = sourceUrlsFor({ surface, query, label })
    return {
      assignment_id: `external_packet_${String(index + 1).padStart(4, '0')}`,
      wave_id: wave.wave_id,
      priority: Number(coverage.recommended_priority ?? 3),
      target_label: label,
      target_useful_creators: Number(coverage.target_useful_creators ?? 0),
      useful_gap: Number(coverage.useful_gap ?? wave.category_useful_gap ?? 0),
      acquisition_surface: surface,
      source_target: sourceTargetFor(surface),
      source_query: query,
      query_hints: hints.join(' | '),
      source_urls: sourceUrls.join(' | '),
      primary_source_url: sourceUrls[0] ?? '',
      lead_target: Number(wave.target_candidate_accounts ?? defaultLeadTarget),
      minimum_accepted_leads: Math.ceil(Number(wave.target_candidate_accounts ?? defaultLeadTarget) * 0.6),
      completed_file_name: fileName,
      required_columns: requiredLeadColumns.join(' | '),
      acceptance_rubric: 'public TikTok profile; original creative work; visible craft/process/finished creative output; not a repost, fan, spam, or brand-only account',
      dedupe_key: 'normalized lowercase TikTok handle',
      import_command: importCommand(fileName),
    }
  })
}

function categoryRows(categoryCoverage) {
  return [...(categoryCoverage?.rows ?? [])]
    .sort((a, b) => Number(a.recommended_priority) - Number(b.recommended_priority) || Number(b.useful_gap) - Number(a.useful_gap))
    .map((row) => ({
      target_label: row.label,
      target_useful_creators: Number(row.target_useful_creators ?? 0),
      current_primary_accounts: Number(row.current_primary_accounts ?? 0),
      useful_primary_accounts: Number(row.useful_primary_accounts ?? 0),
      useful_gap: Number(row.useful_gap ?? 0),
      recommended_priority: Number(row.recommended_priority ?? 0),
      search_hints: (labelHints[row.label] ?? []).join(' | '),
    }))
}

function main() {
  ensureDir(externalLeadsDir)
  const maxAssignmentsArg = process.argv.find((arg) => arg.startsWith('--max-assignments='))
  const maxAssignments = Number(maxAssignmentsArg?.split('=')[1] ?? defaultAssignments)
  const categoryCoverage = readJson(join(reportsDir, 'category-coverage.json'), {})
  const scaleWaves = readJsonl(join(processedDir, 'scale_waves.jsonl'))
  const assignments = assignmentRows(scaleWaves, categoryCoverage, maxAssignments)
  const categories = categoryRows(categoryCoverage)

  const assignmentCsvPath = join(externalLeadsDir, 'acquisition-packet.csv')
  const assignmentJsonlPath = join(externalLeadsDir, 'acquisition-packet.jsonl')
  const categoryCsvPath = join(externalLeadsDir, 'category-targets.csv')
  const reportJsonPath = join(reportsDir, 'external-lead-acquisition-packet.json')
  const reportMdPath = join(reportsDir, 'external-lead-acquisition-packet.md')

  writeCsv(assignmentCsvPath, assignments)
  writeJsonl(assignmentJsonlPath, assignments)
  writeCsv(categoryCsvPath, categories)

  const summary = {
    generated_at: new Date().toISOString(),
    purpose: 'Token-free external acquisition packet for TikTok creative creator leads.',
    target_useful_creators: Number(categoryCoverage.target_useful_creators ?? 50000),
    current_useful_creators: Number(categoryCoverage.total_useful_primary_accounts ?? 0),
    useful_gap: Number(categoryCoverage.total_useful_gap ?? 0),
    assignment_rows: assignments.length,
    lead_target_per_assignment: defaultLeadTarget,
    total_requested_leads: assignments.reduce((sum, row) => sum + row.lead_target, 0),
    category_rows: categories.length,
    uncovered_labels: categoryCoverage.uncovered_labels ?? [],
    required_lead_columns: requiredLeadColumns,
    outputs: {
      assignment_csv: assignmentCsvPath.replace(`${root}/`, ''),
      assignment_jsonl: assignmentJsonlPath.replace(`${root}/`, ''),
      category_csv: categoryCsvPath.replace(`${root}/`, ''),
    },
    source_url_strategy: 'Each assignment includes TikTok user/video search URLs, hashtag URLs when applicable, and search engine URLs for the same source query.',
    first_assignments: assignments.slice(0, 20),
  }

  writeJson(reportJsonPath, summary)
  writeFileSync(reportMdPath, `# External Lead Acquisition Packet

Generated: ${summary.generated_at}

This is the token-free acquisition path. Use it when paid scraper credentials are unavailable or unproductive. Each assignment asks an operator, contractor, or alternate acquisition tool to return TikTok profile leads in the columns accepted by \`import-external-lead-list.mjs\`.

## Current Gap

- Target useful creators: ${summary.target_useful_creators}
- Current useful creators: ${summary.current_useful_creators}
- Useful gap: ${summary.useful_gap}
- Assignment rows: ${summary.assignment_rows}
- Requested leads in this packet: ${summary.total_requested_leads}
- Category rows: ${summary.category_rows}
- Uncovered labels: ${(summary.uncovered_labels ?? []).join(', ') || 'none'}

## Required Completed Lead Columns

\`${requiredLeadColumns.join('`, `')}\`

## Acceptance Rubric

Accept public TikTok profiles with original creative work and visible craft, process, or finished creative output. Reject repost/clip/fan pages, generic lifestyle influencers, brand-only accounts, spam, and profiles where the creator has nothing useful to learn from.

## Operator Workflow

1. Work rows from \`data/raw/external-leads/acquisition-packet.csv\`.
2. For each row, start with \`primary_source_url\` and \`source_urls\`, then expand with \`source_query\` and \`query_hints\` on TikTok, search engines, YouTube, Vimeo, Linktree/Beacons, festival pages, comedy club lineups, creator portfolios, and public lists.
3. Save completed leads as \`data/raw/external-leads/completed/<completed_file_name>\` using the required columns.
4. Run the row's \`import_command\`.
5. Run \`node docs/experiments/tiktok-creative-creator-graph/scripts/run-full-workflow.mjs\`.

## First Assignments

| Assignment | Label | Leads | Surface | Query | Start URL |
| --- | --- | ---: | --- | --- | --- |
${summary.first_assignments.map((row) => `| ${row.assignment_id} | ${row.target_label} | ${row.lead_target} | ${row.acquisition_surface} | ${row.source_query} | ${row.primary_source_url} |`).join('\n')}

Full assignment CSV: \`data/raw/external-leads/acquisition-packet.csv\`
Category target CSV: \`data/raw/external-leads/category-targets.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
