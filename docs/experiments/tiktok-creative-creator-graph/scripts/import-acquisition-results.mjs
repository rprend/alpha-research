import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const acquisitionResultsDir = join(experimentDir, 'data/raw/acquisition-results')
const importDir = join(experimentDir, 'data/raw/imports')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const inputPath = args.get('--input') ? join(root, String(args.get('--input'))) : null
const outputPath = args.get('--output')
  ? join(root, String(args.get('--output')))
  : join(importDir, `acquisition-import-${new Date().toISOString().slice(0, 10)}.jsonl`)

function ensureDir(path) {
  mkdirSync(path, { recursive: true })
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function toNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function normalizeHandle(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return null
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : null
}

function extractHashtags(text) {
  return Array.from(new Set(String(text ?? '').match(/#[\p{L}\p{N}_-]+/gu)?.map((tag) => tag.slice(1).toLowerCase()) ?? []))
}

function extractMentions(text) {
  return Array.from(new Set(String(text ?? '').match(/@[A-Za-z0-9._-]+/g)?.map(normalizeHandle).filter(Boolean) ?? []))
}

function normalizeHashtags(value, text) {
  const explicit = asArray(value).map((tag) => {
    if (typeof tag === 'object' && tag) return String(tag.name ?? tag.title ?? tag.id ?? '').replace(/^#/, '').toLowerCase()
    return String(tag).replace(/^#/, '').toLowerCase()
  }).filter(Boolean)
  return Array.from(new Set([...explicit, ...extractHashtags(text)]))
}

function loadRows() {
  const paths = []
  if (inputPath) {
    paths.push(inputPath)
  } else if (existsSync(acquisitionResultsDir)) {
    for (const file of readdirSync(acquisitionResultsDir).sort()) {
      const path = join(acquisitionResultsDir, file)
      if (['.jsonl', '.json', '.csv'].includes(extname(path))) paths.push(path)
    }
  }

  const rows = []
  for (const path of paths) {
    const extension = extname(path)
    const parsed = extension === '.jsonl'
      ? readJsonl(path)
      : extension === '.json'
        ? asArray(readJson(path))
        : readCsv(path)
    for (const row of parsed) rows.push({ ...row, _source_file: basename(path) })
  }
  return rows
}

function sourceTypeFor(row) {
  if (row.authorMeta || row.author || row.webVideoUrl || row.playCount != null) return 'provider_video_export'
  if (row.query || row.snippet || row.title) return 'search_result_export'
  return 'acquisition_export'
}

function canonicalFromProvider(row) {
  const author = row.authorMeta ?? row.author ?? row.author_meta ?? {}
  const handle = normalizeHandle(author.name ?? author.uniqueId ?? row.author_unique_id ?? row.username ?? row.handle ?? row.profile_url ?? row.url ?? row.webVideoUrl)
  if (!handle) return null
  const caption = row.text ?? row.caption ?? row.description ?? ''
  const videoUrl = row.webVideoUrl ?? row.video_url ?? row.url ?? ''
  const profileUrl = row.profile_url ?? `https://www.tiktok.com/${handle}`
  return {
    handle,
    display_name: author.nickName ?? author.nickname ?? row.display_name ?? row.name ?? handle.slice(1),
    bio: author.signature ?? row.bio ?? row.description ?? '',
    profile_url: profileUrl,
    avatar_url: author.avatar ?? author.avatarThumb ?? row.avatar_url ?? '',
    follower_count: toNumber(author.fans ?? author.follower_count ?? row.follower_count ?? row.followers),
    likes_count: toNumber(author.heart ?? author.likes_count ?? row.likes_count ?? row.hearts),
    verified: Boolean(author.verified ?? row.verified),
    bio_links: asArray(row.bio_links ?? row.external_links ?? row.link),
    source_type: sourceTypeFor(row),
    source_query: row.query ?? row.search_query ?? '',
    source_url: row.source_url ?? videoUrl ?? profileUrl,
    videos: videoUrl || caption
      ? [{
          url: videoUrl,
          caption,
          posted_at: row.createTimeISO ?? row.create_time_iso ?? row.posted_at ?? row.date ?? null,
          view_count: toNumber(row.playCount ?? row.view_count ?? row.views),
          like_count: toNumber(row.diggCount ?? row.like_count ?? row.likes),
          comment_count: toNumber(row.commentCount ?? row.comment_count ?? row.comments),
          share_count: toNumber(row.shareCount ?? row.share_count ?? row.shares),
          hashtags: normalizeHashtags(row.hashtags, caption),
          mentions: Array.from(new Set([...asArray(row.mentions).map(normalizeHandle).filter(Boolean), ...extractMentions(caption)])),
          sound_id: row.musicMeta?.musicId ?? row.music_id ?? row.sound_id ?? '',
          sound_title: row.musicMeta?.musicName ?? row.music_title ?? row.sound_title ?? '',
        }]
      : [],
  }
}

function canonicalFromSearch(row) {
  const profileUrl = row.profile_url ?? row.url ?? row.link ?? ''
  const handle = normalizeHandle(row.handle ?? row.username ?? profileUrl)
  if (!handle) return null
  const snippet = row.snippet ?? row.description ?? row.title ?? ''
  return {
    handle,
    display_name: row.display_name ?? row.name ?? String(row.title ?? '').replace(/\s+-?\s*on TikTok.*/i, '').trim(),
    bio: snippet,
    profile_url: `https://www.tiktok.com/${handle}`,
    avatar_url: row.avatar_url ?? '',
    follower_count: toNumber(row.follower_count ?? row.followers),
    likes_count: toNumber(row.likes_count ?? row.likes),
    verified: Boolean(row.verified === true || row.verified === 'true'),
    bio_links: asArray(row.bio_links ?? row.external_links),
    source_type: sourceTypeFor(row),
    source_query: row.query ?? row.search_query ?? '',
    source_url: row.source_url ?? profileUrl,
    videos: [],
  }
}

function mergeRows(rows) {
  const merged = new Map()
  const stats = {
    input_rows: rows.length,
    normalized_rows: 0,
    skipped_rows: 0,
    source_files: {},
  }

  for (const row of rows) {
    stats.source_files[row._source_file] = (stats.source_files[row._source_file] ?? 0) + 1
    const canonical = (row.authorMeta || row.author || row.webVideoUrl || row.playCount != null)
      ? canonicalFromProvider(row)
      : canonicalFromSearch(row)
    if (!canonical) {
      stats.skipped_rows += 1
      continue
    }
    stats.normalized_rows += 1
    const existing = merged.get(canonical.handle)
    if (!existing) {
      merged.set(canonical.handle, { ...canonical, acquisition_source_files: [row._source_file] })
      continue
    }
    existing.display_name ||= canonical.display_name
    existing.bio = existing.bio.length >= canonical.bio.length ? existing.bio : canonical.bio
    existing.avatar_url ||= canonical.avatar_url
    existing.follower_count = Math.max(existing.follower_count, canonical.follower_count)
    existing.likes_count = Math.max(existing.likes_count, canonical.likes_count)
    existing.verified = existing.verified || canonical.verified
    existing.bio_links = Array.from(new Set([...existing.bio_links, ...canonical.bio_links]))
    existing.videos = [...existing.videos, ...canonical.videos]
    existing.acquisition_source_files = Array.from(new Set([...existing.acquisition_source_files, row._source_file]))
  }

  const accounts = Array.from(merged.values()).map((account) => ({
    ...account,
    videos: account.videos.slice(0, 50),
  }))
  return { accounts, stats }
}

function summarizeWave(rows, accounts, stats, report) {
  const targetLabelCounts = rows.reduce((acc, row) => {
    const label = row.target_label || row.targetLabel || 'unclassified'
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})
  const surfaceCounts = rows.reduce((acc, row) => {
    const surface = row.acquisition_surface || row.surface || sourceTypeFor(row)
    acc[surface] = (acc[surface] ?? 0) + 1
    return acc
  }, {})
  const providerCounts = rows.reduce((acc, row) => {
    const provider = row.provider || 'unknown'
    acc[provider] = (acc[provider] ?? 0) + 1
    return acc
  }, {})
  const sourceFiles = Object.keys(stats.source_files)
  return {
    wave_id: `import-${new Date().toISOString().replace(/[:.]/g, '-')}`,
    generated_at: report.generated_at,
    input_rows: stats.input_rows,
    normalized_rows: stats.normalized_rows,
    skipped_rows: stats.skipped_rows,
    output_accounts: accounts.length,
    source_file_count: sourceFiles.length,
    source_files: sourceFiles.join('|'),
    output_path: report.output_path,
    target_label_counts: targetLabelCounts,
    surface_counts: surfaceCounts,
    provider_counts: providerCounts,
  }
}

function upsertWave(wave) {
  ensureDir(processedDir)
  const path = join(processedDir, 'acquisition_import_waves.jsonl')
  const existing = readJsonl(path).filter((row) => row.output_path !== wave.output_path)
  const rows = [...existing, wave]
  writeJsonl(path, rows)
  writeCsv(join(processedDir, 'acquisition_import_waves.csv'), rows.map((row) => ({
    wave_id: row.wave_id,
    generated_at: row.generated_at,
    input_rows: row.input_rows,
    normalized_rows: row.normalized_rows,
    skipped_rows: row.skipped_rows,
    output_accounts: row.output_accounts,
    source_file_count: row.source_file_count,
    source_files: row.source_files,
    output_path: row.output_path,
    target_label_counts: JSON.stringify(row.target_label_counts),
    surface_counts: JSON.stringify(row.surface_counts),
    provider_counts: JSON.stringify(row.provider_counts),
  })))
  return rows
}

function main() {
  ensureDir(importDir)
  ensureDir(processedDir)
  ensureDir(reportsDir)
  const rows = loadRows()
  const { accounts, stats } = mergeRows(rows)
  writeJsonl(outputPath, accounts)
  const report = {
    generated_at: new Date().toISOString(),
    input_rows: stats.input_rows,
    normalized_rows: stats.normalized_rows,
    skipped_rows: stats.skipped_rows,
    output_accounts: accounts.length,
    source_files: stats.source_files,
    output_path: outputPath.replace(`${root}/`, ''),
  }
  const wave = summarizeWave(rows, accounts, stats, report)
  const waves = upsertWave(wave)
  report.wave = wave
  report.import_waves = waves.length
  writeJson(join(reportsDir, 'acquisition-import.json'), report)
  writeFileSync(join(reportsDir, 'acquisition-import.md'), `# Acquisition Import

Generated: ${report.generated_at}

- Input rows: ${report.input_rows}
- Normalized rows: ${report.normalized_rows}
- Skipped rows: ${report.skipped_rows}
- Output accounts: ${report.output_accounts}
- Output path: \`${report.output_path}\`
- Import waves tracked: ${report.import_waves}

## Source Files

${Object.entries(report.source_files).map(([file, count]) => `- ${file}: ${count}`).join('\n')}

## Wave

- Wave id: ${wave.wave_id}
- Source file count: ${wave.source_file_count}
- Target labels: ${Object.entries(wave.target_label_counts).map(([label, count]) => `${label}=${count}`).join(', ') || 'none'}
- Surfaces: ${Object.entries(wave.surface_counts).map(([surface, count]) => `${surface}=${count}`).join(', ') || 'none'}
`)
  console.log(JSON.stringify(report, null, 2))
}

main()
