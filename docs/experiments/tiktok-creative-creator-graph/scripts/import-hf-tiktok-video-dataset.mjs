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

const dataset = String(args.get('--dataset') ?? 'datahiveai/Tiktok-Videos')
const config = String(args.get('--config') ?? 'default')
const split = String(args.get('--split') ?? 'train')
const maxRows = Number(args.get('--max-rows') ?? 5000)
const pageSize = Math.min(100, Math.max(1, Number(args.get('--page-size') ?? 100)))
const maxCreators = Number(args.get('--max-creators') ?? 2000)
const dryRun = args.has('--dry-run')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'huggingface_dataset_viewer'
const requestDelayMs = Number(args.get('--request-delay-ms') ?? 250)
const maxRetries = Number(args.get('--max-retries') ?? 4)

const datasetMetadata = {
  'datahiveai/Tiktok-Videos': {
    source_name: 'Hugging Face datahiveai/Tiktok-Videos',
    source_url: 'https://huggingface.co/datasets/datahiveai/Tiktok-Videos',
    source_license: 'cc-by-nc-4.0',
    source_use_note: 'Candidate acquisition only; non-commercial license requires review before production release use.',
  },
}

const labelRules = [
  ['cinematographer', /\b(cinematograph|photograph|camera|lighting|drone|aerial|film look|videograph|shot on|sony|canon|fuji|arri|blackmagic)\b/i],
  ['vfx_animation', /\b(vfx|visual effects|animation|animator|3d|blender|cgi|motion graphics|after effects|digital art|illustrat|character design)\b/i],
  ['editor', /\b(editor|editing|edit breakdown|post[-\s]?production|color grading|davinci|premiere pro|after effects|capcut tutorial)\b/i],
  ['director', /\b(director|directed by|commercial director|film director|music video director|writer director|writer\/director)\b/i],
  ['filmmaker', /\b(filmmaker|film maker|short film|cinema|documentary|behind the camera|music video|movie|screenwriting|screenwriter)\b/i],
  ['film_educator', /\b(tutorial|how to|learn|explained|breakdown|analysis|tips|lesson|education|teach|camera test|lighting setup)\b/i],
  ['standup_comedian', /\b(stand[-\s]?up|standup|comedy club|open mic|crowd work|comedian|comedy set)\b/i],
  ['sketch_comedian', /\b(sketch comedy|skit|parody|character comedy|improv|funny video|comedy sketch)\b/i],
  ['actor_performer', /\b(actor|actress|performer|monologue|audition|theater|theatre|voice actor|acting)\b/i],
  ['creative_technologist', /\b(ai|generative|creative tech|interactive|software|tool|workflow|prompt|virtual production|unreal engine)\b/i],
  ['behind_the_scenes_creator', /\b(behind the scenes|bts|making of|process|setup|workflow|before and after|how i made|on set)\b/i],
]

const rejectRules = [
  /\bmakeup\b/i,
  /\bskin care\b/i,
  /\bweight loss\b/i,
  /\bcrypto\b/i,
  /\bforex\b/i,
  /\bdropshipping\b/i,
  /\brecipe\b/i,
  /\b#ad\b/i,
  /\bavailable in stores\b/i,
  /\bget .* free on\b/i,
  /\bsteam and epic games\b/i,
  /\bnew song\b/i,
  /\bmusic video out\b/i,
]

const highConfidenceRules = [
  /\b(filmmaker|film maker|cinematograph|video editor|vfx|visual effects|animator|motion graphics)\b/i,
  /\b(short film|documentary|film director|writer\/director|music video director|commercial director)\b/i,
  /\b(behind the scenes|making of|how i made|lighting setup|camera test|editing breakdown|color grading)\b/i,
  /\b(stand[-\s]?up comedian|sketch comedy|comedy sketch|open mic|crowd work)\b/i,
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

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const fromHandle = raw.match(/^@?([A-Za-z0-9._-]+)$/)?.[1]
  const handle = (fromUrl ?? fromHandle ?? '').toLowerCase()
  if (!handle || handle.includes('.com')) return ''
  return `@${handle}`
}

function toNumber(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function scrubText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelsFor(row) {
  const text = `${row.description ?? ''} ${row.url ?? ''} ${row.author_unique_id ?? ''}`
  if (rejectRules.some((pattern) => pattern.test(text))) return []
  if (!highConfidenceRules.some((pattern) => pattern.test(text))) return []
  const labels = []
  for (const [label, pattern] of labelRules) {
    if (pattern.test(text)) labels.push(label)
  }
  return Array.from(new Set(labels))
}

function mergeCreator(existing, candidate) {
  if (!existing) return candidate
  return {
    ...existing,
    bio: existing.bio.length >= candidate.bio.length ? existing.bio : candidate.bio,
    likes_count: Math.max(existing.likes_count, candidate.likes_count),
    video_count: existing.video_count + 1,
    source_target_labels: Array.from(new Set([...existing.source_target_labels, ...candidate.source_target_labels])),
    target_label: existing.target_label,
    source_query: Array.from(new Set(`${existing.source_query}|${candidate.source_query}`.split('|').filter(Boolean))).slice(0, 5).join('|'),
    example_video_urls: Array.from(new Set([...(existing.example_video_urls ?? []), ...(candidate.example_video_urls ?? [])])).slice(0, 5),
  }
}

function normalizeRow(row, index) {
  const handle = normalizeHandle(row.author_unique_id || row.url)
  if (!handle) return null
  const labels = labelsFor(row)
  if (!labels.length) return null
  const metadata = datasetMetadata[dataset] ?? {
    source_name: `Hugging Face ${dataset}`,
    source_url: `https://huggingface.co/datasets/${dataset}`,
    source_license: 'unknown',
    source_use_note: 'Candidate acquisition only; confirm dataset license and provenance before production release use.',
  }
  const description = scrubText(row.description ?? '')
  return {
    handle,
    profile_url: `https://www.tiktok.com/${handle}`,
    display_name: handle.slice(1),
    bio: description,
    follower_count: 0,
    likes_count: toNumber(row.digg_count),
    video_count: 1,
    source_type: 'public_dataset_sample',
    source_name: metadata.source_name,
    source_url: metadata.source_url,
    source_query: labels.join('|'),
    target_label: labels[0],
    source_target_labels: labels,
    acquisition_surface: 'public_dataset_sample',
    provider,
    provider_execution_id: executionId,
    batch_id: `hf_${dataset.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}_${config}_${split}`,
    rank: index + 1,
    example_video_urls: row.url ? [row.url] : [],
  }
}

async function fetchRows(offset) {
  const url = new URL('https://datasets-server.huggingface.co/rows')
  url.searchParams.set('dataset', dataset)
  url.searchParams.set('config', config)
  url.searchParams.set('split', split)
  url.searchParams.set('offset', String(offset))
  url.searchParams.set('length', String(pageSize))
  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const response = await fetch(url, {
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; alpha-research-hf-tiktok-video-import/1.0)',
        accept: 'application/json',
      },
    })
    if (response.ok) return response.json()
    if (response.status !== 429 || attempt === maxRetries) {
      throw new Error(`Hugging Face rows request failed ${response.status} at offset ${offset}`)
    }
    const retryAfter = Number(response.headers.get('retry-after') ?? 0)
    const delayMs = retryAfter > 0 ? retryAfter * 1000 : 1000 * (attempt + 1)
    await new Promise((resolve) => setTimeout(resolve, delayMs))
  }
  throw new Error(`Hugging Face rows request failed after retries at offset ${offset}`)
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const creators = new Map()
  let inputRows = 0
  let skippedRows = 0
  let lastOffset = 0

  for (let offset = 0; offset < maxRows && creators.size < maxCreators; offset += pageSize) {
    const payload = await fetchRows(offset)
    const rows = Array.isArray(payload.rows) ? payload.rows : []
    if (!rows.length) break
    lastOffset = offset
    for (const item of rows) {
      inputRows += 1
      const normalized = normalizeRow(item.row ?? {}, item.row_idx ?? inputRows)
      if (!normalized) {
        skippedRows += 1
        continue
      }
      creators.set(normalized.handle, mergeCreator(creators.get(normalized.handle), normalized))
      if (creators.size >= maxCreators) break
    }
    if (requestDelayMs > 0) await new Promise((resolve) => setTimeout(resolve, requestDelayMs))
  }

  const outputRows = Array.from(creators.values()).map((row, index) => ({
    ...row,
    rank: index + 1,
    source_query: row.source_query || row.target_label,
    example_video_urls: (row.example_video_urls ?? []).join('|'),
  }))
  const outputPath = join(acquisitionResultsDir, `${executionId}-hf-tiktok-video-dataset.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)

  const metadata = datasetMetadata[dataset] ?? {}
  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dry_run: dryRun,
    dataset,
    config,
    split,
    source_url: metadata.source_url ?? `https://huggingface.co/datasets/${dataset}`,
    source_license: metadata.source_license ?? 'unknown',
    source_use_note: metadata.source_use_note ?? 'Candidate acquisition only; confirm dataset license and provenance before production release use.',
    max_rows: maxRows,
    page_size: pageSize,
    request_delay_ms: requestDelayMs,
    max_retries: maxRetries,
    last_offset: lastOffset,
    input_rows: inputRows,
    output_rows: outputRows.length,
    skipped_rows: skippedRows,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'hf-tiktok-video-dataset-import.json'), summary)
  writeFileSync(join(reportsDir, 'hf-tiktok-video-dataset-import.md'), `# Hugging Face TikTok Video Dataset Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dry run: ${summary.dry_run}
- Dataset: ${summary.dataset}
- Config/split: ${summary.config}/${summary.split}
- Source URL: ${summary.source_url}
- Source license: ${summary.source_license}
- Source use note: ${summary.source_use_note}
- Input video rows scanned: ${summary.input_rows}
- Output creator rows: ${summary.output_rows}
- Skipped rows: ${summary.skipped_rows}
- Output path: ${summary.output_path || 'none'}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows) process.exitCode = 1
}

main()
