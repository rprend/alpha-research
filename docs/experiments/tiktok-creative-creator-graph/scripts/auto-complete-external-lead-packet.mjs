import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const externalLeadsDir = join(experimentDir, 'data/raw/external-leads')
const completedDir = join(externalLeadsDir, 'completed')
const reportsDir = join(experimentDir, 'reports')
const processedDir = join(experimentDir, 'data/processed')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxAssignments = Number(args.get('--max-assignments') ?? 200)
const minRowsToWrite = Number(args.get('--min-rows-to-write') ?? 1)
const overwrite = args.has('--overwrite')
const dryRun = args.has('--dry-run')

const outputColumns = [
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

const targetLabelAliases = new Map([
  ['screenwriter', 'film_educator'],
  ['unclear', 'film_educator'],
])

const allowedSourceTypes = new Set([
  'editorial_list',
  'external_lead_list',
  'public_dataset_sample',
  'public_editorial_page',
  'public_web_search',
  'search_result_export',
  'wikidata_profile',
])

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

function writeCsv(path, rows, headers = outputColumns) {
  const escape = (value) => {
    const text = value == null ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
  }
  writeFileSync(path, `${headers.join(',')}\n${rows.map((row) => headers.map((header) => escape(row[header])).join(',')).join('\n')}${rows.length ? '\n' : ''}`)
}

function toNumber(value, fallback = 0) {
  const text = String(value ?? '').replaceAll(',', '').trim()
  if (!text) return fallback
  const parsed = Number(text)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function normalizeProfileUrl(value) {
  const handle = normalizeHandle(value)
  return handle ? `https://www.tiktok.com/${handle}` : ''
}

function cleanText(value) {
  return String(value ?? '').replace(/\s+/g, ' ').trim()
}

function normalizedLabel(row) {
  const label = String(row.target_label ?? row.primary_label ?? '').trim()
  return targetLabelAliases.get(label) ?? label
}

function normalizeLead(row) {
  const sourceType = String(row.source_type ?? '').trim()
  if (sourceType && !allowedSourceTypes.has(sourceType)) return null
  const handle = normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)
  if (!handle) return null
  const targetLabel = normalizedLabel(row)
  if (!targetLabel) return null
  return {
    handle,
    profile_url: normalizeProfileUrl(handle),
    display_name: cleanText(row.display_name ?? row.name ?? row.title ?? handle.slice(1)),
    bio: cleanText(row.bio ?? row.description ?? row.snippet ?? ''),
    target_label: targetLabel,
    source_name: cleanText(row.source_name ?? row.source ?? row.provider ?? 'Public acquisition results'),
    source_url: cleanText(row.source_url ?? row.url ?? row.profile_url ?? normalizeProfileUrl(handle)),
    source_query: cleanText(row.source_query ?? row.query ?? row.search_query ?? row.batch_id ?? ''),
    follower_count: toNumber(row.follower_count ?? row.followers),
    likes_count: toNumber(row.likes_count ?? row.likes),
    video_count: toNumber(row.video_count ?? row.videos_count ?? row.videos ?? row.public_profile_video_count),
    verified: row.verified === true || row.verified === 'true',
    source_type: sourceType || 'public_acquisition_result',
  }
}

function loadAcquisitionLeads() {
  if (!existsSync(acquisitionResultsDir)) return []
  const leads = []
  for (const file of readdirSync(acquisitionResultsDir).sort()) {
    if (extname(file).toLowerCase() !== '.jsonl') continue
    for (const row of readJsonl(join(acquisitionResultsDir, file))) {
      const lead = normalizeLead(row)
      if (lead) leads.push({ ...lead, source_file: file })
    }
  }
  return leads
}

function groupUniqueLeadsByLabel(leads, packetLabels) {
  const seen = new Set()
  const byLabel = new Map()
  for (const lead of leads) {
    if (!packetLabels.has(lead.target_label) || seen.has(lead.handle)) continue
    seen.add(lead.handle)
    const rows = byLabel.get(lead.target_label) ?? []
    rows.push(lead)
    byLabel.set(lead.target_label, rows)
  }
  return byLabel
}

function main() {
  ensureDir(completedDir)
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const assignments = readCsv(join(externalLeadsDir, 'acquisition-packet.csv')).slice(0, maxAssignments)
  const packetLabels = new Set(assignments.map((assignment) => assignment.target_label).filter(Boolean))
  const byLabel = groupUniqueLeadsByLabel(loadAcquisitionLeads(), packetLabels)
  const cursorByLabel = new Map()
  const fileReports = []
  const outputRows = []

  for (const assignment of assignments) {
    const label = assignment.target_label
    const available = byLabel.get(label) ?? []
    const cursor = cursorByLabel.get(label) ?? 0
    const target = Number(assignment.lead_target || 250)
    const selected = available.slice(cursor, cursor + target)
    cursorByLabel.set(label, cursor + selected.length)
    const completedPath = join(completedDir, assignment.completed_file_name)
    const alreadyExists = existsSync(completedPath)
    const shouldWrite = selected.length >= minRowsToWrite && (!alreadyExists || overwrite)

    if (shouldWrite && !dryRun) {
      writeCsv(completedPath, selected)
    }

    for (const row of selected) {
      outputRows.push({
        assignment_id: assignment.assignment_id,
        completed_file_name: assignment.completed_file_name,
        ...row,
      })
    }

    fileReports.push({
      assignment_id: assignment.assignment_id,
      target_label: label,
      completed_file_name: assignment.completed_file_name,
      selected_rows: selected.length,
      lead_target: target,
      wrote_file: shouldWrite && !dryRun,
      skipped_existing_file: alreadyExists && !overwrite,
      output_path: shouldWrite ? completedPath.replace(`${root}/`, '') : '',
    })
  }

  const summary = {
    generated_at: new Date().toISOString(),
    dry_run: dryRun,
    overwrite,
    assignments_seen: assignments.length,
    files_written: fileReports.filter((row) => row.wrote_file).length,
    existing_files_skipped: fileReports.filter((row) => row.skipped_existing_file).length,
    routed_rows: outputRows.length,
    labels: Object.fromEntries([...byLabel.entries()].map(([label, rows]) => [label, rows.length])),
    file_reports: fileReports,
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'external-lead-auto-complete.json'), summary)
  writeJsonl(join(processedDir, 'external_lead_auto_complete_rows.jsonl'), outputRows)
  writeFileSync(join(reportsDir, 'external-lead-auto-complete.md'), `# External Lead Auto Complete

Generated: ${summary.generated_at}

- Dry run: ${summary.dry_run}
- Overwrite: ${summary.overwrite}
- Assignments seen: ${summary.assignments_seen}
- Completed files written: ${summary.files_written}
- Existing files skipped: ${summary.existing_files_skipped}
- Routed rows: ${summary.routed_rows}

## Labels

${Object.entries(summary.labels).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Files

${fileReports.slice(0, 50).map((row) => `- ${row.assignment_id}: ${row.selected_rows}/${row.lead_target} ${row.target_label} rows -> ${row.completed_file_name}${row.wrote_file ? '' : row.skipped_existing_file ? ' (existing)' : ' (not written)'}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
