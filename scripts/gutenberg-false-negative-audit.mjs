import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/gutenberg-semantic-benchmark')
const dataDir = join(experimentDir, 'data')
const auditDir = join(experimentDir, 'audits')
const inventoryPath = join(experimentDir, '.local/corpus/source-inventory.jsonl')
const taskPath = join(dataDir, 'task_items.jsonl')
const currentLabelsPath = join(dataDir, '2026-06-03T16-42-52-712Z-real_gold_labels.jsonl')
const currentCandidatesPath = join(experimentDir, 'baseline_results/2026-06-03T16-42-52-712Z-retrieval_candidates.json')
const runId = new Date().toISOString().replace(/[:.]/g, '-')
const maxWorks = Number(valueForArg('--max-works') ?? 5_000)
const auditTopK = Number(valueForArg('--top-k') ?? 500)
const reviewSampleSize = Number(valueForArg('--review-sample') ?? 25)

const stopwords = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'has', 'have', 'he', 'her', 'his',
  'in', 'is', 'it', 'its', 'of', 'on', 'or', 'she', 'that', 'the', 'their', 'they', 'this', 'to',
  'was', 'were', 'where', 'with', 'you', 'your', 'but', 'not', 'had', 'all', 'one', 'there',
])

const lexicon = {
  death: ['death', 'dead', 'died', 'dying', 'funeral', 'coffin', 'grave', 'burial', 'corpse', 'widow', 'mourning', 'loss', 'undertaker', 'deathbed'],
  humor: ['joke', 'jest', 'laugh', 'smile', 'comic', 'funny', 'wit', 'irony', 'dry', 'understated', 'quip', 'absurd', 'mock', 'merry'],
  coping: ['cope', 'coping', 'managed', 'arranged', 'kept', 'steady', 'steadied', 'composed', 'deflect', 'relief', 'endure', 'bear', 'courage'],
  inward: ['quiet', 'tired', 'weary', 'rain', 'home', 'inward', 'mellow', 'hopeless', 'grey', 'resigned', 'lonely', 'twilight'],
  criticism: ['scold', 'criticized', 'fault', 'foolish', 'care', 'dear', 'protect', 'affection', 'rebuke', 'chide', 'reproach'],
  class: ['poor', 'poverty', 'rank', 'money', 'respectable', 'parlor', 'house', 'status', 'shabby', 'embarrassed', 'gentility', 'servant'],
  irony: ['irony', 'solemn', 'grand', 'absurd', 'dignity', 'vanity', 'bathos', 'narrator', 'self-image', 'ridiculous'],
  religion: ['god', 'soul', 'spirit', 'spiritual', 'sin', 'heaven', 'providence', 'prayer', 'faith', 'moral', 'decay', 'progress'],
  empire: ['empire', 'imperial', 'colony', 'conquest', 'destiny', 'civilization', 'savage', 'frontier', 'rule', 'race', 'flag'],
  domestic: ['home', 'room', 'house', 'door', 'bed', 'nursery', 'kitchen', 'chamber', 'domestic', 'parlor', 'hearth'],
  gothic: ['dark', 'dread', 'terror', 'castle', 'secret', 'shadow', 'haunted', 'gloom', 'fear', 'corridor', 'ruin'],
}

const seededHints = {
  death_ironic_humor_001: {
    authors: ['twain', 'stern', 'dickens', 'shakespeare', 'swift', 'corelli'],
    titles: ['tristram', 'huckleberry', 'pickwick', 'hamlet', 'tale of two cities'],
    terms: ['gallows humor', 'deathbed jest', 'funeral joke', 'grave wit'],
  },
  rainy_commute_vibe_001: {
    authors: ['galsworthy', 'hardy', 'wharton', 'lawrence', 'woolf', 'dickens'],
    titles: ['beyond', 'ethan frome', 'sons and lovers'],
    terms: ['rain', 'station', 'street', 'weary', 'grey', 'home'],
  },
  affection_as_criticism_001: {
    authors: ['austen', 'gaskell', 'alcott', 'dickens', 'eliot'],
    titles: ['pride and prejudice', 'emma', 'little women', 'mary barton'],
    terms: ['scolded because she loved', 'chided affectionately', 'dear fool'],
  },
  class_anxiety_place_001: {
    authors: ['austen', 'dickens', 'gaskell', 'wharton', 'thackeray'],
    titles: ['great expectations', 'vanity fair', 'house of mirth', 'north and south'],
    terms: ['shabby room', 'respectable poverty', 'poor lodging', 'parlor'],
  },
  progress_as_decay_001: {
    authors: ['ruskin', 'carlyle', 'morris', 'chesterton', 'butler'],
    titles: ['news from nowhere', 'past and present', 'heretics'],
    terms: ['progress spiritual decay', 'machine soul', 'industrial sin', 'modern decay'],
  },
  narrator_undercuts_self_image_001: {
    authors: ['austen', 'thackeray', 'fielding', 'dickens', 'chesterton'],
    titles: ['vanity fair', 'tom jones', 'emma', 'pride and prejudice'],
    terms: ['vanity', 'dignity', 'ridiculous', 'solemnly absurd'],
  },
  domestic_space_threatening_001: {
    authors: ['gaskell', 'bronte', 'wharton', 'wells', 'stoker'],
    titles: ['jane eyre', 'wuthering heights', 'the turn of the screw', 'lodger'],
    terms: ['threatening room', 'unsafe home', 'dark chamber', 'locked door'],
  },
  resignation_not_despair_001: {
    authors: ['dickens', 'hardy', 'eliot', 'gaskell', 'tolstoy'],
    titles: ['tale of two cities', 'silas marner', 'jude the obscure'],
    terms: ['calm resignation', 'accepted suffering', 'endured quietly'],
  },
  gothic_without_supernatural_001: {
    authors: ['radcliffe', 'bronte', 'poe', 'hawthorne', 'stoker'],
    titles: ['udolpho', 'jane eyre', 'house of the seven gables'],
    terms: ['gothic dread', 'dark corridor', 'secret room', 'no ghost'],
  },
  empire_as_destiny_001: {
    authors: ['kipl', 'haggard', 'stevenson', 'conrad', 'buchan'],
    titles: ['king solomon', 'kim', 'prester john', 'heart of darkness'],
    terms: ['empire destiny', 'imperial destiny', 'civilizing mission', 'frontier rule'],
  },
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

function chunkText(text, targetWords = 600, overlapWords = 100) {
  const normalized = text.replace(/\s+/g, ' ').trim()
  const words = normalized.split(' ').filter(Boolean)
  const chunks = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(words.length, start + targetWords)
    chunks.push(words.slice(start, end).join(' '))
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

function taskSignals(task) {
  const query = task.query.toLowerCase()
  if (query.includes('death') && (query.includes('humor') || query.includes('dry') || query.includes('ironic'))) {
    return [lexicon.death, lexicon.humor, lexicon.coping]
  }
  const signals = []
  for (const [name, words] of Object.entries(lexicon)) {
    if (query.includes(name) || words.some((word) => query.includes(word))) signals.push(words)
  }
  return signals.length ? signals.slice(0, 4) : [tokenize(task.query).slice(0, 12)]
}

function profileTerms(task, profile) {
  const base = new Set(tokenize(task.query))
  const hints = seededHints[task.id] ?? { authors: [], titles: [], terms: [] }
  if (profile === 'expanded') {
    for (const group of taskSignals(task)) for (const word of group) base.add(word)
    for (const word of tokenize(`${task.rubric.strong_match} ${task.rubric.near_miss}`)) base.add(word)
  }
  if (profile === 'seeded') {
    for (const word of tokenize([...hints.terms, ...hints.titles, ...hints.authors].join(' '))) base.add(word)
  }
  if (profile === 'lower_rank') {
    for (const group of taskSignals(task)) for (const word of group.slice(0, 4)) base.add(word)
  }
  return [...base]
}

function scoreText(tokenSet, work, terms, task, profile) {
  let score = 0
  for (const term of terms) {
    if (tokenSet.has(term)) score += 1
  }
  const signals = taskSignals(task)
  const covered = signals.filter((group) => group.some((word) => tokenSet.has(word))).length
  score += covered * 4
  if (profile === 'seeded') {
    const hints = seededHints[task.id] ?? { authors: [], titles: [] }
    const author = String(work.author ?? '').toLowerCase()
    const title = String(work.title ?? '').toLowerCase()
    if (hints.authors.some((hint) => author.includes(hint))) score += 6
    if (hints.titles.some((hint) => title.includes(hint))) score += 6
  }
  return score
}

function candidateLooksPositive(task, quote) {
  const lowered = quote.toLowerCase()
  const signals = taskSignals(task)
  const covered = signals.filter((group) => group.some((word) => lowered.includes(word))).length
  return covered >= Math.max(1, Math.min(3, signals.length))
}

function main() {
  mkdirSync(auditDir, { recursive: true })
  if (!existsSync(inventoryPath)) throw new Error(`Missing corpus inventory: ${inventoryPath}`)
  const startedAt = performance.now()
  const tasks = readJsonl(taskPath)
  const inventory = readJsonl(inventoryPath).slice(0, maxWorks)
  const currentLabels = readJsonl(currentLabelsPath)
  const currentCandidates = JSON.parse(readFileSync(currentCandidatesPath, 'utf8'))
  const profiles = ['expanded', 'seeded', 'lower_rank']
  const state = new Map()
  for (const task of tasks) {
    state.set(task.id, Object.fromEntries(profiles.map((profile) => [profile, {
      terms: profileTerms(task, profile),
      top: new TopK(auditTopK),
    }])))
  }

  let passages = 0
  for (const work of inventory) {
    const chunks = chunkText(readFileSync(work.cleaned_path, 'utf8'))
    for (const [index, quote] of chunks.entries()) {
      const tokenSet = new Set(tokenize(quote))
      const rowBase = {
        passage_id: `${work.work_id}-p${String(index + 1).padStart(6, '0')}`,
        work_id: work.work_id,
        gutenberg_id: work.gutenberg_id,
        title: work.title,
        author: work.author,
        quote: quote.slice(0, 600),
      }
      for (const task of tasks) {
        const taskState = state.get(task.id)
        for (const profile of profiles) {
          const score = scoreText(tokenSet, work, taskState[profile].terms, task, profile)
          taskState[profile].top.push({ ...rowBase, score })
        }
      }
      passages += 1
      if (passages % 100_000 === 0) console.log(`audit_pass passages=${passages}`)
    }
  }

  const taskReports = []
  for (const task of tasks) {
    const currentPositiveIds = new Set(currentLabels.filter((row) => row.task_id === task.id && row.label === 'positive').map((row) => row.passage_id))
    const currentPoolIds = new Set(currentCandidates.filter((run) => run.task_id === task.id).flatMap((run) => run.candidates.map((candidate) => candidate.passage_id)))
    const auditPools = {}
    const likelyMisses = new Map()
    for (const profile of profiles) {
      const rows = state.get(task.id)[profile].top.values()
      auditPools[profile] = rows.slice(0, reviewSampleSize)
      for (const row of rows) {
        if (currentPositiveIds.has(row.passage_id)) continue
        if (!candidateLooksPositive(task, row.quote)) continue
        if (!likelyMisses.has(row.passage_id)) likelyMisses.set(row.passage_id, { ...row, discovered_by: [] })
        likelyMisses.get(row.passage_id).discovered_by.push(profile)
      }
    }
    const likelyMissRows = [...likelyMisses.values()]
    const currentPositiveCount = currentPositiveIds.size
    const estimatedUniverse = currentPositiveCount + likelyMissRows.length
    const estimatedCoverage = estimatedUniverse ? currentPositiveCount / estimatedUniverse : null
    const overlap = Object.fromEntries(profiles.map((profile) => {
      const rows = state.get(task.id)[profile].top.values()
      const ids = new Set(rows.map((row) => row.passage_id))
      return [profile, {
        top_count: ids.size,
        overlap_with_current_positive: [...currentPositiveIds].filter((id) => ids.has(id)).length,
        overlap_with_current_pool: [...currentPoolIds].filter((id) => ids.has(id)).length,
      }]
    }))
    taskReports.push({
      task_id: task.id,
      query: task.query,
      current_positive_count: currentPositiveCount,
      likely_new_positive_candidates: likelyMissRows.length,
      estimated_candidate_recall: estimatedCoverage,
      overlap,
      review_samples: auditPools,
      likely_misses_sample: likelyMissRows.slice(0, reviewSampleSize),
    })
  }

  const report = {
    run_id: runId,
    generated_at: new Date().toISOString(),
    corpus: {
      works: inventory.length,
      passages,
      source: 'Project Gutenberg',
    },
    method: {
      profiles,
      top_k_per_profile: auditTopK,
      coverage_formula: 'current_positive_count / (current_positive_count + likely_new_positive_candidates)',
      caveat: 'Likely positives are heuristic candidates, not adjudicated gold. Estimate is a candidate-recall proxy, not true recall.',
    },
    tasks: taskReports,
  }
  const jsonPath = join(auditDir, `${runId}-false-negative-audit.json`)
  const mdPath = join(auditDir, `${runId}-false-negative-audit.md`)
  writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`)
  writeFileSync(mdPath, renderMarkdown(report))
  console.log(JSON.stringify({
    run_id: runId,
    works: inventory.length,
    passages,
    elapsed_ms: Math.round(performance.now() - startedAt),
    json: jsonPath,
    markdown: mdPath,
    estimated_coverage_by_task: Object.fromEntries(taskReports.map((task) => [task.task_id, task.estimated_candidate_recall])),
  }, null, 2))
}

function renderMarkdown(report) {
  const lines = []
  lines.push('# Gutenberg False Negative Audit')
  lines.push('')
  lines.push(`Run: ${report.run_id}`)
  lines.push(`Corpus: ${report.corpus.works} Project Gutenberg works, ${report.corpus.passages} passages.`)
  lines.push('')
  lines.push('Coverage estimate formula: `current positives / (current positives + likely new positive candidates)`.')
  lines.push('')
  lines.push('This is not true recall. It is a heuristic estimate from alternate candidate mining profiles, intended to prioritize human review.')
  lines.push('')
  lines.push('| Task | Current positives | Likely new positives | Estimated coverage |')
  lines.push('|---|---:|---:|---:|')
  for (const task of report.tasks) {
    lines.push(`| ${task.task_id} | ${task.current_positive_count} | ${task.likely_new_positive_candidates} | ${formatPct(task.estimated_candidate_recall)} |`)
  }
  for (const task of report.tasks) {
    lines.push('')
    lines.push(`## ${task.task_id}`)
    lines.push('')
    lines.push(task.query)
    lines.push('')
    lines.push(`Estimated coverage: ${formatPct(task.estimated_candidate_recall)} (${task.current_positive_count} current positives, ${task.likely_new_positive_candidates} likely new positives).`)
    lines.push('')
    lines.push('### Likely Misses Sample')
    lines.push('')
    lines.push('| Passage | Work | Found by | Quote |')
    lines.push('|---|---|---|---|')
    for (const row of task.likely_misses_sample.slice(0, 12)) {
      lines.push(`| \`${row.passage_id}\` | ${cleanCell(row.title)} / ${cleanCell(row.author)} | ${row.discovered_by.join(', ')} | ${cleanCell(row.quote.slice(0, 360))} |`)
    }
  }
  return `${lines.join('\n')}\n`
}

function formatPct(value) {
  return value == null ? 'n/a' : `${Math.round(value * 1000) / 10}%`
}

function cleanCell(value) {
  return String(value ?? '').replace(/\s+/g, ' ').replace(/\|/g, '\\|').trim()
}

main()
