import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
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
const previewOnly = args.has('--preview') || args.has('--dry-run')
const minNormalizedRate = Number(args.get('--min-normalized-rate') ?? 0.75)
const maxDuplicateRate = Number(args.get('--max-duplicate-rate') ?? 0.35)
const explicitOutputPath = args.get('--output') ? join(root, String(args.get('--output'))) : null
const defaultOutputDate = new Date().toISOString().slice(0, 10)

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
  writeFileSync(path, jsonlText(rows))
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

function buildRunHistoryIndex() {
  const runs = readJsonl(join(processedDir, 'acquisition_run_history.jsonl'))
  const byOutputFile = new Map()
  const byBatchId = new Map()
  for (const run of runs) {
    for (const result of run.results ?? []) {
      const meta = {
        wave_id: run.wave_id ?? result.wave_id ?? '',
        execution_id: run.execution_id ?? result.execution_id ?? '',
        batch_id: result.batch_id ?? '',
        provider: run.provider ?? result.provider ?? '',
        run_status: result.status ?? run.status ?? '',
        actor_id: result.actor_id ?? '',
        output_path: result.output_path ?? '',
      }
      if (meta.output_path) byOutputFile.set(basename(meta.output_path), meta)
      if (meta.batch_id) {
        const matches = byBatchId.get(meta.batch_id) ?? []
        matches.push(meta)
        byBatchId.set(meta.batch_id, matches)
      }
    }
  }
  return { byOutputFile, byBatchId }
}

function lineageForRow(row, sourceFile, index) {
  const fileMeta = index.byOutputFile.get(sourceFile)
  const batchMeta = row.batch_id ? index.byBatchId.get(row.batch_id)?.at(-1) : null
  const meta = fileMeta ?? batchMeta ?? {}
  const waveId = row.wave_id ?? row.scale_wave_id ?? row._source_wave_id ?? meta.wave_id ?? ''
  const executionId = row.execution_id ?? row.provider_execution_id ?? meta.execution_id ?? ''
  const batchId = row.batch_id ?? meta.batch_id ?? ''
  const provider = row.provider ?? meta.provider ?? ''
  return {
    _source_wave_id: waveId,
    _source_execution_id: executionId,
    _source_batch_id: batchId,
    _source_provider: provider,
    _source_run_status: row.provider_status ?? row.run_status ?? meta.run_status ?? '',
    _source_actor_id: row.actor_id ?? meta.actor_id ?? '',
    _lineage_mapped: Boolean(waveId || executionId || batchId),
  }
}

function loadRows() {
  const lineageIndex = buildRunHistoryIndex()
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
    const sourceFile = basename(path)
    for (const row of parsed) {
      rows.push({
        ...row,
        _source_file: sourceFile,
        ...lineageForRow(row, sourceFile, lineageIndex),
      })
    }
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
    source_wave_id: row._source_wave_id ?? '',
    source_execution_id: row._source_execution_id ?? '',
    source_batch_id: row._source_batch_id ?? '',
    source_provider: row._source_provider ?? '',
    source_run_status: row._source_run_status ?? '',
    source_actor_id: row._source_actor_id ?? '',
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
    source_wave_id: row._source_wave_id ?? '',
    source_execution_id: row._source_execution_id ?? '',
    source_batch_id: row._source_batch_id ?? '',
    source_provider: row._source_provider ?? '',
    source_run_status: row._source_run_status ?? '',
    source_actor_id: row._source_actor_id ?? '',
    videos: [],
  }
}

function mergeRows(rows) {
  const merged = new Map()
  const stats = {
    input_rows: rows.length,
    normalized_rows: 0,
    skipped_rows: 0,
    duplicate_normalized_rows: 0,
    source_files: {},
    mapped_lineage_rows: 0,
    unmapped_lineage_rows: 0,
    wave_ids: {},
    execution_ids: {},
    batch_ids: {},
    lineage_providers: {},
  }

  for (const row of rows) {
    stats.source_files[row._source_file] = (stats.source_files[row._source_file] ?? 0) + 1
    if (row._lineage_mapped) stats.mapped_lineage_rows += 1
    else stats.unmapped_lineage_rows += 1
    if (row._source_wave_id) stats.wave_ids[row._source_wave_id] = (stats.wave_ids[row._source_wave_id] ?? 0) + 1
    if (row._source_execution_id) stats.execution_ids[row._source_execution_id] = (stats.execution_ids[row._source_execution_id] ?? 0) + 1
    if (row._source_batch_id) stats.batch_ids[row._source_batch_id] = (stats.batch_ids[row._source_batch_id] ?? 0) + 1
    if (row._source_provider) stats.lineage_providers[row._source_provider] = (stats.lineage_providers[row._source_provider] ?? 0) + 1
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
      merged.set(canonical.handle, {
        ...canonical,
        acquisition_source_files: [row._source_file],
        acquisition_wave_ids: asArray(canonical.source_wave_id),
        acquisition_execution_ids: asArray(canonical.source_execution_id),
        acquisition_batch_ids: asArray(canonical.source_batch_id),
        acquisition_providers: asArray(canonical.source_provider),
      })
      continue
    }
    stats.duplicate_normalized_rows += 1
    existing.display_name ||= canonical.display_name
    existing.bio = existing.bio.length >= canonical.bio.length ? existing.bio : canonical.bio
    existing.avatar_url ||= canonical.avatar_url
    existing.follower_count = Math.max(existing.follower_count, canonical.follower_count)
    existing.likes_count = Math.max(existing.likes_count, canonical.likes_count)
    existing.verified = existing.verified || canonical.verified
    existing.bio_links = Array.from(new Set([...existing.bio_links, ...canonical.bio_links]))
    existing.videos = [...existing.videos, ...canonical.videos]
    existing.acquisition_source_files = Array.from(new Set([...existing.acquisition_source_files, row._source_file]))
    existing.acquisition_wave_ids = Array.from(new Set([...asArray(existing.acquisition_wave_ids), ...asArray(canonical.source_wave_id)]))
    existing.acquisition_execution_ids = Array.from(new Set([...asArray(existing.acquisition_execution_ids), ...asArray(canonical.source_execution_id)]))
    existing.acquisition_batch_ids = Array.from(new Set([...asArray(existing.acquisition_batch_ids), ...asArray(canonical.source_batch_id)]))
    existing.acquisition_providers = Array.from(new Set([...asArray(existing.acquisition_providers), ...asArray(canonical.source_provider)]))
  }

  const accounts = Array.from(merged.values()).map((account) => ({
    ...account,
    videos: account.videos.slice(0, 50),
  }))
  return { accounts, stats }
}

function jsonlText(rows) {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
}

function hashRows(rows) {
  return createHash('sha256').update(jsonlText(rows)).digest('hex').slice(0, 12)
}

function outputPathFor(accounts) {
  if (explicitOutputPath) return explicitOutputPath
  const basePath = join(importDir, `acquisition-import-${defaultOutputDate}.jsonl`)
  if (!existsSync(basePath)) return basePath
  const nextText = jsonlText(accounts)
  if (readFileSync(basePath, 'utf8') === nextText) return basePath
  return join(importDir, `acquisition-import-${defaultOutputDate}-${hashRows(accounts)}.jsonl`)
}

function buildQualityGate(stats, accounts) {
  const normalizedRate = stats.input_rows > 0 ? stats.normalized_rows / stats.input_rows : 0
  const duplicateRate = stats.normalized_rows > 0 ? stats.duplicate_normalized_rows / stats.normalized_rows : 0
  const outputRate = stats.input_rows > 0 ? accounts.length / stats.input_rows : 0
  const checks = [
    {
      id: 'has_rows',
      status: stats.input_rows > 0 ? 'pass' : 'fail',
      evidence: `${stats.input_rows} input rows`,
    },
    {
      id: 'handle_extraction',
      status: normalizedRate >= minNormalizedRate ? 'pass' : 'fail',
      evidence: `${(normalizedRate * 100).toFixed(1)}% normalized, threshold ${(minNormalizedRate * 100).toFixed(1)}%`,
    },
    {
      id: 'duplicate_pressure',
      status: duplicateRate <= maxDuplicateRate ? 'pass' : 'fail',
      evidence: `${(duplicateRate * 100).toFixed(1)}% duplicate normalized rows, threshold ${(maxDuplicateRate * 100).toFixed(1)}%`,
    },
    {
      id: 'lineage_mapping',
      status: stats.mapped_lineage_rows > 0 || stats.input_rows === 0 ? 'pass' : 'warn',
      evidence: stats.mapped_lineage_rows > 0
        ? `${stats.mapped_lineage_rows}/${stats.input_rows} rows mapped to provider/wave lineage`
        : 'no provider/wave lineage mapped; acceptable only for ad hoc search exports',
    },
  ]
  return {
    ready_to_import: checks.every((check) => check.status !== 'fail'),
    normalized_rate: normalizedRate,
    duplicate_rate: duplicateRate,
    output_rate: outputRate,
    min_normalized_rate: minNormalizedRate,
    max_duplicate_rate: maxDuplicateRate,
    checks,
  }
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
    mapped_lineage_rows: stats.mapped_lineage_rows,
    unmapped_lineage_rows: stats.unmapped_lineage_rows,
    scale_wave_ids: Object.keys(stats.wave_ids).join('|'),
    execution_ids: Object.keys(stats.execution_ids).join('|'),
    batch_ids: Object.keys(stats.batch_ids).join('|'),
    lineage_providers: Object.keys(stats.lineage_providers).join('|'),
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
    mapped_lineage_rows: row.mapped_lineage_rows ?? 0,
    unmapped_lineage_rows: row.unmapped_lineage_rows ?? 0,
    scale_wave_ids: row.scale_wave_ids ?? '',
    execution_ids: row.execution_ids ?? '',
    batch_ids: row.batch_ids ?? '',
    lineage_providers: row.lineage_providers ?? '',
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
  const outputPath = outputPathFor(accounts)
  const report = {
    generated_at: new Date().toISOString(),
    mode: previewOnly ? 'preview' : 'import',
    input_rows: stats.input_rows,
    normalized_rows: stats.normalized_rows,
    skipped_rows: stats.skipped_rows,
    duplicate_normalized_rows: stats.duplicate_normalized_rows,
    output_accounts: accounts.length,
    source_files: stats.source_files,
    mapped_lineage_rows: stats.mapped_lineage_rows,
    unmapped_lineage_rows: stats.unmapped_lineage_rows,
    scale_wave_ids: stats.wave_ids,
    execution_ids: stats.execution_ids,
    batch_ids: stats.batch_ids,
    lineage_providers: stats.lineage_providers,
    output_path: outputPath.replace(`${root}/`, ''),
  }
  report.quality_gate = buildQualityGate(stats, accounts)
  if (previewOnly) {
    report.output_path = ''
    report.preview_accounts = accounts.slice(0, 25).map((account) => ({
      handle: account.handle,
      display_name: account.display_name,
      source_type: account.source_type,
      source_query: account.source_query,
      videos: account.videos.length,
      acquisition_wave_ids: account.acquisition_wave_ids,
      acquisition_batch_ids: account.acquisition_batch_ids,
      acquisition_providers: account.acquisition_providers,
    }))
    writeJson(join(reportsDir, 'acquisition-import-preview.json'), report)
    writeFileSync(join(reportsDir, 'acquisition-import-preview.md'), `# Acquisition Import Preview

Generated: ${report.generated_at}

- Input rows: ${report.input_rows}
- Normalized rows: ${report.normalized_rows}
- Skipped rows: ${report.skipped_rows}
- Duplicate normalized rows: ${report.duplicate_normalized_rows}
- Output accounts if imported: ${report.output_accounts}
- Ready to import: ${report.quality_gate.ready_to_import ? 'yes' : 'no'}
- Normalized rate: ${(report.quality_gate.normalized_rate * 100).toFixed(1)}%
- Duplicate rate: ${(report.quality_gate.duplicate_rate * 100).toFixed(1)}%
- Mapped lineage rows: ${report.mapped_lineage_rows}
- Unmapped lineage rows: ${report.unmapped_lineage_rows}

## Checks

${report.quality_gate.checks.map((check) => `- ${check.id}: ${check.status} - ${check.evidence}`).join('\n')}

## Source Files

${Object.entries(report.source_files).map(([file, count]) => `- ${file}: ${count}`).join('\n')}
`)
    console.log(JSON.stringify(report, null, 2))
    return
  }
  writeJsonl(outputPath, accounts)
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
- Mapped lineage rows: ${report.mapped_lineage_rows}
- Unmapped lineage rows: ${report.unmapped_lineage_rows}

## Source Files

${Object.entries(report.source_files).map(([file, count]) => `- ${file}: ${count}`).join('\n')}

## Lineage

- Scale waves: ${Object.entries(report.scale_wave_ids).map(([id, count]) => `${id}=${count}`).join(', ') || 'none'}
- Executions: ${Object.entries(report.execution_ids).map(([id, count]) => `${id}=${count}`).join(', ') || 'none'}
- Batches: ${Object.entries(report.batch_ids).map(([id, count]) => `${id}=${count}`).join(', ') || 'none'}
- Providers: ${Object.entries(report.lineage_providers).map(([id, count]) => `${id}=${count}`).join(', ') || 'none'}

## Wave

- Wave id: ${wave.wave_id}
- Source file count: ${wave.source_file_count}
- Scale waves: ${wave.scale_wave_ids || 'none'}
- Executions: ${wave.execution_ids || 'none'}
- Batches: ${wave.batch_ids || 'none'}
- Lineage providers: ${wave.lineage_providers || 'none'}
- Target labels: ${Object.entries(wave.target_label_counts).map(([label, count]) => `${label}=${count}`).join(', ') || 'none'}
- Surfaces: ${Object.entries(wave.surface_counts).map(([surface, count]) => `${surface}=${count}`).join(', ') || 'none'}
`)
  console.log(JSON.stringify(report, null, 2))
}

main()
