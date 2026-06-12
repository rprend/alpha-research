import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const maxRows = 500

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

function safeDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return ''
  }
}

function labelPhrase(label) {
  return String(label || 'creator').replaceAll('_', ' ')
}

function addCandidate(map, row) {
  if (!row.target) return
  const key = `${row.expansion_type}:${String(row.target).toLowerCase()}`
  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      expansion_type: row.expansion_type,
      source_creator_id: row.source_creator_id ?? '',
      target: row.target,
      priority: row.priority ?? 3,
      reason: row.reason ?? '',
      primary_label: row.primary_label ?? '',
      overall_usefulness: row.overall_usefulness ?? '',
      evidence_count: row.evidence_count ?? 1,
    })
    return
  }
  existing.priority = Math.min(Number(existing.priority ?? 3), Number(row.priority ?? 3))
  existing.evidence_count = Number(existing.evidence_count ?? 1) + Number(row.evidence_count ?? 1)
  if (row.reason && !String(existing.reason).includes(row.reason)) existing.reason = `${existing.reason}|${row.reason}`.replace(/^\|/, '')
  existing.overall_usefulness = Math.max(Number(existing.overall_usefulness ?? 0), Number(row.overall_usefulness ?? 0))
}

function main() {
  const baseQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const videos = readJsonl(join(processedDir, 'creator_videos.jsonl'))
  const scores = readJsonl(join(processedDir, 'creator_scores.jsonl'))
  const classifications = readJsonl(join(processedDir, 'creator_classifications.jsonl'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const byScore = new Map(scores.map((row) => [row.creator_id, row]))
  const byClass = new Map(classifications.map((row) => [row.creator_id, row]))
  const videosByCreator = new Map()
  for (const video of videos) {
    const rows = videosByCreator.get(video.creator_id) ?? []
    rows.push(video)
    videosByCreator.set(video.creator_id, rows)
  }

  const candidates = new Map()
  for (const row of baseQueue) addCandidate(candidates, row)

  for (const account of accounts) {
    const score = byScore.get(account.id)
    const classification = byClass.get(account.id)
    if (!['useful', 'excellent'].includes(score?.status)) continue
    const label = classification?.primary_label ?? ''
    const usefulness = Number(score.overall_usefulness ?? 0)
    for (const link of account.bio_links ?? []) {
      const domain = safeDomain(link)
      if (!domain) continue
      const highSignalDomain = ['instagram.com', 'youtube.com', 'imdb.com', 'linktr.ee', 'beacons.ai', 'vimeo.com'].some((known) => domain.endsWith(known))
      if (!highSignalDomain) continue
      addCandidate(candidates, {
        expansion_type: 'cross_platform_search',
        source_creator_id: account.id,
        target: `site:${domain} "tiktok.com/@" "${labelPhrase(label)}"`,
        priority: score.status === 'excellent' ? 1 : 2,
        reason: `cross_platform_adjacency:${domain}`,
        primary_label: label,
        overall_usefulness: usefulness,
      })
    }

    const creatorVideos = videosByCreator.get(account.id) ?? []
    const hashtagCounts = new Map()
    for (const video of creatorVideos) {
      for (const hashtag of video.hashtags ?? []) {
        const clean = String(hashtag).replace(/^#/, '').toLowerCase()
        if (clean.length < 3) continue
        hashtagCounts.set(clean, (hashtagCounts.get(clean) ?? 0) + 1)
      }
    }
    for (const [hashtag, count] of [...hashtagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)) {
      addCandidate(candidates, {
        expansion_type: 'hashtag_search',
        source_creator_id: account.id,
        target: hashtag,
        priority: count > 1 || score.status === 'excellent' ? 1 : 2,
        reason: `useful_creator_hashtag:${account.handle}`,
        primary_label: label,
        overall_usefulness: usefulness,
        evidence_count: count,
      })
    }
  }

  for (const row of sourceYield.filter((item) => Number(item.useful_creators ?? 0) > 0).slice(0, 25)) {
    if (!row.source_query) continue
    addCandidate(candidates, {
      expansion_type: 'yield_replay_search',
      source_creator_id: '',
      target: row.source_query,
      priority: Number(row.excellent_creators ?? 0) > 0 ? 1 : 2,
      reason: `replay_high_yield_source:${row.source_type}`,
      primary_label: '',
      overall_usefulness: Number(row.average_usefulness ?? 0),
      evidence_count: Number(row.useful_creators ?? 1),
    })
  }

  const rows = [...candidates.values()]
    .sort((a, b) => Number(a.priority) - Number(b.priority) || Number(b.overall_usefulness) - Number(a.overall_usefulness) || String(a.target).localeCompare(String(b.target)))
    .slice(0, maxRows)

  writeJsonl(join(processedDir, 'expansion_queue.jsonl'), rows)
  writeCsv(join(processedDir, 'expansion_queue.csv'), rows)

  const summary = {
    generated_at: new Date().toISOString(),
    base_rows: baseQueue.length,
    expansion_rows: rows.length,
    added_rows: Math.max(0, rows.length - baseQueue.length),
    type_counts: rows.reduce((acc, row) => {
      acc[row.expansion_type] = (acc[row.expansion_type] ?? 0) + 1
      return acc
    }, {}),
    top_rows: rows.slice(0, 25),
  }
  writeJson(join(reportsDir, 'adjacency-expansion.json'), summary)
  writeFileSync(join(reportsDir, 'adjacency-expansion.md'), `# Adjacency Expansion

Generated: ${summary.generated_at}

- Base rows: ${summary.base_rows}
- Expansion rows: ${summary.expansion_rows}
- Added rows: ${summary.added_rows}

## Types

${Object.entries(summary.type_counts).map(([type, count]) => `- ${type}: ${count}`).join('\n') || '- None'}

## Top Rows

| Type | Priority | Target | Reason |
| --- | ---: | --- | --- |
${summary.top_rows.map((row) => `| ${row.expansion_type} | ${row.priority} | ${String(row.target).replaceAll('|', '\\|')} | ${String(row.reason).replaceAll('|', '; ')} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
