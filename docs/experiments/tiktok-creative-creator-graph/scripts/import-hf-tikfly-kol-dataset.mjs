import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

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
const minVideoCount = Number(args.get('--min-video-count') ?? 3)
const minFollowerCount = Number(args.get('--min-follower-count') ?? 0)
const dryRun = args.has('--dry-run')
const selectedLabels = new Set(String(args.get('--labels') ?? '').split(',').map((label) => label.trim()).filter(Boolean))
const executionId = new Date().toISOString().replace(/[:.]/g, '-')
const provider = 'huggingface_dataset'
const dataset = 'Tikfly/tiktok-top-kol'
const parquetAlias = 'hf://datasets/Tikfly/tiktok-top-kol@~parquet/default/train/0000.parquet'

const labelQueries = [
  {
    target_label: 'filmmaker',
    keywords: ['filmmaker', 'film maker', 'short film', 'shortfilm', 'director of photography', 'documentary filmmaker'],
  },
  {
    target_label: 'director',
    keywords: ['film director', 'director', 'directed by', 'commercial director', 'music video director'],
  },
  {
    target_label: 'cinematographer',
    keywords: ['cinematographer', 'cinematography', 'videographer', 'photographer', 'dp', 'camera operator', 'lighting'],
  },
  {
    target_label: 'editor',
    keywords: ['video editor', 'editor', 'editing', 'after effects', 'premiere pro', 'capcut'],
  },
  {
    target_label: 'vfx_animation',
    keywords: ['animator', 'animation', 'vfx', 'visual effects', 'motion designer', '3d artist', 'digital artist', 'illustrator', 'cgi'],
  },
  {
    target_label: 'sketch_comedian',
    keywords: ['sketch comedy', 'comedian', 'comedy creator', 'comedy', 'humor', 'improv', 'parody', 'funny videos'],
  },
  {
    target_label: 'standup_comedian',
    keywords: ['stand up comedian', 'standup comedian', 'stand-up comedian', 'comic'],
  },
  {
    target_label: 'screenwriter',
    keywords: ['screenwriter', 'writer', 'storyteller', 'author', 'poet', 'script writer', 'scripts'],
  },
  {
    target_label: 'film_educator',
    keywords: ['film analysis', 'movie reviews', 'film reviews', 'explainer', 'educator', 'tutorial', 'tutorials', 'how to', 'tips', 'coach'],
  },
  {
    target_label: 'creative_technologist',
    keywords: ['creative technologist', 'ai artist', 'generative ai', 'ai', 'creative coder', 'developer', 'software', 'designer', 'game developer', 'ar creator', 'vr creator'],
  },
  {
    target_label: 'actor_performer',
    keywords: ['actor', 'actress', 'performer', 'voice actor', 'dancer', 'choreographer', 'singer', 'musician', 'composer', 'producer'],
  },
  {
    target_label: 'behind_the_scenes_creator',
    keywords: ['behind the scenes', 'bts', 'on set', 'production', 'producer'],
  },
]

const fallbackLabels = {
  filmmaker: 'director',
  director: 'filmmaker',
  cinematographer: 'filmmaker',
  editor: 'filmmaker',
  vfx_animation: 'creative_technologist',
  sketch_comedian: 'standup_comedian',
  standup_comedian: 'sketch_comedian',
  screenwriter: 'film_educator',
  film_educator: 'filmmaker',
  creative_technologist: 'vfx_animation',
  behind_the_scenes_creator: 'filmmaker',
}

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeJsonl(path, rows) {
  writeFileSync(path, rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''))
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

function escapeSql(value) {
  return String(value).replaceAll("'", "''")
}

function normalizeHandle(value) {
  const handle = String(value ?? '').trim().replace(/^@/, '').toLowerCase()
  if (!/^[a-z0-9._-]{2,32}$/.test(handle)) return ''
  return `@${handle}`
}

function scrubContactText(value) {
  return String(value ?? '')
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '')
    .replace(/[A-Z0-9._%+-]+@\s*(?:gmail|yahoo|hotmail|outlook|icloud|protonmail)\b(?:\.[A-Z]{2,})?/gi, '')
    .replace(/\b[A-Z0-9._%+-]+\s+at\s+(?:gmail|yahoo|hotmail|outlook|icloud|protonmail)\s+dot\s+[A-Z]{2,}\b/gi, '')
    .replace(/(?:^|[^\d])(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)\d{3}[-.\s]?\d{4}(?=$|[^\d])/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

function whereClauseFor(keywords) {
  return keywords
    .map((keyword) => `lower(coalesce(signature, '')) LIKE '%${escapeSql(keyword.toLowerCase())}%'`)
    .join(' OR ')
}

function queryRowsForLabel(labelQuery) {
  const outputPath = join(tmpdir(), `tikfly-${executionId}-${labelQuery.target_label}.jsonl`)
  const sql = `COPY (
    SELECT uid, sec_uid, unique_id, nickname, signature, region, language, verified, aweme_count, total_favorited, follower_count, following_count
    FROM data
    WHERE secret = false
      AND aweme_count >= ${Math.max(0, minVideoCount)}
      AND follower_count >= ${Math.max(0, minFollowerCount)}
      AND (${whereClauseFor(labelQuery.keywords)})
    ORDER BY follower_count DESC
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

function rowFromDatasetRow(row, labelQuery, rank) {
  const handle = normalizeHandle(row.unique_id)
  if (!handle) return null
  const targetLabel = labelQuery.target_label
  const sourceQuery = labelQuery.keywords.join('|')
  return {
    handle,
    profile_url: `https://www.tiktok.com/${handle}`,
    display_name: row.nickname ?? handle.slice(1),
    bio: scrubContactText(row.signature),
    follower_count: Number(row.follower_count ?? 0),
    following_count: Number(row.following_count ?? 0),
    likes_count: Number(row.total_favorited ?? 0),
    video_count: Number(row.aweme_count ?? 0),
    verified: Boolean(row.verified),
    bio_links: [],
    source_type: 'hf_tikfly_top_kol',
    source_name: 'Hugging Face Tikfly TikTok Top KOL dataset',
    source_url: 'https://huggingface.co/datasets/Tikfly/tiktok-top-kol',
    source_query: sourceQuery,
    target_label: targetLabel,
    source_target_labels: [targetLabel, fallbackLabels[targetLabel]].filter(Boolean),
    acquisition_surface: 'public_profile_dataset',
    provider,
    provider_execution_id: executionId,
    batch_id: `hf_tikfly_${targetLabel}`,
    external_ids: [row.uid, row.sec_uid].filter(Boolean).join('|'),
    region: row.region ?? '',
    language: row.language ?? '',
    rank,
  }
}

async function main() {
  ensureDir(acquisitionResultsDir)
  ensureDir(reportsDir)

  const outputRows = []
  const seenHandles = new Set()
  const labelReports = []

  for (const labelQuery of labelQueries.filter((query) => !selectedLabels.size || selectedLabels.has(query.target_label))) {
    const startedAt = new Date().toISOString()
    let rawRows = []
    let addedRows = 0
    try {
      rawRows = queryRowsForLabel(labelQuery)
      for (const [index, rawRow] of rawRows.entries()) {
        const row = rowFromDatasetRow(rawRow, labelQuery, index + 1)
        if (!row || seenHandles.has(row.handle)) continue
        seenHandles.add(row.handle)
        outputRows.push(row)
        addedRows += 1
        if (outputRows.length >= maxRows) break
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
    if (outputRows.length >= maxRows) break
  }

  const outputPath = join(acquisitionResultsDir, `${executionId}-hf-tikfly-top-kol.jsonl`)
  if (!dryRun && outputRows.length) writeJsonl(outputPath, outputRows)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    provider,
    dataset,
    parquet_alias: parquetAlias,
    source_url: 'https://huggingface.co/datasets/Tikfly/tiktok-top-kol',
    dry_run: dryRun,
    max_rows: maxRows,
    max_rows_per_label: maxRowsPerLabel,
    offset_per_label: offsetPerLabel,
    min_video_count: minVideoCount,
    min_follower_count: minFollowerCount,
    output_rows: outputRows.length,
    output_path: dryRun || !outputRows.length ? '' : outputPath.replace(`${root}/`, ''),
    target_label_counts: outputRows.reduce((acc, row) => {
      acc[row.target_label] = (acc[row.target_label] ?? 0) + 1
      return acc
    }, {}),
    label_reports: labelReports,
    first_rows: outputRows.slice(0, 25),
  }

  writeJson(join(reportsDir, 'hf-tikfly-top-kol-import.json'), summary)
  writeFileSync(join(reportsDir, 'hf-tikfly-top-kol-import.md'), `# Hugging Face Tikfly Top KOL Import

Generated: ${summary.generated_at}

- Provider: ${summary.provider}
- Dataset: ${summary.dataset}
- Source URL: ${summary.source_url}
- Dry run: ${summary.dry_run}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path || 'none'}
- Max rows: ${summary.max_rows}
- Max rows per label: ${summary.max_rows_per_label}
- Offset per label: ${summary.offset_per_label}
- Minimum video count: ${summary.min_video_count}
- Minimum follower count: ${summary.min_follower_count}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n') || '- None'}

## Label Reports

${labelReports.map((row) => `- ${row.target_label}: ${row.status}, raw ${row.raw_rows}, added ${row.unique_rows_added}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
  if (!summary.output_rows && !dryRun) process.exitCode = 1
}

main()
