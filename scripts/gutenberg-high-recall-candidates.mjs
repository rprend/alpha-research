import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  candidateId,
  chunkText,
  ensureDir,
  highRecallDir,
  inventoryPath,
  readJsonl,
  seededHints,
  stableRunId,
  taskPath,
  taskSignals,
  tokenize,
  writeJson,
  writeJsonl,
} from './gutenberg-pipeline-lib.mjs'

const runId = process.argv.find((arg) => arg.startsWith('--run-id='))?.split('=')[1] ?? stableRunId('high-recall')
const maxWorks = Number(process.argv.find((arg) => arg.startsWith('--max-works='))?.split('=')[1] ?? 5000)
const perTask = Number(process.argv.find((arg) => arg.startsWith('--per-task='))?.split('=')[1] ?? 2000)
const topKPerProfile = Number(process.argv.find((arg) => arg.startsWith('--top-k='))?.split('=')[1] ?? 450)
const smoke = process.argv.includes('--smoke')
const runDir = join(highRecallDir, runId)

ensureDir(runDir)

const tasks = readJsonl(taskPath)
const inventory = readJsonl(inventoryPath).filter((work) => work.status === 'ready').slice(0, maxWorks)
const inventoryArtifact = 'source-inventory.jsonl'

if (!tasks.length) throw new Error(`No tasks found at ${taskPath}`)
if (!inventory.length) throw new Error(`No Gutenberg inventory found at ${inventoryPath}. Run benchmark:gutenberg:acquire first.`)

function buildQueryVariants(task) {
  const baseTokens = tokenize(`${task.query} ${task.rubric?.strong_match ?? ''}`).slice(0, 18)
  const signals = taskSignals(task)
  const hints = seededHints[task.id] ?? { authors: [], titles: [], terms: [] }
  const variants = [
    {
      id: `${task.id}:direct`,
      method: 'bm25',
      text: task.query,
      terms: baseTokens,
      weight: 1,
    },
    {
      id: `${task.id}:rubric`,
      method: 'rubric',
      text: task.rubric?.strong_match ?? task.query,
      terms: tokenize(`${task.rubric?.strong_match ?? ''} ${task.rubric?.near_miss ?? ''}`).slice(0, 24),
      weight: 1.1,
    },
    ...signals.map((signal) => ({
      id: `${task.id}:signal:${signal.name}`,
      method: 'semantic_signal',
      text: signal.words.join(' '),
      terms: signal.words,
      weight: 1.25,
    })),
    ...hints.terms.map((term, index) => ({
      id: `${task.id}:seed-term:${index}`,
      method: 'seeded_query',
      text: term,
      terms: tokenize(term),
      weight: 1.35,
    })),
    {
      id: `${task.id}:near-miss`,
      method: 'near_miss_probe',
      text: task.rubric?.near_miss ?? task.query,
      terms: tokenize(task.rubric?.near_miss ?? task.query).slice(0, 18),
      weight: 0.75,
    },
  ]
  return variants.filter((variant) => variant.terms.length)
}

function scoreChunk(chunkTokens, chunkTokenSet, variant, work, task) {
  let hits = 0
  let score = 0
  for (const term of variant.terms) {
    if (chunkTokenSet.has(term)) {
      hits += 1
      score += term.length > 6 ? 1.4 : 1
    }
  }
  const hints = seededHints[task.id] ?? { authors: [], titles: [] }
  const authorTitle = `${work.author ?? ''} ${work.title ?? ''}`.toLowerCase()
  const metadataBoost =
    hints.authors.some((author) => authorTitle.includes(author)) || hints.titles.some((title) => authorTitle.includes(title))
      ? 3.5
      : 0
  const density = hits / Math.max(1, Math.sqrt(chunkTokens.length))
  return score * variant.weight + density * 8 + metadataBoost
}

function pushTop(bucket, candidate, limit) {
  if (candidate.score <= 0) return
  bucket.push(candidate)
  bucket.sort((a, b) => b.score - a.score)
  if (bucket.length > limit) bucket.length = limit
}

const byTaskProfile = new Map()
for (const task of tasks) {
  for (const variant of buildQueryVariants(task)) {
    byTaskProfile.set(variant.id, { task, variant, rows: [] })
  }
}

let worksRead = 0
let chunksScored = 0
for (const work of inventory) {
  if (!work.cleaned_path) continue
  const text = readFileSync(work.cleaned_path, 'utf8')
  const chunks = chunkText(text, smoke ? 360 : 520, smoke ? 80 : 120)
  worksRead += 1
  for (let index = 0; index < chunks.length; index += 1) {
    const quote = chunks[index]
    const tokens = tokenize(quote)
    const tokenSet = new Set(tokens)
    chunksScored += 1
    const passageId = `${work.work_id}:chunk-${String(index).padStart(5, '0')}`
    for (const profile of byTaskProfile.values()) {
      const score = scoreChunk(tokens, tokenSet, profile.variant, work, profile.task)
      pushTop(
        profile.rows,
        {
          task_id: profile.task.id,
          candidate_id: candidateId(profile.task.id, passageId),
          passage_id: passageId,
          work_id: work.work_id,
          gutenberg_id: work.gutenberg_id,
          title: work.title,
          author: work.author,
          issued: work.issued,
          source_url: work.source_url,
          quote,
          score: Number(score.toFixed(4)),
          method: profile.variant.method,
          query_variant_id: profile.variant.id,
          query_variant_text: profile.variant.text,
        },
        topKPerProfile,
      )
    }
  }
}

const merged = new Map()
for (const profile of byTaskProfile.values()) {
  for (const row of profile.rows) {
    const existing = merged.get(row.candidate_id)
    if (!existing) {
      merged.set(row.candidate_id, { ...row, methods: [row.method], query_variant_ids: [row.query_variant_id], scores: [row.score] })
    } else {
      existing.score = Math.max(existing.score, row.score)
      existing.methods = [...new Set([...existing.methods, row.method])]
      existing.query_variant_ids = [...new Set([...existing.query_variant_ids, row.query_variant_id])]
      existing.scores.push(row.score)
    }
  }
}

const deduped = [...merged.values()]
  .map((row) => ({ ...row, discovery_path: row.methods.join('+'), max_score: Math.max(...row.scores), method_count: row.methods.length }))
  .sort((a, b) => b.method_count - a.method_count || b.max_score - a.max_score)

const diversified = []
const taskCounts = new Map()
const taskWorkCounts = new Map()
for (const row of deduped) {
  const taskCount = taskCounts.get(row.task_id) ?? 0
  const taskWorkKey = `${row.task_id}:${row.work_id}`
  const taskWorkCount = taskWorkCounts.get(taskWorkKey) ?? 0
  if (taskCount >= perTask || taskWorkCount >= Math.max(8, Math.floor(perTask / 100))) continue
  diversified.push(row)
  taskCounts.set(row.task_id, taskCount + 1)
  taskWorkCounts.set(taskWorkKey, taskWorkCount + 1)
}

writeJsonl(join(runDir, 'candidate_pool.jsonl'), diversified)
writeJson(join(runDir, 'candidate_pool_summary.json'), {
  run_id: runId,
  created_at: new Date().toISOString(),
  corpus_source: 'Project Gutenberg',
  inventory_artifact: inventoryArtifact,
  works_read: worksRead,
  chunks_scored: chunksScored,
  tasks: tasks.length,
  candidates: diversified.length,
  per_task: Object.fromEntries(tasks.map((task) => [task.id, taskCounts.get(task.id) ?? 0])),
  artifacts: {
    candidate_pool: join(runDir, 'candidate_pool.jsonl'),
  },
})

console.log(`Wrote ${diversified.length} high-recall candidates to ${join(runDir, 'candidate_pool.jsonl')}`)
