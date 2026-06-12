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

function yieldLookup(rows) {
  const byQuery = new Map()
  const bySurface = new Map()
  for (const row of rows) {
    if (row.source_query) byQuery.set(row.source_query, row)
    bySurface.set(row.source_type, row)
  }
  return { byQuery, bySurface }
}

function yieldAdjustedPriority(basePriority, task, yields) {
  const queryYield = yields.byQuery.get(task.query)
  const surfaceYield = yields.bySurface.get(task.acquisition_surface)
  const signal = queryYield ?? surfaceYield
  if (!signal) return basePriority
  if (Number(signal.yield_score) >= 75) return Math.max(1, basePriority - 1)
  if (Number(signal.rejection_rate) >= 0.5 && Number(signal.creators_seen) >= 2) return Math.min(5, basePriority + 2)
  if (Number(signal.usefulness_rate) === 0 && Number(signal.creators_seen) >= 2) return Math.min(5, basePriority + 1)
  return basePriority
}

function categoryCoverageLookup(rows) {
  const byLabel = new Map()
  for (const row of rows) byLabel.set(row.label, row)
  return byLabel
}

function normalizeText(value) {
  return String(value ?? '').toLowerCase().replaceAll('_', ' ')
}

function inferTargetLabel(task, rubric, coverageByLabel) {
  const haystack = normalizeText(`${task.query} ${task.notes ?? ''}`)
  const labels = Object.keys(rubric.category_keywords ?? {})
  const matches = labels
    .map((label) => {
      const keywords = rubric.category_keywords[label] ?? []
      const score = keywords.reduce((sum, keyword) => sum + (haystack.includes(normalizeText(keyword)) ? 1 : 0), 0)
      const labelScore = haystack.includes(normalizeText(label)) ? 1 : 0
      return { label, score: score + labelScore }
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || (coverageByLabel.get(b.label)?.useful_gap ?? 0) - (coverageByLabel.get(a.label)?.useful_gap ?? 0))
  return matches[0]?.label ?? ''
}

function categoryAdjustedPriority(basePriority, targetLabel, coverageByLabel) {
  if (!targetLabel) return basePriority
  const coverage = coverageByLabel.get(targetLabel)
  if (!coverage) return basePriority
  if (Number(coverage.useful_primary_accounts) === 0) return Math.max(1, basePriority - 1)
  if (Number(coverage.useful_gap) > 0) return basePriority
  return Math.min(5, basePriority + 1)
}

function taskWithSignals(baseTask, yields, rubric, coverageByLabel) {
  const targetLabel = inferTargetLabel(baseTask, rubric, coverageByLabel)
  const categoryPriority = categoryAdjustedPriority(baseTask.priority, targetLabel, coverageByLabel)
  const priority = yieldAdjustedPriority(categoryPriority, baseTask, yields)
  const queryYield = yields.byQuery.get(baseTask.query)
  const surfaceYield = yields.bySurface.get(baseTask.acquisition_surface)
  const signal = queryYield ?? surfaceYield
  const coverage = coverageByLabel.get(targetLabel)
  return {
    ...baseTask,
    priority,
    base_priority: baseTask.priority,
    category_adjusted_priority: categoryPriority,
    target_label: targetLabel,
    target_label_gap: coverage?.useful_gap ?? '',
    category_coverage_reason: targetLabel
      ? `${coverage?.useful_primary_accounts ?? 0}/${coverage?.target_useful_creators ?? 0} useful primary ${targetLabel} creators`
      : '',
    yield_score: signal?.yield_score ?? '',
    usefulness_rate: signal?.usefulness_rate ?? '',
    rejection_rate: signal?.rejection_rate ?? '',
  }
}

function gapFillQueries(rubric, coverageRows) {
  const rows = [...coverageRows].sort((a, b) => {
    const priorityDelta = Number(a.recommended_priority) - Number(b.recommended_priority)
    if (priorityDelta !== 0) return priorityDelta
    return Number(b.useful_gap) - Number(a.useful_gap)
  })
  const tasks = []
  for (const row of rows) {
    if (Number(row.useful_gap) <= 0) continue
    const keywords = rubric.category_keywords?.[row.label] ?? []
    const primaryTerms = [row.label.replaceAll('_', ' '), ...keywords].slice(0, 4)
    for (const term of primaryTerms) {
      tasks.push({
        label: row.label,
        query: `site:tiktok.com/@ "${term}"`,
        priority: Number(row.recommended_priority) || 2,
        reason: `${row.useful_primary_accounts}/${row.target_useful_creators} useful primary ${row.label} creators`,
      })
    }
  }
  return tasks
}

function main() {
  ensureDir(acquisitionDir)
  ensureDir(reportsDir)

  const discovery = readJson(join(configDir, 'discovery-queries.json'))
  const rubric = readJson(join(configDir, 'category-rubric.json'))
  const expansionQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const creatorScores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const categoryCoverage = readJsonl(join(processedDir, 'category_coverage.jsonl'))
  const yields = yieldLookup(sourceYield)
  const coverageByLabel = categoryCoverageLookup(categoryCoverage)
  const usefulCreators = new Set(creatorScores.filter((row) => ['useful', 'excellent'].includes(row.status)).map((row) => row.creator_id))

  const tasks = []
  let sequence = 1

  for (const query of discovery.search_engine_queries) {
    tasks.push(taskWithSignals({
      batch_id: `search_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'search_index',
      query,
      priority: 2,
      expected_output: 'candidate TikTok profile URLs',
      import_target: 'data/raw/imports/search-index-export.jsonl',
      notes: 'Use a search API or manual SERP export. Preserve result URL, title, snippet, and query.',
    }, yields, rubric, coverageByLabel))
    sequence += 1
  }

  for (const hashtag of discovery.hashtag_queries) {
    tasks.push(taskWithSignals({
      batch_id: `hashtag_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'tiktok_hashtag_export',
      query: hashtag,
      priority: 1,
      expected_output: 'recent public videos and author profiles for hashtag',
      import_target: 'data/raw/imports/hashtag-export.jsonl',
      notes: 'Export public hashtag results with author, caption, posted_at, metrics, hashtags, mentions, and sound metadata.',
    }, yields, rubric, coverageByLabel))
    sequence += 1
  }

  for (const query of discovery.cross_platform_queries) {
    tasks.push(taskWithSignals({
      batch_id: `cross_platform_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'cross_platform_search',
      query,
      priority: 3,
      expected_output: 'external pages linking to TikTok creator profiles',
      import_target: 'data/raw/imports/cross-platform-export.jsonl',
      notes: 'Use this for serious-creator evidence and identity resolution.',
    }, yields, rubric, coverageByLabel))
    sequence += 1
  }

  const existingQueries = new Set(tasks.map((task) => task.query))
  for (const gapQuery of gapFillQueries(rubric, categoryCoverage)) {
    if (existingQueries.has(gapQuery.query)) continue
    existingQueries.add(gapQuery.query)
    tasks.push(taskWithSignals({
      batch_id: `category_gap_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: 'category_gap_search',
      query: gapQuery.query,
      priority: gapQuery.priority,
      expected_output: 'candidate TikTok profile URLs for undercovered creator category',
      import_target: 'data/raw/imports/category-gap-search-export.jsonl',
      notes: `Fill category coverage gap for ${gapQuery.label}: ${gapQuery.reason}`,
    }, yields, rubric, coverageByLabel))
    sequence += 1
  }

  for (const row of expansionQueue.filter((item) => item.priority <= 2).slice(0, maxItems)) {
    tasks.push(taskWithSignals({
      batch_id: `graph_${String(sequence).padStart(4, '0')}`,
      acquisition_surface: row.expansion_type === 'resolve_mentioned_creator' ? 'tiktok_profile_export' : 'tiktok_creator_neighborhood_export',
      query: row.target,
      priority: row.priority,
      expected_output: row.expansion_type === 'resolve_mentioned_creator' ? 'public creator profile and recent videos' : 'mentions, hashtags, collaborators, sounds, and recent videos',
      import_target: 'data/raw/imports/graph-expansion-export.jsonl',
      notes: row.reason,
    }, yields, rubric, coverageByLabel))
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
    source_yield_rows: sourceYield.length,
    category_coverage_rows: categoryCoverage.length,
    priority_counts: sorted.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] ?? 0) + 1
      return acc
    }, {}),
    surface_counts: sorted.reduce((acc, task) => {
      acc[task.acquisition_surface] = (acc[task.acquisition_surface] ?? 0) + 1
      return acc
    }, {}),
    target_label_counts: sorted.reduce((acc, task) => {
      const label = task.target_label || 'unclassified'
      acc[label] = (acc[label] ?? 0) + 1
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

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n')}

## Priority Counts

${Object.entries(summary.priority_counts).map(([priority, count]) => `- P${priority}: ${count}`).join('\n')}

Primary task file: \`data/processed/acquisition/acquisition_tasks.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
