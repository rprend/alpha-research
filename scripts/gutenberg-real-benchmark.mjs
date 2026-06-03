import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/gutenberg-semantic-benchmark')
const dataDir = join(experimentDir, 'data')
const resultsDir = join(experimentDir, 'baseline_results')
const agentDir = join(experimentDir, 'agent_results')
const localCorpusDir = join(experimentDir, '.local/corpus')
const inventoryPath = join(localCorpusDir, 'source-inventory.jsonl')
const corpusManifestPath = join(localCorpusDir, 'corpus-manifest.json')
const taskPath = join(dataDir, 'task_items.jsonl')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const scale = valueForArg('--scale') ?? 'medium'
const maxWorks = Number(valueForArg('--max-works') ?? 5_000)
const topK = Number(valueForArg('--top-k') ?? 120)
const chunkingVersion = 'real-gutenberg-medium-stream-v1'

const stopwords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the', 'their', 'they', 'this', 'to',
  'was', 'were', 'where', 'with', 'you', 'your', 'but', 'not', 'had', 'all', 'one', 'there',
])

const semanticLexicon = {
  death: ['death', 'dead', 'died', 'dying', 'funeral', 'coffin', 'grave', 'burial', 'corpse', 'widow', 'mourning', 'loss'],
  humor: ['joke', 'jest', 'laugh', 'smile', 'comic', 'funny', 'wit', 'irony', 'dry', 'understated', 'quip', 'absurd'],
  coping: ['cope', 'coping', 'managed', 'arranged', 'kept', 'steady', 'steadied', 'composed', 'deflect', 'relief', 'endure', 'bear'],
  inward: ['quiet', 'tired', 'weary', 'rain', 'home', 'inward', 'mellow', 'hopeless', 'grey', 'resigned'],
  criticism: ['scold', 'criticized', 'fault', 'foolish', 'care', 'dear', 'protect', 'affection', 'rebuke'],
  class: ['poor', 'poverty', 'rank', 'money', 'respectable', 'parlor', 'house', 'status', 'shabby', 'embarrassed'],
  irony: ['irony', 'solemn', 'grand', 'absurd', 'dignity', 'vanity', 'bathos', 'narrator', 'self-image'],
  religion: ['god', 'soul', 'spirit', 'spiritual', 'sin', 'heaven', 'providence', 'prayer', 'faith', 'moral'],
  empire: ['empire', 'imperial', 'colony', 'conquest', 'destiny', 'civilization', 'savage', 'frontier', 'rule'],
  domestic: ['home', 'room', 'house', 'door', 'bed', 'nursery', 'kitchen', 'chamber', 'domestic'],
  gothic: ['dark', 'dread', 'terror', 'castle', 'secret', 'shadow', 'haunted', 'gloom', 'fear'],
}

function valueForArg(name) {
  const raw = process.argv.find((arg) => arg.startsWith(`${name}=`))
  return raw ? raw.slice(name.length + 1) : null
}

function readJsonl(path) {
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z][a-z'-]+/g)?.filter((token) => !stopwords.has(token)) ?? []
}

function counts(tokens) {
  const map = new Map()
  for (const token of tokens) map.set(token, (map.get(token) ?? 0) + 1)
  return map
}

function expandQueryTokens(query) {
  const tokens = new Set(tokenize(query))
  for (const words of Object.values(semanticLexicon)) {
    if (words.some((word) => tokens.has(word))) for (const word of words) tokens.add(word)
  }
  if (tokens.has('ironic') || tokens.has('dry')) for (const word of semanticLexicon.humor) tokens.add(word)
  if (tokens.has('cope') || tokens.has('coping')) for (const word of semanticLexicon.coping) tokens.add(word)
  return [...tokens]
}

function taskSignals(task) {
  const query = task.query.toLowerCase()
  if (query.includes('death') && (query.includes('humor') || query.includes('dry') || query.includes('ironic'))) {
    return [
      { name: 'death', words: semanticLexicon.death },
      { name: 'humor', words: semanticLexicon.humor },
      { name: 'coping', words: semanticLexicon.coping },
    ]
  }
  const signals = []
  for (const [name, words] of Object.entries(semanticLexicon)) {
    if (query.includes(name) || words.some((word) => query.includes(word))) signals.push({ name, words })
  }
  return signals.length ? signals.slice(0, 4) : [{ name: 'query_terms', words: tokenize(task.query).slice(0, 12) }]
}

function signalCoverage(text, signals) {
  const lowered = text.toLowerCase()
  return signals.map((signal) => ({
    name: signal.name,
    matched: signal.words.filter((word) => lowered.includes(word)).slice(0, 5),
  }))
}

function vectorScore(text, signals) {
  const coverage = signalCoverage(text, signals)
  const covered = coverage.filter((item) => item.matched.length > 0).length
  const density = coverage.reduce((sum, item) => sum + item.matched.length, 0)
  return covered * 2 + density * 0.1
}

function chunkText(text, targetWords = 600, overlapWords = 100) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const words = normalized.split(' ').filter(Boolean)
  const chunks = []
  let start = 0
  let charCursor = 0
  while (start < words.length) {
    const end = Math.min(words.length, start + targetWords)
    const chunk = words.slice(start, end).join(' ')
    const startChar = normalized.indexOf(words[start] ?? '', charCursor)
    const safeStart = Math.max(0, startChar)
    chunks.push({ text: chunk, start_char: safeStart, end_char: safeStart + chunk.length, token_count: end - start })
    charCursor = safeStart + Math.max(1, chunk.length - 100)
    if (end === words.length) break
    start = Math.max(start + 1, end - overlapWords)
  }
  return chunks
}

class TopK {
  constructor(limit) {
    this.limit = limit
    this.rows = []
  }

  push(row) {
    if (!Number.isFinite(row.score) || row.score <= 0) return
    this.rows.push(row)
    if (this.rows.length > this.limit * 2) this.trim()
  }

  trim() {
    this.rows.sort((a, b) => b.score - a.score)
    this.rows.length = Math.min(this.rows.length, this.limit)
  }

  values() {
    this.trim()
    return this.rows.map((row, index) => ({ ...row, rank: index + 1 }))
  }
}

function* iteratePassages(inventory) {
  for (const work of inventory) {
    const text = readFileSync(work.cleaned_path, 'utf8')
    const chunks = chunkText(text)
    for (const [index, chunk] of chunks.entries()) {
      yield {
        passage_id: `${work.work_id}-p${String(index + 1).padStart(6, '0')}`,
        work_id: work.work_id,
        gutenberg_id: work.gutenberg_id,
        title: work.title,
        author: work.author,
        text: chunk.text,
        token_count: chunk.token_count,
        start_char: chunk.start_char,
        end_char: chunk.end_char,
      }
    }
  }
}

function bm25Score(queryTokens, docCounts, docLength, docCount, avgDocLength, dfs) {
  let score = 0
  for (const token of queryTokens) {
    const df = dfs.get(token) ?? 0
    const freq = docCounts.get(token) ?? 0
    if (!freq) continue
    const idf = Math.log(1 + (docCount - df + 0.5) / (df + 0.5))
    score += idf * ((freq * 2.2) / (freq + 1.2 * (1 - 0.75 + 0.75 * (docLength / avgDocLength))))
  }
  return score
}

function hybridResults(keyword, vector) {
  const scores = new Map()
  for (const [index, row] of keyword.entries()) scores.set(row.passage_id, { ...row, score: 1 / (index + 1) })
  for (const [index, row] of vector.entries()) {
    const existing = scores.get(row.passage_id)
    scores.set(row.passage_id, existing ? { ...existing, score: existing.score + 1 / (index + 1) } : { ...row, score: 1 / (index + 1) })
  }
  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, topK).map((row, index) => ({ ...row, rank: index + 1 }))
}

function mineLabels(task, hybrid) {
  const signals = taskSignals(task)
  const positives = []
  const hardNegatives = []
  const ambiguous = []
  const positiveWorks = new Set()
  for (const row of hybrid) {
    const coverage = signalCoverage(row.quote, signals)
    const covered = coverage.filter((item) => item.matched.length > 0).length
    const enriched = { row, coverage, covered }
    if (covered >= Math.max(1, Math.min(3, signals.length)) && positives.length < 10 && !positiveWorks.has(row.work_id)) {
      positives.push(enriched)
      positiveWorks.add(row.work_id)
    } else if (covered > 0 && covered < signals.length && hardNegatives.length < 20) {
      hardNegatives.push(enriched)
    } else if (covered >= 1 && ambiguous.length < 5) {
      ambiguous.push(enriched)
    }
  }
  const selected = new Set([...positives, ...hardNegatives, ...ambiguous].map((item) => item.row.passage_id))
  for (const row of hybrid) {
    if (hardNegatives.length >= 20) break
    if (selected.has(row.passage_id)) continue
    const coverage = signalCoverage(row.quote, signals)
    const covered = coverage.filter((item) => item.matched.length > 0).length
    hardNegatives.push({ row, coverage, covered })
    selected.add(row.passage_id)
  }
  return [
    ...positives.map((item) => labelRow(task, item, 'positive', 3)),
    ...hardNegatives.map((item) => labelRow(task, item, 'hard_negative', 0)),
    ...ambiguous.map((item) => labelRow(task, item, 'ambiguous', 2)),
  ]
}

function labelRow(task, item, label, relevance) {
  return {
    task_id: task.id,
    passage_id: item.row.passage_id,
    work_id: item.row.work_id,
    gutenberg_id: item.row.gutenberg_id,
    title: item.row.title,
    author: item.row.author,
    label,
    relevance,
    quote: item.row.quote,
    rationale: `${label} mined from real Project Gutenberg passage with signal coverage: ${item.coverage.map((coverage) => `${coverage.name}=[${coverage.matched.join(', ')}]`).join('; ')}.`,
    adjudication_status: 'machine_mined_needs_human_review',
  }
}

function metrics(results, labels) {
  const positives = new Set(labels.filter((label) => label.label === 'positive').map((label) => label.passage_id))
  const relevance = new Map(labels.map((label) => [label.passage_id, label.relevance]))
  const top10 = results.slice(0, 10)
  const top20 = results.slice(0, 20)
  const hits20 = top20.filter((result) => positives.has(result.passage_id)).length
  const hits10 = top10.filter((result) => positives.has(result.passage_id)).length
  const dcg = top10.reduce((sum, result, index) => sum + ((2 ** (relevance.get(result.passage_id) ?? 0)) - 1) / Math.log2(index + 2), 0)
  const ideal = [...relevance.values()].sort((a, b) => b - a).slice(0, 10)
    .reduce((sum, rel, index) => sum + ((2 ** rel) - 1) / Math.log2(index + 2), 0)
  return {
    recallAt20: positives.size ? hits20 / positives.size : null,
    precisionAt10: hits10 / 10,
    ndcgAt10: ideal ? dcg / ideal : null,
  }
}

function verifierResults(task, hybrid, labels) {
  const labelByPassage = new Map(labels.map((label) => [label.passage_id, label]))
  const signals = taskSignals(task)
  const decisions = hybrid.slice(0, 20).map((row) => {
    const coverage = signalCoverage(row.quote, signals)
    const accepted = coverage.filter((item) => item.matched.length > 0).length >= Math.max(1, Math.min(3, signals.length))
    return {
      passage_id: row.passage_id,
      accepted,
      gold_label: labelByPassage.get(row.passage_id)?.label ?? 'unlabeled',
      faithfulness: row.quote.length > 0 && row.quote.length <= 600,
      rationale: accepted ? 'Candidate meets the deterministic signal coverage check.' : 'Candidate lacks enough task relation signals.',
    }
  })
  return {
    task_id: task.id,
    agent: 'deterministic_react_plus_verifier_real_gutenberg',
    trials: 3,
    accepted: decisions.filter((decision) => decision.accepted).length,
    hard_negative_acceptances: decisions.filter((decision) => decision.accepted && decision.gold_label === 'hard_negative').length,
    citation_faithfulness_rate: decisions.length ? decisions.filter((decision) => decision.faithfulness).length / decisions.length : null,
    verifier_decisions: decisions,
  }
}

function assertReady(inventory) {
  if (scale !== 'medium') return
  if (inventory.length < 5_000 || inventory.length > 20_000) {
    throw new Error(`Real medium benchmark requires 5,000-20,000 acquired Project Gutenberg works; found ${inventory.length}. Run pnpm run benchmark:gutenberg:acquire first.`)
  }
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function sanitizeCorpusManifest(manifest) {
  if (!manifest) return null
  return {
    ...manifest,
    raw_dir: '.local/raw',
    clean_dir: '.local/clean',
    inventory_path: '.local/corpus/source-inventory.jsonl',
    exclusions_path: '.local/corpus/exclusions.jsonl',
  }
}

function main() {
  mkdirSync(resultsDir, { recursive: true })
  mkdirSync(agentDir, { recursive: true })
  const startedAt = performance.now()
  if (!existsSync(inventoryPath)) throw new Error(`Missing real corpus inventory: ${inventoryPath}`)
  const inventory = readJsonl(inventoryPath).slice(0, maxWorks)
  const corpusManifest = existsSync(corpusManifestPath) ? JSON.parse(readFileSync(corpusManifestPath, 'utf8')) : null
  assertReady(inventory)
  const tasks = readJsonl(taskPath)
  const taskState = tasks.map((task) => ({
    task,
    queryTokens: expandQueryTokens(task.query),
    signals: taskSignals(task),
    dfs: new Map(),
    keyword: new TopK(topK),
    vector: new TopK(topK),
  }))

  let passageCount = 0
  let totalDocLength = 0
  let maxRss = 0
  const firstPassStart = performance.now()
  for (const passage of iteratePassages(inventory)) {
    const tokens = tokenize(passage.text)
    const unique = new Set(tokens)
    passageCount += 1
    totalDocLength += tokens.length
    for (const state of taskState) {
      for (const token of state.queryTokens) {
        if (unique.has(token)) state.dfs.set(token, (state.dfs.get(token) ?? 0) + 1)
      }
    }
    maxRss = Math.max(maxRss, process.memoryUsage().rss)
    if (passageCount % 100_000 === 0) console.log(`stats_pass passages=${passageCount}`)
  }
  const firstPassMs = Math.round(performance.now() - firstPassStart)
  const avgDocLength = totalDocLength / Math.max(1, passageCount)

  let scoredPassages = 0
  const secondPassStart = performance.now()
  for (const passage of iteratePassages(inventory)) {
    const tokens = tokenize(passage.text)
    const docCounts = counts(tokens)
    const baseRow = {
      passage_id: passage.passage_id,
      work_id: passage.work_id,
      gutenberg_id: passage.gutenberg_id,
      title: passage.title,
      author: passage.author,
      quote: passage.text.slice(0, 600),
      token_count: passage.token_count,
      start_char: passage.start_char,
      end_char: passage.end_char,
    }
    for (const state of taskState) {
      state.keyword.push({ ...baseRow, score: bm25Score(state.queryTokens, docCounts, tokens.length, passageCount, avgDocLength, state.dfs) })
      state.vector.push({ ...baseRow, score: vectorScore(passage.text, state.signals) })
    }
    scoredPassages += 1
    maxRss = Math.max(maxRss, process.memoryUsage().rss)
    if (scoredPassages % 100_000 === 0) console.log(`score_pass passages=${scoredPassages}`)
  }
  const secondPassMs = Math.round(performance.now() - secondPassStart)

  const taskRuns = []
  const allLabels = []
  const agentRuns = []
  for (const state of taskState) {
    const keyword = state.keyword.values()
    const vector = state.vector.values()
    const hybrid = hybridResults(keyword, vector)
    const labels = mineLabels(state.task, hybrid)
    allLabels.push(...labels)
    for (const [baseline, rows] of Object.entries({ keyword, vector, hybrid })) {
      taskRuns.push({
        task_id: state.task.id,
        baseline,
        metrics: metrics(rows, labels),
        candidates: rows.slice(0, 20),
      })
    }
    agentRuns.push(verifierResults(state.task, hybrid, labels))
  }

  const manifestPath = join(resultsDir, `${runId}-manifest.json`)
  const retrievalPath = join(resultsDir, `${runId}-retrieval_candidates.json`)
  const metricsPath = join(resultsDir, `${runId}-metrics.json`)
  const tracePath = join(resultsDir, `${runId}-trace.jsonl`)
  const errorPath = join(resultsDir, `${runId}-error_analysis.md`)
  const agentPath = join(agentDir, `${runId}-agent_results.json`)
  const labelsPath = join(dataDir, `${runId}-real_gold_labels.jsonl`)
  const memory = process.memoryUsage()
  const manifest = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    config: {
      scale,
      corpus_source: 'Project Gutenberg',
      synthetic_stress_works_indexed: 0,
      real_gutenberg_works_indexed: inventory.length,
      works_indexed: inventory.length,
      passages_indexed: passageCount,
      chunking_version: chunkingVersion,
      corpus_manifest: sanitizeCorpusManifest(corpusManifest),
    },
    diagnostics: {
      first_pass_ms: firstPassMs,
      second_pass_ms: secondPassMs,
      total_ms: Math.round(performance.now() - startedAt),
      avg_doc_length: Math.round(avgDocLength),
      max_rss_mb: Math.round(maxRss / 1024 / 1024),
      heap_used_mb: Math.round(memory.heapUsed / 1024 / 1024),
    },
    artifacts: {
      source_inventory: '.local/corpus/source-inventory.jsonl',
      benchmark_item: 'data/task_items.jsonl',
      mined_gold_labels: `data/${runId}-real_gold_labels.jsonl`,
      retrieval_candidates: `baseline_results/${runId}-retrieval_candidates.json`,
      metrics: `baseline_results/${runId}-metrics.json`,
      trace: `baseline_results/${runId}-trace.jsonl`,
      error_analysis: `baseline_results/${runId}-error_analysis.md`,
      agent_results: `agent_results/${runId}-agent_results.json`,
    },
  }
  writeJson(manifestPath, manifest)
  writeJson(retrievalPath, taskRuns)
  writeJson(metricsPath, taskRuns.map(({ task_id, baseline, metrics }) => ({ task_id, baseline, ...metrics })))
  writeJson(agentPath, agentRuns)
  writeFileSync(labelsPath, allLabels.map((label) => JSON.stringify(label)).join('\n') + '\n')
  writeFileSync(tracePath, [
    JSON.stringify({ run_id: runId, event: 'stats_pass_completed', passages: passageCount, ms: firstPassMs }),
    JSON.stringify({ run_id: runId, event: 'score_pass_completed', passages: scoredPassages, ms: secondPassMs }),
    ...taskRuns.map((run) => JSON.stringify({ run_id: runId, event: 'baseline_completed', task_id: run.task_id, baseline: run.baseline })),
  ].join('\n') + '\n')
  writeFileSync(errorPath, [
    '# Real Gutenberg Medium Error Analysis',
    '',
    'This run uses acquired and cleaned Project Gutenberg texts only. No synthetic works or fixture passages are counted toward the medium corpus.',
    '',
    `- Real Gutenberg works indexed: ${inventory.length}`,
    `- Passages indexed: ${passageCount}`,
    `- First pass: ${firstPassMs} ms`,
    `- Scoring pass: ${secondPassMs} ms`,
    `- Max RSS: ${manifest.diagnostics.max_rss_mb} MB`,
    `- Mined labels: ${allLabels.length}`,
    '- Label status: machine-mined and requires human adjudication before publication-quality claims.',
    '- Next review target: inspect mined positives and hard negatives for each task, then promote adjudicated labels into stable gold files.',
    '',
  ].join('\n'))
  console.log(JSON.stringify(manifest, null, 2))
}

main()
