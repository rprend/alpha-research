import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

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
  if (!raw) return ''
  const fromUrl = raw.match(/tiktok\.com\/@([A-Za-z0-9._-]+)/i)?.[1]
  const handle = (fromUrl ?? raw).replace(/^@/, '').toLowerCase()
  return handle ? `@${handle}` : ''
}

function targetKind(value) {
  const text = String(value ?? '').trim()
  if (!text) return 'unknown'
  if (normalizeHandle(text) && /^(@|https?:\/\/(www\.)?tiktok\.com\/@)/i.test(text)) return 'handle'
  if (text.startsWith('#')) return 'hashtag'
  if (/site:tiktok\.com\/@/i.test(text)) return 'search_query'
  if (/^https?:\/\/(www\.)?tiktok\.com\/@/i.test(text)) return 'handle'
  return 'query'
}

function targetKey(value) {
  const kind = targetKind(value)
  if (kind === 'handle') return normalizeHandle(value)
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function number(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function sourceYieldMap(rows) {
  const byQuery = new Map()
  const bySurface = new Map()
  for (const row of rows) {
    if (row.source_query) byQuery.set(row.source_query, row)
    if (row.source_type) bySurface.set(row.source_type, row)
  }
  return { byQuery, bySurface }
}

function coverageMap(rows) {
  return new Map(rows.map((row) => [row.label, row]))
}

function scoreCandidate(candidate, coverageByLabel, yields) {
  const priorityScore = Math.max(0, 60 - number(candidate.priority, 5) * 8)
  const coverage = coverageByLabel.get(candidate.target_label)
  const gapScore = Math.min(25, number(coverage?.useful_gap) / 200)
  const queryYield = yields.byQuery.get(candidate.target)
  const surfaceYield = yields.bySurface.get(candidate.acquisition_surface)
  const yieldSignal = queryYield ?? surfaceYield
  const yieldScore = Math.min(20, number(yieldSignal?.yield_score) / 5)
  const graphScore = candidate.source_type === 'graph_expansion' ? 12 : 0
  const handleScore = candidate.target_kind === 'handle' ? 10 : 0
  const reviewScore = candidate.source_type === 'review_gap' ? 6 : 0
  return Math.round(priorityScore + gapScore + yieldScore + graphScore + handleScore + reviewScore)
}

function upsertCandidate(map, candidate) {
  const key = `${candidate.target_kind}:${candidate.target_key}`
  const existing = map.get(key)
  if (!existing) {
    map.set(key, {
      ...candidate,
      evidence_count: 1,
      source_batch_ids: candidate.batch_id ? [candidate.batch_id] : [],
      source_reasons: candidate.reason ? [candidate.reason] : [],
    })
    return
  }
  existing.evidence_count += 1
  existing.priority = Math.min(number(existing.priority, 5), number(candidate.priority, 5))
  existing.target_label ||= candidate.target_label
  existing.acquisition_surface ||= candidate.acquisition_surface
  existing.expected_output ||= candidate.expected_output
  existing.import_target ||= candidate.import_target
  existing.source_type = existing.source_type === candidate.source_type ? existing.source_type : 'multi_source'
  if (candidate.batch_id && !existing.source_batch_ids.includes(candidate.batch_id)) existing.source_batch_ids.push(candidate.batch_id)
  if (candidate.reason && !existing.source_reasons.includes(candidate.reason)) existing.source_reasons.push(candidate.reason)
}

function fromAcquisitionTask(task) {
  const target = String(task.query ?? '').trim()
  const kind = targetKind(target)
  return {
    source_type: 'acquisition_task',
    batch_id: task.batch_id,
    target,
    target_key: targetKey(target),
    target_kind: kind,
    priority: number(task.priority, 5),
    acquisition_surface: task.acquisition_surface,
    target_label: task.target_label ?? '',
    expected_output: task.expected_output ?? '',
    import_target: task.import_target ?? '',
    reason: task.notes ?? '',
    yield_score: task.yield_score ?? '',
    usefulness_rate: task.usefulness_rate ?? '',
    rejection_rate: task.rejection_rate ?? '',
  }
}

function fromExpansionTarget(row) {
  const target = String(row.target ?? '').trim()
  return {
    source_type: 'graph_expansion',
    batch_id: '',
    target,
    target_key: targetKey(target),
    target_kind: targetKind(target),
    priority: number(row.priority, 3),
    acquisition_surface: row.expansion_type === 'resolve_mentioned_creator' ? 'tiktok_profile_export' : 'tiktok_creator_neighborhood_export',
    target_label: row.primary_label ?? '',
    expected_output: row.expansion_type === 'resolve_mentioned_creator' ? 'public creator profile and recent videos' : 'mentions, hashtags, collaborators, sounds, and recent videos',
    import_target: 'data/raw/imports/graph-expansion-export.jsonl',
    reason: row.reason ?? row.expansion_type ?? '',
    yield_score: '',
    usefulness_rate: '',
    rejection_rate: '',
  }
}

function main() {
  ensureDir(processedDir)
  ensureDir(reportsDir)

  const acquisitionTasks = readJsonl(join(processedDir, 'acquisition/acquisition_tasks.jsonl'))
  const expansionQueue = readJsonl(join(processedDir, 'expansion_queue.jsonl'))
  const categoryCoverage = readJsonl(join(processedDir, 'category_coverage.jsonl'))
  const sourceYield = readJsonl(join(processedDir, 'source_yield.jsonl'))
  const accounts = readJsonl(join(processedDir, 'creator_accounts.jsonl'))
  const knownHandles = new Set(accounts.map((account) => account.handle).filter(Boolean).map(normalizeHandle))
  const coverageByLabel = coverageMap(categoryCoverage)
  const yields = sourceYieldMap(sourceYield)

  const candidates = new Map()
  for (const task of acquisitionTasks) {
    const candidate = fromAcquisitionTask(task)
    if (candidate.target_key) upsertCandidate(candidates, candidate)
  }
  for (const row of expansionQueue) {
    const candidate = fromExpansionTarget(row)
    if (candidate.target_kind === 'handle' && knownHandles.has(normalizeHandle(candidate.target))) continue
    if (candidate.target_key) upsertCandidate(candidates, candidate)
  }

  const rows = Array.from(candidates.values()).map((candidate) => {
    const frontierScore = scoreCandidate(candidate, coverageByLabel, yields) + Math.min(candidate.evidence_count * 3, 12)
    const knownAccount = candidate.target_kind === 'handle' && knownHandles.has(normalizeHandle(candidate.target))
    return {
      frontier_rank: 0,
      frontier_score: frontierScore,
      target: candidate.target,
      target_kind: candidate.target_kind,
      acquisition_surface: candidate.acquisition_surface,
      priority: candidate.priority,
      target_label: candidate.target_label,
      source_type: candidate.source_type,
      evidence_count: candidate.evidence_count,
      known_account: knownAccount,
      expected_output: candidate.expected_output,
      import_target: candidate.import_target,
      source_batch_ids: candidate.source_batch_ids.join('|'),
      source_reasons: candidate.source_reasons.join('|'),
      yield_score: candidate.yield_score,
      usefulness_rate: candidate.usefulness_rate,
      rejection_rate: candidate.rejection_rate,
    }
  }).sort((a, b) => {
    const knownDelta = Number(a.known_account) - Number(b.known_account)
    if (knownDelta !== 0) return knownDelta
    return b.frontier_score - a.frontier_score || number(a.priority, 5) - number(b.priority, 5) || a.target.localeCompare(b.target)
  }).map((row, index) => ({ ...row, frontier_rank: index + 1 }))

  writeJsonl(join(processedDir, 'candidate_frontier.jsonl'), rows)
  writeCsv(join(processedDir, 'candidate_frontier.csv'), rows)

  const topRows = rows.slice(0, 50)
  const summary = {
    generated_at: new Date().toISOString(),
    candidates: rows.length,
    handle_targets: rows.filter((row) => row.target_kind === 'handle').length,
    query_targets: rows.filter((row) => ['query', 'search_query', 'hashtag'].includes(row.target_kind)).length,
    known_account_targets: rows.filter((row) => row.known_account).length,
    top_priority_candidates: topRows.length,
    surface_counts: rows.reduce((acc, row) => {
      acc[row.acquisition_surface || 'unknown'] = (acc[row.acquisition_surface || 'unknown'] ?? 0) + 1
      return acc
    }, {}),
    target_label_counts: rows.reduce((acc, row) => {
      acc[row.target_label || 'unclassified'] = (acc[row.target_label || 'unclassified'] ?? 0) + 1
      return acc
    }, {}),
    top_candidates: topRows,
  }

  writeJson(join(reportsDir, 'candidate-frontier.json'), summary)
  writeFileSync(join(reportsDir, 'candidate-frontier.md'), `# Candidate Frontier

Generated: ${summary.generated_at}

- Candidates: ${summary.candidates}
- Handle targets: ${summary.handle_targets}
- Query targets: ${summary.query_targets}
- Known account targets: ${summary.known_account_targets}

## Surfaces

${Object.entries(summary.surface_counts).map(([surface, count]) => `- ${surface}: ${count}`).join('\n')}

## Target Labels

${Object.entries(summary.target_label_counts).map(([label, count]) => `- ${label}: ${count}`).join('\n')}

## Top Candidates

| Rank | Score | Priority | Kind | Surface | Label | Target |
| ---: | ---: | ---: | --- | --- | --- | --- |
${topRows.slice(0, 25).map((row) => `| ${row.frontier_rank} | ${row.frontier_score} | ${row.priority} | ${row.target_kind} | ${row.acquisition_surface} | ${row.target_label || 'unclassified'} | ${row.target.replaceAll('|', '\\|')} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
