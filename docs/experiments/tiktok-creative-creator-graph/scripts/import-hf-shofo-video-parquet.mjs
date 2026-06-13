import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxRows = Number(args.get('--max-rows') ?? 10000)
const maxRowsPerLabel = Number(args.get('--max-rows-per-label') ?? 1500)
const offsetPerLabel = Number(args.get('--offset-per-label') ?? 0)
const dryRun = args.has('--dry-run')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'huggingface_dataset_parquet'
const dataset = 'Shofo/shofo-tiktok-general-small'
const parquetAlias = 'hf://datasets/Shofo/shofo-tiktok-general-small/metadata.parquet'

const labelQueries = [
  {
    target_label: 'vfx_animation',
    keywords: ['vfx', 'visual effects', 'aftereffects', 'after effects', 'animation', 'animator', 'motion graphics', 'cgi', 'blender'],
  },
  {
    target_label: 'editor',
    keywords: ['video editor', 'editor', 'edit breakdown', 'editing', 'velocityedit', 'capcut', 'premiere pro', 'davinci'],
  },
  {
    target_label: 'cinematographer',
    keywords: ['cinematography', 'cinematic', 'camera', 'lighting', 'shot on', 'videographer', 'film look'],
  },
  {
    target_label: 'filmmaker',
    keywords: ['filmmaker', 'short film', 'shortfilm', 'movie', 'documentary', 'screenwriter', 'music video'],
  },
  {
    target_label: 'director',
    keywords: ['director', 'directed by', 'film director', 'music video director', 'commercial director'],
  },
  {
    target_label: 'behind_the_scenes_creator',
    keywords: ['behind the scenes', 'bts', 'making of', 'how i made', 'on set', 'setup', 'process'],
  },
  {
    target_label: 'sketch_comedian',
    keywords: ['sketch comedy', 'comedy sketch', 'skit', 'parody', 'improv'],
  },
  {
    target_label: 'standup_comedian',
    keywords: ['stand up', 'standup', 'stand-up', 'comedian', 'open mic', 'crowd work'],
  },
  {
    target_label: 'film_educator',
    keywords: ['tutorial', 'breakdown', 'how to', 'film analysis', 'camera tips', 'lighting setup'],
  },
  {
    target_label: 'creative_technologist',
    keywords: ['ai video', 'runway', 'pika', 'unreal engine', 'creative coding', 'comfyui', 'generative ai'],
  },
]

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
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

function escapeSql(value) {
  return String(value).replaceAll("'", "''")
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._-]{2,32}$/.test(handle)) return ''
  return `@${handle}`
}

function scrubText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function asArray(value) {
  if (Array.isArray(value)) return value.filter((item) => item != null && item !== '')
  if (value == null || value === '') return []
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    if (trimmed.startsWith('[')) {
      try {
        return JSON.parse(trimmed)
      } catch {
        return [trimmed]
      }
    }
    return trimmed.split(/[|;]/).map((item) => item.trim()).filter(Boolean)
  }
  return [value]
}

function normalizeHashtags(value, text) {
  const explicit = asArray(value).map((tag) => String(tag).replace(/^#/, '').toLowerCase()).filter(Boolean)
  const caption = String(text ?? '').match(/#[\p{L}\p{N}_-]+/gu)?.map((tag) => tag.slice(1).toLowerCase()) ?? []
  return Array.from(new Set([...explicit, ...caption]))
}

function whereClauseFor(keywords) {
  const haystack = "lower(coalesce(description, '') || ' ' || coalesce(transcript, '') || ' ' || coalesce(hashtags, '') || ' ' || coalesce(creator, ''))"
  return keywords
    .map((keyword) => `${haystack} LIKE '%${escapeSql(keyword.toLowerCase())}%'`)
    .join(' OR ')
}

function queryRowsForLabel(labelQuery) {
  const outputPath = join(tmpdir(), `shofo-${executionId}-${labelQuery.target_label}.jsonl`)
  const sql = `COPY (
    SELECT creator, web_url, description, transcript, hashtags, date_posted, engagement_metrics, video_id
    FROM data
    WHERE creator IS NOT NULL
      AND web_url IS NOT NULL
      AND (${whereClauseFor(labelQuery.keywords)})
    ORDER BY creator, video_id
    LIMIT ${Math.max(1, maxRowsPerLabel)}
    OFFSET ${Math.max(0, offsetPerLabel)}
  ) TO '${escapeSql(outputPath)}' (FORMAT JSON)`

  if (!dryRun) {
    execFileSync('npx', [
      '-y',
      '-p',
      'parquetlens',
      '-p',
      '@parquetlens/sql',
      'parquetlens',
      parquetAlias,
      '--sql',
      sql,
    ], { stdio: ['ignore', 'pipe', 'pipe'] })
  }

  return dryRun ? [] : readJsonl(outputPath)
}

function mergeCreator(existing, row, labelQuery, rank) {
  const handle = normalizeHandle(row.creator ?? row.web_url)
  if (!handle) return existing
  const caption = scrubText(row.description ?? '')
  const candidate = {
    handle,
    profile_url: `https://www.tiktok.com/${handle}`,
    display_name: handle.slice(1),
    bio: scrubText(row.description ?? row.transcript ?? ''),
    follower_count: 0,
    likes_count: 0,
    video_count: 1,
    source_type: 'hf_shofo_video_parquet',
    source_name: 'Hugging Face Shofo TikTok general small',
    source_url: 'https://huggingface.co/datasets/Shofo/shofo-tiktok-general-small',
    source_query: labelQuery.keywords.join('|'),
    target_label: labelQuery.target_label,
    source_target_labels: [labelQuery.target_label],
    acquisition_surface: 'public_video_dataset',
    provider,
    provider_execution_id: executionId,
    batch_id: `hf_shofo_${labelQuery.target_label}`,
    rank,
    videos: [{
      url: row.web_url ?? '',
      caption,
      posted_at: row.date_posted ?? null,
      view_count: 0,
      like_count: 0,
      comment_count: 0,
      share_count: 0,
      hashtags: normalizeHashtags(row.hashtags, caption),
      mentions: [],
      sound_id: '',
      sound_title: '',
    }],
  }
  if (!existing) return candidate
  return {
    ...existing,
    bio: existing.bio.length >= candidate.bio.length ? existing.bio : candidate.bio,
    video_count: Number(existing.video_count ?? 0) + 1,
    source_query: Array.from(new Set(`${existing.source_query}|${candidate.source_query}`.split('|').filter(Boolean))).slice(0, 20).join('|'),
    source_target_labels: Array.from(new Set([...(existing.source_target_labels ?? []), labelQuery.target_label])),
    videos: [...(existing.videos ?? []), ...candidate.videos].slice(0, 25),
  }
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const creators = new Map()
  const labelReports = []

  for (const labelQuery of labelQueries) {
    const startedAt = new Date().toISOString()
    let rawRows = []
    let addedRows = 0
    try {
      rawRows = queryRowsForLabel(labelQuery)
      for (const [index, rawRow] of rawRows.entries()) {
        const handle = normalizeHandle(rawRow.creator ?? rawRow.web_url)
        if (!handle) continue
        if (!creators.has(handle)) addedRows += 1
        creators.set(handle, mergeCreator(creators.get(handle), rawRow, labelQuery, index + 1))
        if (creators.size >= maxRows) break
      }
      labelReports.push({
        target_label: labelQuery.target_label,
        status: dryRun ? 'dry_run' : 'succeeded',
        keywords: labelQuery.keywords,
        raw_rows: rawRows.length,
        unique_rows_added: addedRows,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    } catch (error) {
      labelReports.push({
        target_label: labelQuery.target_label,
        status: 'failed',
        error: error.message,
        keywords: labelQuery.keywords,
        raw_rows: rawRows.length,
        unique_rows_added: addedRows,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      })
    }
    if (creators.size >= maxRows) break
  }

  const outputRows = Array.from(creators.values()).map((row, index) => ({ ...row, rank: index + 1 }))
  const outputPath = join(acquisitionResultsDir, `${executionId}-hf-shofo-video-parquet.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dataset,
    parquet_alias: parquetAlias,
    source_url: 'https://huggingface.co/datasets/Shofo/shofo-tiktok-general-small',
    source_license: 'other',
    source_use_note: 'Candidate acquisition only; inspect dataset card/license before production release use.',
    dry_run: dryRun,
    max_rows: maxRows,
    max_rows_per_label: maxRowsPerLabel,
    offset_per_label: offsetPerLabel,
    output_rows: outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    label_reports: labelReports,
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'hf-shofo-video-parquet-import.json'), summary)
  writeFileSync(join(reportsDir, 'hf-shofo-video-parquet-import.md'), `# Hugging Face Shofo Video Parquet Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dataset: ${summary.dataset}
- Source URL: ${summary.source_url}
- Source license: ${summary.source_license}
- Dry run: ${summary.dry_run}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Max rows: ${summary.max_rows}
- Max rows per label: ${summary.max_rows_per_label}
- Offset per label: ${summary.offset_per_label}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Label Reports

${labelReports.map((row) => `- ${row.target_label}: ${row.status}, raw ${row.raw_rows}, added ${row.unique_rows_added}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows && !dryRun) process.exitCode = 1
}

main()
