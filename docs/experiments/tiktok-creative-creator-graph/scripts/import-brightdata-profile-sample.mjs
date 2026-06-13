import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const sourceUrl = String(args.get('--url') ?? 'https://raw.githubusercontent.com/luminati-io/TikTok-dataset-samples/main/tiktok-profiles.csv')
const maxRows = Number(args.get('--max-rows') ?? 5000)
const dryRun = args.has('--dry-run')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'brightdata_public_github_sample'

const labelRules = [
  ['vfx_animation', /\b(vfx|visual effects|animat|3d|blender|cgi|motion graphics|digital art|illustrat|character design|artist|tattoo|drawing|paint)\b/i],
  ['editor', /\b(editor|editing|edit|post[-\s]?production|color grading|davinci|premiere|after effects|video edit)\b/i],
  ['cinematographer', /\b(cinematograph|photograph|camera|lighting|drone|aerial|filmmaker|film maker|film look|videograph)\b/i],
  ['director', /\b(director|directed by|commercial director|film director|music video director)\b/i],
  ['filmmaker', /\b(filmmaker|film|movie|short film|cinema|documentary|video creator|content creator)\b/i],
  ['film_educator', /\b(review|explained|breakdown|learn|tutorial|education|teacher|tips|how to|analysis)\b/i],
  ['standup_comedian', /\b(stand[-\s]?up|comedian|comedy special|tour|netflix special)\b/i],
  ['sketch_comedian', /\b(sketch|comedy|parody|character|funny|humor|improv)\b/i],
  ['actor_performer', /\b(actor|actress|performer|theater|theatre|voice actor|dancer|dance|singer|musician)\b/i],
  ['creative_technologist', /\b(technology|producer|music producer|sound design|creative tech|software|ai|generative|interactive|virtual reality|vr)\b/i],
  ['behind_the_scenes_creator', /\b(behind the scenes|bts|making of|process|build|setup|workflow)\b/i],
  ['screenwriter', /\b(writer|author|book|storytelling|novel|screenplay|script)\b/i],
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

function parseCsv(text) {
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    const next = text[index + 1]
    if (char === '"' && quoted && next === '"') {
      field += '"'
      index += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') index += 1
      row.push(field)
      if (row.some((value) => value.trim())) rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    if (row.some((value) => value.trim())) rows.push(row)
  }
  if (!rows.length) return []
  const headers = rows[0].map((header) => header.trim())
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ''])))
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function toNumber(value) {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim())
  return Number.isFinite(parsed) ? parsed : 0
}

function scrubContactText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim()
  if (!text || text.toLowerCase() === 'null') return fallback
  return text
}

function labelsFor(row) {
  const text = `${row.nickname ?? ''} ${row.biography ?? ''} ${row.signature ?? ''} ${row.discovery_input ?? ''}`
  const labels = []
  for (const [label, pattern] of labelRules) {
    if (pattern.test(text)) labels.push(label)
  }
  return Array.from(new Set(labels))
}

function normalizeRow(row, index) {
  const handle = normalizeHandle(row.url || row.nickname)
  if (!handle) return null
  const labels = labelsFor(row)
  if (!labels.length) return null
  return {
    handle,
    profile_url: `https://www.tiktok.com/${handle}`,
    display_name: row.nickname || handle.slice(1),
    bio: scrubContactText(row.biography || row.signature || ''),
    follower_count: toNumber(row.followers),
    likes_count: toNumber(row.likes || row.like_count),
    video_count: toNumber(row.videos_count),
    verified: row.is_verified === true || row.is_verified === 'true',
    source_type: 'public_dataset_sample',
    source_name: 'Bright Data TikTok profiles GitHub sample',
    source_url: sourceUrl,
    source_query: cleanText(row.discovery_input, 'Bright Data TikTok profiles sample'),
    target_label: labels[0],
    source_target_labels: labels,
    acquisition_surface: 'public_dataset_sample',
    provider,
    provider_execution_id: executionId,
    batch_id: 'brightdata_tiktok_profiles_github_sample',
    rank: index + 1,
  }
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const response = await fetch(sourceUrl, {
    headers: {
      'user-agent': 'Mozilla/5.0 (compatible; alpha-research-brightdata-sample-import/1.0)',
      accept: 'text/csv,text/plain',
    },
  })
  if (!response.ok) throw new Error(`Bright Data sample request failed ${response.status}`)

  const inputRows = parseCsv(await response.text())
  const outputRows = []
  const seen = new Set()
  for (const [index, row] of inputRows.entries()) {
    if (outputRows.length >= maxRows) break
    const normalized = normalizeRow(row, index)
    if (!normalized || seen.has(normalized.handle)) continue
    seen.add(normalized.handle)
    outputRows.push(normalized)
  }

  const outputPath = join(acquisitionResultsDir, `${executionId}-brightdata-profile-sample.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    source_url: sourceUrl,
    source_license: 'not_declared_in_github_repo_metadata',
    source_use_note: 'Candidate acquisition only; confirm source terms before production release claims.',
    input_rows: inputRows.length,
    output_rows: outputRows.length,
    skipped_rows: inputRows.length - outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'brightdata-profile-sample-import.json'), summary)
  writeFileSync(join(reportsDir, 'brightdata-profile-sample-import.md'), `# Bright Data Profile Sample Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Source URL: ${summary.source_url}
- Source license: ${summary.source_license}
- Source use note: ${summary.source_use_note}
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
