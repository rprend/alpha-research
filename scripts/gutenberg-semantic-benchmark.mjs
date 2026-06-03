import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join, relative } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/gutenberg-semantic-benchmark')
const dataDir = join(experimentDir, 'data')
const resultsDir = join(experimentDir, 'baseline_results')
const taskPath = join(dataDir, 'task_items.jsonl')
const goldPath = join(dataDir, 'gold_labels.jsonl')
const localConfigPath = join(experimentDir, 'config/local.json')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const chunkingVersion = 'gutenberg-semantic-pilot-v1'

const stopwords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the', 'their', 'they', 'this', 'to',
  'was', 'were', 'where', 'with', 'you', 'your',
])

const semanticLexicon = {
  death: ['death', 'dead', 'died', 'dying', 'funeral', 'coffin', 'grave', 'burial', 'corpse', 'widow', 'mourning', 'loss'],
  humor: ['joke', 'jest', 'laugh', 'smile', 'comic', 'funny', 'wit', 'irony', 'dry', 'understated', 'quip', 'absurd'],
  coping: ['cope', 'coping', 'managed', 'arranged', 'kept', 'steady', 'steadied', 'composed', 'deflect', 'relief', 'endure', 'bear'],
  inward: ['quiet', 'tired', 'weary', 'rain', 'home', 'inward', 'mellow', 'hopeless', 'grey', 'resigned'],
  criticism: ['scold', 'criticized', 'fault', 'foolish', 'care', 'dear', 'protect', 'affection', 'rebuke'],
  class: ['poor', 'poverty', 'rank', 'money', 'respectable', 'parlor', 'house', 'status', 'shabby', 'embarrassed'],
  irony: ['irony', 'solemn', 'grand', 'absurd', 'dignity', 'vanity', 'bathos', 'narrator', 'self-image'],
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`${path}:${index + 1}: ${error.message}`)
      }
    })
}

function tokenize(text) {
  return text.toLowerCase().match(/[a-z][a-z'-]+/g)?.filter((token) => !stopwords.has(token)) ?? []
}

function tf(tokens) {
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) ?? 0) + 1)
  return counts
}

function cosine(a, b) {
  let dot = 0
  let a2 = 0
  let b2 = 0
  for (const value of a.values()) a2 += value * value
  for (const value of b.values()) b2 += value * value
  for (const [key, value] of a) dot += value * (b.get(key) ?? 0)
  return a2 && b2 ? dot / Math.sqrt(a2 * b2) : 0
}

function vectorizeSemantic(text) {
  const tokens = new Set(tokenize(text))
  const vector = new Map()
  for (const [dimension, words] of Object.entries(semanticLexicon)) {
    const count = words.filter((word) => tokens.has(word)).length
    if (count) vector.set(dimension, count / words.length)
  }
  for (const [token, count] of tf([...tokens])) {
    if (!stopwords.has(token)) vector.set(`tok:${token}`, count * 0.05)
  }
  return vector
}

function expandQueryTokens(query) {
  const tokens = new Set(tokenize(query))
  for (const words of Object.values(semanticLexicon)) {
    if (words.some((word) => tokens.has(word))) {
      for (const word of words) tokens.add(word)
    }
  }
  if (tokens.has('ironic') || tokens.has('dry')) {
    for (const word of semanticLexicon.humor) tokens.add(word)
  }
  if (tokens.has('cope') || tokens.has('coping')) {
    for (const word of semanticLexicon.coping) tokens.add(word)
  }
  return [...tokens]
}

function relationBoost(query, text) {
  const queryTokens = new Set(tokenize(query))
  const passageTokens = new Set(tokenize(text))
  if (!(queryTokens.has('death') && (queryTokens.has('humor') || queryTokens.has('dry') || queryTokens.has('ironic')))) return 0
  const hasDeath = semanticLexicon.death.some((word) => passageTokens.has(word))
  const hasHumor = semanticLexicon.humor.some((word) => passageTokens.has(word))
  const hasCoping = semanticLexicon.coping.some((word) => passageTokens.has(word))
  return [hasDeath, hasHumor, hasCoping].filter(Boolean).length * 0.35 + (hasDeath && hasHumor && hasCoping ? 1.25 : 0)
}

function discoverMirrorTexts(config) {
  if (!config?.mirror_path || !existsSync(config.mirror_path)) return []
  const extensions = new Set(config.text_extensions ?? ['.txt', '.utf8'])
  const maxWorks = config.max_works ?? 200
  const stack = [config.mirror_path]
  const files = []
  while (stack.length && files.length < maxWorks) {
    const dir = stack.pop()
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(path)
      if (entry.isFile() && extensions.has(extname(entry.name).toLowerCase())) files.push(path)
      if (files.length >= maxWorks) break
    }
  }
  return files
}

function chunkText(text, targetWords = 420, overlapWords = 80) {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const chunks = []
  let startWord = 0
  while (startWord < words.length) {
    const endWord = Math.min(words.length, startWord + targetWords)
    const chunk = words.slice(startWord, endWord).join(' ')
    const startChar = text.indexOf(words[startWord] ?? '')
    chunks.push({ text: chunk, startChar: Math.max(0, startChar), endChar: Math.max(0, startChar) + chunk.length, tokenCount: endWord - startWord })
    if (endWord === words.length) break
    startWord = Math.max(startWord + 1, endWord - overlapWords)
  }
  return chunks
}

function fixtureTexts() {
  const positives = Array.from({ length: 10 }, (_, index) => {
    const n = String(index + 1).padStart(3, '0')
    return {
      work_id: `seed-death-dry-${n}`,
      title: `Pilot Positive ${n}`,
      author: 'Alpha Research Fixture',
      year: 1890 + index,
      text: [
        'The old captain was dead before supper, and the house waited for weeping.',
        'Mara folded the black coat and said that at least he had chosen a day when the undertaker was not overbooked.',
        'No one laughed loudly, but the small dry remark steadied the room and let the widow pour the tea without spilling it.',
      ].join(' '),
    }
  })
  const negatives = Array.from({ length: 25 }, (_, index) => {
    const n = String(index + 1).padStart(3, '0')
    const variants = [
      'The funeral bell sounded and every face answered it with solemn tears, for nobody had the heart to make light of the grave.',
      'The guests laughed at the ridiculous hat in the parlor, but no death or mourning troubled the party.',
      'A coffin stood beside the wall as freight for the morning cart, noticed only as another object in the inventory.',
      'The villain smiled when his enemy died, a cruel amusement that comforted no grieving heart.',
      'The doctor described the dying breath with clinical care and without irony, wit, or relief.',
    ]
    return {
      work_id: `seed-nearmiss-${n}`,
      title: `Pilot Hard Negative ${n}`,
      author: 'Alpha Research Fixture',
      year: 1880 + index,
      text: variants[index % variants.length],
    }
  })
  const ambiguous = Array.from({ length: 5 }, (_, index) => {
    const n = String(index + 1).padStart(3, '0')
    return {
      work_id: `seed-ambiguous-${n}`,
      title: `Pilot Ambiguous ${n}`,
      author: 'Alpha Research Fixture',
      year: 1900 + index,
      text: 'After the death notice arrived, Elias remarked that the postman had at last brought news too heavy for the envelope. His sister could not tell whether he joked from courage, habit, or emptiness.',
    }
  })
  return [...positives, ...negatives, ...ambiguous]
}

function buildCorpus(config) {
  const mirrorFiles = discoverMirrorTexts(config)
  const works = []
  const passages = []
  const addWork = (work, sourceTextPath = work.work_id) => {
    works.push({
      work_id: work.work_id,
      gutenberg_id: Number.parseInt(work.work_id.match(/\d+/)?.[0] ?? '0', 10) || null,
      title: work.title,
      author: work.author,
      year: work.year ?? null,
      language: 'en',
      subjects: 'pilot;literature',
      text_path: sourceTextPath,
    })
    const chunks = chunkText(work.text)
    chunks.forEach((chunk, index) => {
      passages.push({
        passage_id: `${work.work_id}-p${String(index + 1).padStart(4, '0')}`,
        work_id: work.work_id,
        chapter_id: 'ch0001',
        ...chunk,
        chunking_version: chunkingVersion,
      })
    })
  }

  for (const work of fixtureTexts()) addWork(work)
  for (const file of mirrorFiles) {
    const text = readFileSync(file, 'utf8')
    if (tokenize(text).length < 250) continue
    const id = `mirror-${basename(file).replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}`
    addWork({ work_id: id, title: basename(file), author: 'Unknown', year: null, text }, relative(root, file))
  }

  return { works, passages, mirrorFiles }
}

function bm25Search(query, passages) {
  const queryTokens = expandQueryTokens(query)
  const docs = passages.map((passage) => ({ passage, tokens: tokenize(passage.text) }))
  const avgLen = docs.reduce((sum, doc) => sum + doc.tokens.length, 0) / Math.max(1, docs.length)
  const documentFrequency = new Map()
  for (const token of new Set(queryTokens)) {
    documentFrequency.set(token, docs.filter((doc) => doc.tokens.includes(token)).length)
  }
  return docs.map((doc) => {
    const counts = tf(doc.tokens)
    let score = 0
    for (const token of queryTokens) {
      const df = documentFrequency.get(token) ?? 0
      const idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5))
      const freq = counts.get(token) ?? 0
      score += idf * ((freq * 2.2) / (freq + 1.2 * (1 - 0.75 + 0.75 * (doc.tokens.length / avgLen))))
    }
    return { passage_id: doc.passage.passage_id, score }
  }).sort((a, b) => b.score - a.score)
}

function vectorSearch(query, passages) {
  const queryVector = vectorizeSemantic(query)
  return passages.map((passage) => ({
    passage_id: passage.passage_id,
    score: cosine(queryVector, vectorizeSemantic(passage.text)) + relationBoost(query, passage.text),
  })).sort((a, b) => b.score - a.score)
}

function hybridSearch(bm25, vector) {
  const scores = new Map()
  for (const [index, result] of bm25.entries()) scores.set(result.passage_id, (scores.get(result.passage_id) ?? 0) + 1 / (index + 1))
  for (const [index, result] of vector.entries()) scores.set(result.passage_id, (scores.get(result.passage_id) ?? 0) + 1 / (index + 1))
  return [...scores.entries()].map(([passage_id, score]) => ({ passage_id, score })).sort((a, b) => b.score - a.score)
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

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function main() {
  mkdirSync(resultsDir, { recursive: true })
  const config = existsSync(localConfigPath) ? JSON.parse(readFileSync(localConfigPath, 'utf8')) : null
  const tasks = readJsonl(taskPath)
  const gold = readJsonl(goldPath)
  const corpus = buildCorpus(config)
  const passageById = new Map(corpus.passages.map((passage) => [passage.passage_id, passage]))
  const taskRuns = []

  for (const task of tasks) {
    const labels = gold.filter((label) => label.task_id === task.id)
    const bm25 = bm25Search(task.query, corpus.passages)
    const vector = vectorSearch(task.query, corpus.passages)
    const hybrid = hybridSearch(bm25, vector)
    for (const [baseline, results] of Object.entries({ keyword: bm25, vector, hybrid })) {
      taskRuns.push({
        task_id: task.id,
        baseline,
        metrics: metrics(results, labels),
        candidates: results.slice(0, 20).map((result, index) => ({
          rank: index + 1,
          ...result,
          quote: passageById.get(result.passage_id)?.text.slice(0, 280) ?? '',
        })),
      })
    }
  }

  const manifest = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    config: {
      mirror_path_configured: Boolean(config?.mirror_path),
      mirror_files_indexed: corpus.mirrorFiles.length,
      fixture_works_indexed: fixtureTexts().length,
      works_indexed: corpus.works.length,
      passages_indexed: corpus.passages.length,
      chunking_version: chunkingVersion,
    },
    artifacts: {
      benchmark_item: 'task_items.jsonl',
      gold_labels: 'gold_labels.jsonl',
      schema: 'schema.sql',
      retrieval_candidates: `baseline_results/${runId}-retrieval_candidates.json`,
      metrics: `baseline_results/${runId}-metrics.json`,
      trace: `baseline_results/${runId}-trace.jsonl`,
      error_analysis: `baseline_results/${runId}-error_analysis.md`,
    },
  }

  writeJson(join(resultsDir, `${runId}-manifest.json`), manifest)
  writeJson(join(resultsDir, `${runId}-retrieval_candidates.json`), taskRuns)
  writeJson(join(resultsDir, `${runId}-metrics.json`), taskRuns.map(({ task_id, baseline, metrics }) => ({ task_id, baseline, ...metrics })))
  writeFileSync(join(resultsDir, `${runId}-trace.jsonl`), taskRuns.map((run) => JSON.stringify({ run_id: runId, event: 'baseline_completed', task_id: run.task_id, baseline: run.baseline })).join('\n') + '\n')
  writeFileSync(join(resultsDir, `${runId}-error_analysis.md`), [
    '# Pilot Error Analysis',
    '',
    'This deterministic pilot verifies the benchmark plumbing before human adjudication and full-corpus indexing.',
    '',
    `- Mirror files indexed: ${corpus.mirrorFiles.length}`,
    `- Passages indexed: ${corpus.passages.length}`,
    '- Known limitation: the fixture is intentionally small; full benchmark releases should replace fixture labels with adjudicated Gutenberg passages.',
    '- Next review target: inspect hard negatives accepted by hybrid top-10 and add narrower rubrics or labels where needed.',
    '',
  ].join('\n'))

  console.log(JSON.stringify(manifest, null, 2))
}

main()
