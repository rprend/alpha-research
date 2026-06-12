import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const configDir = join(experimentDir, 'config')
const processedDir = join(experimentDir, 'data/processed')
const acquisitionDir = join(experimentDir, 'data/processed/acquisition')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxItems = Number(args.get('--max-items') ?? 250)

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

function main() {
  ensureDir(acquisitionDir)
  ensureDir(reportsDir)

  const discovery = readJson(join(configDir, 'discovery-queries.json'))
  const expansionQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const creatorScores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const usefulCreators = new Set(creatorScores.filter((row) => ['useful', 'excellent'].includes(row.status)).map((row) => row.creator_id))

  const tasks = []
  let sequence = 1

  for (const query of discovery.search_engine_queries) {
    tasks.push({
      batch_id: `search_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'search_index',
      query,
      priority: 2,
      expected_output: 'candidate TikTok profile URLs',
      import_target: 'data/raw/imports/search-index-export.jsonl',
      notes: 'Use a search API or manual SERP export. Preserve result URL, title, snippet, and query.',
    })
    sequence += 1
  }

  for (const hashtag of discovery.hashtag_queries) {
    tasks.push({
      batch_id: `hashtag_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'tiktok_hashtag_export',
      query: hashtag,
      priority: 1,
      expected_output: 'recent public videos and author profiles for hashtag',
      import_target: 'data/raw/imports/hashtag-export.jsonl',
      notes: 'Export public hashtag results with author, caption, posted_at, metrics, hashtags, mentions, and sound metadata.',
    })
    sequence += 1
  }

  for (const query of discovery.cross_platform_queries) {
    tasks.push({
      batch_id: `cross_platform_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'cross_platform_search',
      query,
      priority: 3,
      expected_output: 'external pages linking to TikTok creator profiles',
      import_target: 'data/raw/imports/cross-platform-export.jsonl',
      notes: 'Use this for serious-creator evidence and identity resolution.',
    })
    sequence += 1
  }

  for (const row of expansionQueue.filter((item) => item.priority <= 2).slice(0, maxItems)) {
    tasks.push({
      batch_id: `graph_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: row.expansion_type === 'resolve_mentioned_creator' ? 'tiktok_profile_export' : 'tiktok_creator_neighborhood_export',
      query: row.target,
      priority: row.priority,
      expected_output: row.expansion_type === 'resolve_mentioned_creator' ? 'public creator profile and recent videos' : 'mentions, hashtags, collaborators, sounds, and recent videos',
      import_target: 'data/raw/imports/graph-expansion-export.jsonl',
      notes: row.reason,
    })
    sequence += 1
  }

  const sorted = tasks.sort((a, b) => a.priority - b.priority || a.batch_id.localeCompare(b.batch_id))
  writeJsonl(join(acquisitionDir, 'acquisition_tasks.jsonl'), sorted)
  writeCsv(join(acquisitionDir, 'acquisition_tasks.csv'), sorted)
  writeJson(join(acquisitionDir, 'apify-profile-scraper-template.json'), {
    note: 'Template only. Confirm provider terms and fields before use.',
    profiles: sorted
      .filter((task) => task.acquisition_surface === 'tiktok_profile_export' && task.query.startsWith('@'))
      .map((task) => `https://www.tiktok.com/${task.query}`),
    resultsPerPage: 50,
    shouldDownloadVideos: false,
  })
  writeJson(join(acquisitionDir, 'apify-hashtag-scraper-template.json'), {
    note: 'Template only. Confirm provider terms and fields before use.',
    hashtags: discovery.hashtag_queries,
    resultsPerPage: 100,
    shouldDownloadVideos: false,
  })

  const summary = {
    generated_at: new Date().toISOString(),
    tasks: sorted.length,
    useful_creators_available_for_expansion: usefulCreators.size,
    priority_counts: sorted.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] ?? 0) + 1
      return acc
    }, {}),
    surface_counts: sorted.reduce((acc, task) => {
      acc[task.acquisition_surface] = (acc[task.acquisition_surface] ?? 0) + 1
      return acc
    }, {}),
  }
  writeJson(join(reportsDir, 'acquisition-batches.json'), summary)
  writeFileSync(join(reportsDir, 'acquisition-batches.md'), `# Acquisition Batches

Generated: ${summary.generated_at}

- Tasks: ${summary.tasks}
- Useful creators available for expansion: ${summary.useful_creators_available_for_expansion}

## Surfaces

${Object.entries(summary.surface_counts).map(([surface, count]) => `- ${surface}: ${count}`).join('\n')}

## Priority Counts

${Object.entries(summary.priority_counts).map(([priority, count]) => `- P${priority}: ${count}`).join('\n')}

Primary task file: \`data/processed/acquisition/acquisition_tasks.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
