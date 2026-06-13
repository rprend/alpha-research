import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const completedDir = join(externalLeadsDir, 'completed')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')
const requiredColumns = [
  'handle',
  'profile_url',
  'display_name',
  'bio',
  'target_label',
  'source_name',
  'source_url',
  'source_query',
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

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function completedFilesByName() {
  if (!existsSync(completedDir)) return new Map()
  return new Map(readdirSync(completedDir)
    .filter((file) => ['.csv', '.json', '.jsonl'].includes(extname(file).toLowerCase()))
    .map((file) => [file, join(completedDir, file)]))
}

function evaluateAssignment(assignment, completedFiles) {
  const completedPath = completedFiles.get(assignment.completed_file_name)
  if (!completedPath) {
    return {
      ...assignment,
      status: 'not_started',
      completed_path: '',
      completed_rows: 0,
      valid_rows: 0,
      duplicate_handles: 0,
      missing_required_columns: requiredColumns.join('|'),
      import_ready: false,
      progress_ratio: 0,
      next_action: `Create data/raw/external-leads/completed/${assignment.completed_file_name}`,
    }
  }

  const rows = readRows(completedPath)
  const headers = rows.length ? Object.keys(rows[0]) : []
  const missingColumns = requiredColumns.filter((column) => !headers.includes(column))
  const handles = rows.map((row) => normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)).filter(Boolean)
  const uniqueHandles = new Set(handles)
  const duplicateHandles = Math.max(0, handles.length - uniqueHandles.size)
  const validRows = rows.filter((row) => normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)).length
  const minimum = Number(assignment.minimum_accepted_leads || assignment.lead_target || 1)
  const hasRequiredColumns = missingColumns.length === 0
  const importReady = hasRequiredColumns && validRows > 0
  const status = !hasRequiredColumns
    ? 'needs_fix'
    : validRows === 0
      ? 'no_valid_handles'
      : validRows >= minimum
        ? 'ready_to_import'
        : 'under_minimum_ready'
  const nextAction = (() => {
    if (!hasRequiredColumns) return `Fix missing columns for ${assignment.completed_file_name}: ${missingColumns.join(', ')}`
    if (!validRows) return `Add TikTok handles or profile_url values to ${assignment.completed_file_name}`
    return importReady ? assignment.import_command : `Add ${minimum - validRows} more valid leads or import as under-minimum ready`
  })()

  return {
    ...assignment,
    status,
    completed_path: completedPath.replace(`${root}/`, ''),
    completed_rows: rows.length,
    valid_rows: validRows,
    duplicate_handles: duplicateHandles,
    missing_required_columns: missingColumns.join('|'),
    import_ready: importReady,
    progress_ratio: Number((validRows / Math.max(1, Number(assignment.lead_target || 1))).toFixed(3)),
    next_action: nextAction,
  }
}

function main() {
  ensureDir(completedDir)
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const assignments = readCsv(join(externalLeadsDir, 'acquisition-packet.csv'))
  const completedFiles = completedFilesByName()
  const rows = assignments.map((assignment) => evaluateAssignment(assignment, completedFiles))
  const readyRows = rows.filter((row) => row.import_ready)
  const byStatus = rows.reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1
    return acc
  }, {})
  const byLabel = rows.reduce((acc, row) => {
    const label = row.target_label || 'unclassified'
    acc[label] ??= { assignments: 0, import_ready_assignments: 0, valid_rows: 0, lead_target: 0 }
    acc[label].assignments += 1
    acc[label].import_ready_assignments += row.import_ready ? 1 : 0
    acc[label].valid_rows += Number(row.valid_rows || 0)
    acc[label].lead_target += Number(row.lead_target || 0)
    return acc
  }, {})
  const summary = {
    generated_at: new Date().toISOString(),
    packet_assignments: assignments.length,
    completed_files_seen: completedFiles.size,
    import_ready_assignments: readyRows.length,
    not_started_assignments: byStatus.not_started ?? 0,
    needs_fix_assignments: byStatus.needs_fix ?? 0,
    no_valid_handles_assignments: byStatus.no_valid_handles ?? 0,
    under_minimum_ready_assignments: byStatus.under_minimum_ready ?? 0,
    ready_to_import_assignments: byStatus.ready_to_import ?? 0,
    valid_leads: rows.reduce((sum, row) => sum + Number(row.valid_rows || 0), 0),
    duplicate_handles: rows.reduce((sum, row) => sum + Number(row.duplicate_handles || 0), 0),
    requested_leads: rows.reduce((sum, row) => sum + Number(row.lead_target || 0), 0),
    completion_ratio: Number((readyRows.length / Math.max(1, assignments.length)).toFixed(3)),
    lead_fill_ratio: Number((rows.reduce((sum, row) => sum + Number(row.valid_rows || 0), 0) / Math.max(1, rows.reduce((sum, row) => sum + Number(row.lead_target || 0), 0))).toFixed(3)),
    status_counts: byStatus,
    label_progress: byLabel,
    next_assignments: rows.filter((row) => row.status !== 'ready_to_import').slice(0, 20),
    ready_import_commands: readyRows.slice(0, 20).map((row) => row.import_command),
  }

  writeJsonl(join(processedDir, 'external_lead_packet_status.jsonl'), rows)
  writeCsv(join(processedDir, 'external_lead_packet_status.csv'), rows)
  writeJson(join(reportsDir, 'external-lead-progress.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-progress.md'), `# External Lead Progress

Generated: ${summary.generated_at}

- Packet assignments: ${summary.packet_assignments}
- Completed files seen: ${summary.completed_files_seen}
- Import-ready assignments: ${summary.import_ready_assignments}
- Not started assignments: ${summary.not_started_assignments}
- Needs-fix assignments: ${summary.needs_fix_assignments}
- No-valid-handles assignments: ${summary.no_valid_handles_assignments}
- Under-minimum ready assignments: ${summary.under_minimum_ready_assignments}
- Ready-to-import assignments: ${summary.ready_to_import_assignments}
- Valid leads: ${summary.valid_leads}
- Requested leads: ${summary.requested_leads}
- Lead fill ratio: ${summary.lead_fill_ratio}
- Duplicate handles: ${summary.duplicate_handles}

## Next Assignments

| Assignment | Label | Status | Valid rows | Target | Next action |
| --- | --- | --- | ---: | ---: | --- |
${summary.next_assignments.map((row) => `| ${row.assignment_id} | ${row.target_label} | ${row.status} | ${row.valid_rows} | ${row.lead_target} | ${row.next_action} |`).join('\n') || '| none | none | complete | 0 | 0 | none |'}

Status CSV: \`data/processed/external_lead_packet_status.csv\`
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
