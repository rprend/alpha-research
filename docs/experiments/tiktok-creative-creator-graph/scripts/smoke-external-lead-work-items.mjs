import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const root = process.cwd()
const scriptDir = 'docs/experiments/tiktok-creative-creator-graph/scripts'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function writeCsv(path, rows) {
  const headers = Object.keys(rows[0] ?? {})
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function parseCsvLine(line) {
  const values = []
  let current = ''
  let quoted = false
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]
    if (char === '"' && quoted && next === '"') {
      current += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      values.push(current)
      current = ''
    } else {
      current += char
    }
  }
  values.push(current)
  return values
}

function readCsv(path) {
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function runNode(script, args) {
  execFileSync('node', [join(scriptDir, script), ...args], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

const tmpRoot = mkdtempSync(join(tmpdir(), 'tiktok-work-items-'))
try {
  const externalLeadsDir = join(tmpRoot, 'external-leads')
  const reportsDir = join(tmpRoot, 'reports')
  const processedDir = join(tmpRoot, 'processed')
  const completedDir = join(externalLeadsDir, 'work-items-completed')
  mkdirSync(completedDir, { recursive: true })
  mkdirSync(reportsDir, { recursive: true })
  mkdirSync(processedDir, { recursive: true })

  writeCsv(join(externalLeadsDir, 'source-worklist.csv'), [
    {
      work_item_id: 'external_source_0001_01',
      assignment_id: 'external_packet_0001',
      wave_id: 'scale_wave_0001',
      priority: '1',
      target_label: 'filmmaker',
      acquisition_surface: 'search_index',
      source_kind: 'tiktok_user_search',
      source_url: 'https://www.tiktok.com/search/user?q=filmmaker',
      source_query: 'filmmaker',
      query_hints: 'short film | director',
      lead_quota: '3',
      completed_file_name: '0001-filmmaker.csv',
      completed_file_path: 'completed/0001-filmmaker.csv',
      template_path: 'templates/0001-filmmaker.csv',
      acceptance_rubric: 'public TikTok profile with original creative work',
      import_command: 'node importer --input=0001-filmmaker.csv',
      status: 'not_started',
    },
    {
      work_item_id: 'external_source_0001_02',
      assignment_id: 'external_packet_0001',
      wave_id: 'scale_wave_0001',
      priority: '1',
      target_label: 'filmmaker',
      acquisition_surface: 'search_index',
      source_kind: 'google_search',
      source_url: 'https://www.google.com/search?q=filmmaker',
      source_query: 'filmmaker',
      query_hints: 'short film | director',
      lead_quota: '2',
      completed_file_name: '0001-filmmaker.csv',
      completed_file_path: 'completed/0001-filmmaker.csv',
      template_path: 'templates/0001-filmmaker.csv',
      acceptance_rubric: 'public TikTok profile with original creative work',
      import_command: 'node importer --input=0001-filmmaker.csv',
      status: 'not_started',
    },
  ])

  runNode('build-external-lead-work-item-templates.mjs', [
    `--external-leads-dir=${externalLeadsDir}`,
    `--reports-dir=${reportsDir}`,
  ])
  const templateSummary = readJson(join(reportsDir, 'external-lead-work-item-templates.json'))
  assert(templateSummary.templates === 2, `Expected 2 templates, got ${templateSummary.templates}`)
  assert(templateSummary.total_template_rows === 5, `Expected 5 template rows, got ${templateSummary.total_template_rows}`)
  const firstTemplate = readCsv(join(externalLeadsDir, 'work-item-templates/external_source_0001_01.csv'))
  assert(firstTemplate.length === 3, `Expected 3 rows in first template, got ${firstTemplate.length}`)
  assert(firstTemplate[0].source_url === 'https://www.tiktok.com/search/user?q=filmmaker', 'Template did not preserve source URL.')

  writeCsv(join(completedDir, 'external_source_0001_01.csv'), [
    { handle: '@alicefilm', profile_url: '', display_name: 'Alice Film', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
    { handle: 'https://www.tiktok.com/@bobfilms', profile_url: '', display_name: 'Bob Films', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
    { handle: '@alicefilm', profile_url: '', display_name: 'Alice Duplicate', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
  ])
  writeCsv(join(completedDir, 'external_source_0001_02.csv'), [
    { handle: '@carla.mov', profile_url: '', display_name: 'Carla Mov', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
    { handle: 'not a handle', profile_url: '', display_name: 'Invalid', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
  ])
  writeCsv(join(completedDir, 'external_source_9999_99.csv'), [
    { handle: '@unknown', profile_url: '', display_name: 'Unknown', bio: '', target_label: '', source_name: '', source_url: '', source_query: '', follower_count: '', likes_count: '', video_count: '', verified: '' },
  ])

  runNode('merge-external-lead-work-items.mjs', [
    `--external-leads-dir=${externalLeadsDir}`,
    `--reports-dir=${reportsDir}`,
    `--processed-dir=${processedDir}`,
  ])
  const mergeSummary = readJson(join(reportsDir, 'external-lead-work-item-merge.json'))
  assert(mergeSummary.input_files === 3, `Expected 3 input files, got ${mergeSummary.input_files}`)
  assert(mergeSummary.merged_input_files === 2, `Expected 2 merged files, got ${mergeSummary.merged_input_files}`)
  assert(mergeSummary.unknown_work_item_files === 1, `Expected 1 unknown file, got ${mergeSummary.unknown_work_item_files}`)
  assert(mergeSummary.valid_rows === 4, `Expected 4 valid rows before dedupe, got ${mergeSummary.valid_rows}`)
  assert(mergeSummary.unique_valid_rows === 3, `Expected 3 unique rows, got ${mergeSummary.unique_valid_rows}`)
  assert(mergeSummary.duplicate_rows === 1, `Expected 1 duplicate row, got ${mergeSummary.duplicate_rows}`)

  const completedRows = readCsv(join(externalLeadsDir, 'completed/0001-filmmaker.csv'))
  assert(completedRows.length === 3, `Expected 3 completed rows, got ${completedRows.length}`)
  assert(completedRows.every((row) => row.target_label === 'filmmaker'), 'Merged rows did not inherit target label.')
  assert(completedRows.some((row) => row.source_url === 'https://www.google.com/search?q=filmmaker'), 'Merged rows did not preserve work-item source URL.')

  console.log('TikTok external lead work-item smoke passed.')
} finally {
  rmSync(tmpRoot, { recursive: true, force: true })
}
