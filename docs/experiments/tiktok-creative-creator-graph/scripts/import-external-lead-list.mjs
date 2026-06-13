import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const inputArg = args.get('--input')
const sourceNameArg = String(args.get('--source-name') ?? '').trim()
const defaultTargetLabel = String(args.get('--target-label') ?? '').trim()
const defaultSourceQuery = String(args.get('--source-query') ?? '').trim()
const dryRun = args.has('--dry-run')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'external_lead_list'

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
  const lines = readFileSync(path, 'utf8').split('\n').filter((line) => line.trim())
  if (!lines.length) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.trim())
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
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

function readRows(path) {
  const extension = extname(path).toLowerCase()
  if (extension === '.csv') return readCsv(path)
  if (extension === '.jsonl') return readJsonl(path)
  if (extension === '.json') {
    const value = JSON.parse(readFileSync(path, 'utf8'))
    return Array.isArray(value) ? value : value.rows ?? value.data ?? [value]
  }
  throw new Error(`Unsupported external lead list extension: ${extension}`)
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean)
  if (value == null || value === '') return []
  return String(value).split(/[|;]/).map((item) => item.trim()).filter(Boolean)
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

function normalizeProfileUrl(row) {
  const handle = normalizeHandle(row.handle ?? row.username ?? row.profile_url ?? row.url)
  return handle ? `https://www.tiktok.com/${handle}` : ''
}

function normalizeLead(row, inputFile, index) {
  const profileUrl = normalizeProfileUrl(row)
  const handle = normalizeHandle(row.handle ?? row.username ?? profileUrl)
  if (!handle) return null
  const targetLabels = [
    ...asArray(row.target_label),
    ...asArray(row.targetLabel),
    ...asArray(row.category),
    ...asArray(row.categories),
    ...asArray(defaultTargetLabel),
  ]
  const sourceName = String(row.source_name ?? row.source ?? sourceNameArg ?? '').trim() || `External lead list ${inputFile}`
  return {
    handle,
    profile_url: profileUrl,
    display_name: row.display_name ?? row.name ?? row.title ?? handle.slice(1),
    bio: row.bio ?? row.description ?? row.snippet ?? '',
    follower_count: toNumber(row.follower_count ?? row.followers),
    likes_count: toNumber(row.likes_count ?? row.likes),
    video_count: toNumber(row.video_count ?? row.videos_count ?? row.videos),
    verified: row.verified === true || row.verified === 'true',
    bio_links: asArray(row.bio_links ?? row.external_links ?? row.website),
    source_type: 'external_lead_list',
    source_name: sourceName,
    source_url: row.source_url ?? row.url ?? profileUrl,
    source_query: row.source_query ?? row.query ?? defaultSourceQuery,
    target_label: targetLabels[0] ?? '',
    source_target_labels: Array.from(new Set(targetLabels)),
    acquisition_surface: 'external_lead_list',
    provider,
    provider_execution_id: executionId,
    batch_id: row.batch_id ?? `external_leads_${executionId}`,
    rank: toNumber(row.rank ?? row.position, index + 1),
    external_input_file: inputFile,
  }
}

function main() {
  if (!inputArg) throw new Error('Missing --input=path/to/leads.csv|json|jsonl')
  const inputPath = join(root, String(inputArg))
  if (!existsSync(inputPath)) throw new Error(`External lead list not found: ${inputPath}`)
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const inputFile = basename(inputPath)
  const inputRows = readRows(inputPath)
  const outputRows = []
  const seen = new Set()
  for (const [index, row] of inputRows.entries()) {
    const normalized = normalizeLead(row, inputFile, index)
    if (!normalized || seen.has(normalized.handle)) continue
    seen.add(normalized.handle)
    outputRows.push(normalized)
  }

  const outputPath = join(acquisitionResultsDir, `${executionId}-external-lead-list.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    input_path: inputPath.replace(`${root}/`, ''),
    input_rows: inputRows.length,
    output_rows: outputRows.length,
    skipped_rows: inputRows.length - outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      const label = row.target_label || 'unclassified'
      acc[label] = (acc[label] ?? 0) + 1
      return acc
    }, {}),
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'external-lead-list-import.json'), summary)
  writeFileSync(join(reportsDir, 'external-lead-list-import.md'), `# External Lead List Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Input path: ${summary.input_path}
- Input rows: ${summary.input_rows}
- Output rows: ${summary.output_rows}
- Skipped rows: ${summary.skipped_rows}
- Output path: ${summary.output_path || 'none'}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows) process.exitCode = 1
}

main()
