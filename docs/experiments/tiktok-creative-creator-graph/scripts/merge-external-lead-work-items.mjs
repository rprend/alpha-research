import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const workItemCompletedDir = join(externalLeadsDir, 'work-items-completed')
const completedDir = join(externalLeadsDir, 'completed')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const leadColumns = [
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

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
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
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function readRows(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.csv') return readCsv(path)
  if (extension === '.jsonl') return readJsonl(path)
  if (extension === '.json') {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(value) ? value : value.rows ?? value.data ?? [value]
  }
  return []
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function writeCsv(path, rows, headers = Object.keys(rows[0] ?? {})) {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}\n`)
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function normalizeLead(row, workItem) {
  const handle = normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)
  if (!handle) return null
  return {
    handle,
    profile_url: row.profile_url || row.url || `https://www.tiktok.com/${handle}`,
    display_name: row.display_name ?? row.name ?? row.title ?? handle.slice(1),
    bio: row.bio ?? row.description ?? row.snippet ?? '',
    target_label: row.target_label || workItem.target_label,
    source_name: row.source_name || `External source work item ${workItem.work_item_id}`,
    source_url: row.source_url || workItem.source_url,
    source_query: row.source_query || workItem.source_query,
    follower_count: row.follower_count ?? row.followers ?? '',
    likes_count: row.likes_count ?? row.likes ?? '',
    video_count: row.video_count ?? row.videos_count ?? row.videos ?? '',
    verified: row.verified ?? '',
  }
}

function completedInputFiles() {
  if (!existsSync(workItemCompletedDir)) return []
  return readdirSync(workItemCompletedDir)
    .filter((file) => ['.csv', '.json', '.jsonl'].includes(extname(file).toLowerCase()))
    .map((file) => join(workItemCompletedDir, file))
}

function workItemIdFor(path) {
  return path.split('/').at(-1).replace(/\.(csv|jsonl|json)$/i, '')
}

function main() {
  ensureDir(workItemCompletedDir)
  ensureDir(completedDir)
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const worklist = readCsv(join(externalLeadsDir, 'source-worklist.csv'))
  const workItemsById = new Map(worklist.map((row) => [row.work_item_id, row]))
  const files = completedInputFiles()
  const grouped = new Map()
  const fileResults = []

  for (const filePath of files) {
    const workItemId = workItemIdFor(filePath)
    const workItem = workItemsById.get(workItemId)
    const inputRows = readRows(filePath)
    if (!workItem) {
      fileResults.push({
        work_item_id: workItemId,
        input_path: filePath.replace(`${root}/`, ''),
        status: 'unknown_work_item',
        input_rows: inputRows.length,
        valid_rows: 0,
        completed_file_name: '',
      })
      continue
    }
    const validRows = inputRows.map((row) => normalizeLead(row, workItem)).filter(Boolean)
    const key = workItem.completed_file_name
    grouped.set(key, [...(grouped.get(key) ?? []), ...validRows])
    fileResults.push({
      work_item_id: workItemId,
      input_path: filePath.replace(`${root}/`, ''),
      status: validRows.length ? 'merged' : 'no_valid_handles',
      input_rows: inputRows.length,
      valid_rows: validRows.length,
      completed_file_name: key,
    })
  }

  const outputFiles = []
  for (const [fileName, rows] of grouped.entries()) {
    const deduped = []
    const seen = new Set()
    for (const row of rows) {
      if (seen.has(row.handle)) continue
      seen.add(row.handle)
      deduped.push(row)
    }
    const outputPath = join(completedDir, fileName)
    writeCsv(outputPath, deduped, leadColumns)
    outputFiles.push({
      completed_file_name: fileName,
      completed_path: outputPath.replace(`${root}/`, ''),
      merged_rows: rows.length,
      unique_valid_rows: deduped.length,
      duplicate_rows: rows.length - deduped.length,
    })
  }

  const summary = {
    generated_at: new Date().toISOString(),
    work_item_completed_dir: workItemCompletedDir.replace(`${root}/`, ''),
    completed_dir: completedDir.replace(`${root}/`, ''),
    known_work_items: worklist.length,
    input_files: files.length,
    merged_input_files: fileResults.filter((row) => row.status === 'merged').length,
    unknown_work_item_files: fileResults.filter((row) => row.status === 'unknown_work_item').length,
    no_valid_handle_files: fileResults.filter((row) => row.status === 'no_valid_handles').length,
    output_files: outputFiles.length,
    input_rows: fileResults.reduce((sum, row) => sum + Number(row.input_rows || 0), 0),
    valid_rows: fileResults.reduce((sum, row) => sum + Number(row.valid_rows || 0), 0),
    unique_valid_rows: outputFiles.reduce((sum, row) => sum + Number(row.unique_valid_rows || 0), 0),
    duplicate_rows: outputFiles.reduce((sum, row) => sum + Number(row.duplicate_rows || 0), 0),
    output_files_detail: outputFiles,
    file_results: fileResults,
  }

  writeJson(join(reportsDir, 'external-lead-work-item-merge.json'), summary)
  writeJsonl(join(processedDir, 'external_lead_work_item_merge_files.jsonl'), fileResults)
  writeFileSync(join(reportsDir, 'external-lead-work-item-merge.md'), `# External Lead Work Item Merge

Generated: ${summary.generated_at}

- Work-item completed directory: \`${summary.work_item_completed_dir}\`
- Assignment completed directory: \`${summary.completed_dir}\`
- Known work items: ${summary.known_work_items}
- Input files: ${summary.input_files}
- Merged input files: ${summary.merged_input_files}
- Unknown work-item files: ${summary.unknown_work_item_files}
- No-valid-handle files: ${summary.no_valid_handle_files}
- Output assignment files: ${summary.output_files}
- Input rows: ${summary.input_rows}
- Valid rows: ${summary.valid_rows}
- Unique valid rows: ${summary.unique_valid_rows}
- Duplicate rows: ${summary.duplicate_rows}

## Output Files

| Completed file | Unique valid rows | Duplicate rows |
| --- | ---: | ---: |
${summary.output_files_detail.map((row) => `| ${row.completed_file_name} | ${row.unique_valid_rows} | ${row.duplicate_rows} |`).join('\n') || '| none | 0 | 0 |'}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
