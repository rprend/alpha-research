import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v8-candidate')
const workspaceRoot = join(candidateDir, 'workspaces')
const hiddenGoldPath = join(candidateDir, 'hidden-gold.json')
const outputPath = join(candidateDir, 'shallow-baseline-report.json')
const auditPath = join(candidateDir, 'audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V8_SHALLOW_BASELINE.md')
const candidateMarkdownPath = join(experimentDir, 'AGENTIC_V8_CANDIDATE.md')

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function normalize(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function quotedStrings(text) {
  return [...String(text).matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter(Boolean)
}

function rowAnswerFromDoc(doc) {
  if (!doc) return ''
  const text = String(doc.text || '')
  const quoted = text.match(/short result (?:recorded by the source |is )"([^"]+)"/i)
  if (quoted) return quoted[1].trim()
  const plain = text.match(/short result (?:recorded by the source |is )(.+?)(?:\.|\n|$)/i)
  return plain ? plain[1].trim() : ''
}

function recordDate(doc) {
  const match = String(doc?.text || '').match(/Record date:\s*(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : ''
}

function reviewRank(doc) {
  const text = String(doc?.text || '').toLowerCase()
  if (text.includes('signed research review') || text.includes('curated editorial record')) return 2
  if (text.includes('open community note') || text.includes('informal summary record')) return 1
  return 0
}

function collectionAlias(doc) {
  const explicit = String(doc?.text || '').match(/Dataset alias for task:\s*(collection-[a-z0-9]+)/i)
  if (explicit) return explicit[1]
  const collection = String(doc?.text || '').match(/comes from the ([^ ]+) collection/i)
  return collection ? collection[1] : ''
}

function isAppendix(doc) {
  const text = String(doc?.text || '')
  return /Document part:\s*Appendix/i.test(text) || /Filed after:\s*main body/i.test(text)
}

function matchDocsByQuotes(task, corpus) {
  const formatLiterals = new Set(['first => second', 'short result @ collection alias'])
  return quotedStrings(task.user_question)
    .filter((quote) => !formatLiterals.has(quote))
    .map((quote) => {
      const key = normalize(quote.replace('...', ''))
      return corpus.documents.filter((doc) => normalize(doc.text).includes(key))
    })
}

function solve(task, corpus) {
  const groups = matchDocsByQuotes(task, corpus)
  const exactDocs = groups.flat()
  const category = task.category

  if (category === 'multi-hop synthesis' && groups.length >= 2 && groups.every((group) => group.length > 0)) {
    const docs = groups.map((group) => group[0])
    return {
      answer: `${rowAnswerFromDoc(docs[0])} => ${rowAnswerFromDoc(docs[1])}`,
      cited_evidence_ids: docs.map((doc) => doc.document_id),
      strategy: 'quoted_phrase_short_result_two_docs',
    }
  }

  if (category === 'evidence insufficiency / abstention' || category === 'citation supports fact but not conclusion') {
    return {
      answer: 'ABSTAIN',
      cited_evidence_ids: [],
      strategy: 'category_keyword_abstain',
    }
  }

  if (category === 'cross-document contradiction') {
    return {
      answer: 'CONFLICT',
      cited_evidence_ids: groups.map((group) => group[0]).filter(Boolean).map((doc) => doc.document_id),
      strategy: 'category_keyword_conflict',
    }
  }

  if (category === 'stale-vs-current document conflicts') {
    const doc = [...exactDocs].sort((a, b) => recordDate(b).localeCompare(recordDate(a)))[0]
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_newest_record_date',
    }
  }

  if (category === 'appended document lifecycle changes') {
    const doc = exactDocs.find(isAppendix) || exactDocs.at(-1)
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_appendix_marker',
    }
  }

  if (category === 'source authority conflicts') {
    const doc = [...exactDocs].sort((a, b) => reviewRank(b) - reviewRank(a))[0]
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_review_status',
    }
  }

  if (category === 'temporal questions: as of date X') {
    const asOf = task.target?.challenge?.as_of_date || '9999-12-31'
    const doc = exactDocs.filter((candidate) => !recordDate(candidate) || recordDate(candidate) <= asOf).sort((a, b) => recordDate(b).localeCompare(recordDate(a)))[0]
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_as_of_record_date',
    }
  }

  if (category === 'table + text reasoning') {
    const doc = groups[0]?.[0]
    return {
      answer: `${rowAnswerFromDoc(doc)} @ ${collectionAlias(doc)}`,
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_short_result_and_alias',
    }
  }

  if (category === 'entity disambiguation') {
    const doc = groups[0]?.[0]
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_phrase_entity_match',
    }
  }

  return { answer: '', cited_evidence_ids: [], strategy: 'no_solution' }
}

function score(gold, prediction) {
  const expected = gold.expected_answers[0] || ''
  const answerCorrect = normalize(prediction.answer) === normalize(expected)
  const required = new Set(gold.required_evidence_ids || [])
  const cited = new Set(prediction.cited_evidence_ids || [])
  const recall = required.size === 0 ? 1 : [...required].filter((id) => cited.has(id)).length / required.size
  return {
    answer_correct: answerCorrect,
    evidence_recall: Number(recall.toFixed(4)),
    solved: answerCorrect && recall === 1,
  }
}

const hiddenGold = readJson(hiddenGoldPath)
const goldByTask = new Map(hiddenGold.tasks.map((entry) => [entry.task_id, entry.gold]))
const taskDirs = readdirSync(workspaceRoot).filter((name) => name.startsWith('hgr_v8_candidate_')).sort()
const taskScores = []
for (const taskDir of taskDirs) {
  const task = readJson(join(workspaceRoot, taskDir, 'task.json'))
  const corpus = readJson(join(workspaceRoot, taskDir, 'corpus.json'))
  const prediction = solve(task, corpus)
  const scored = score(goldByTask.get(task.task_id), prediction)
  taskScores.push({
    task_id: task.task_id,
    category: task.category,
    strategy: prediction.strategy,
    predicted_answer: prediction.answer,
    expected_answer: goldByTask.get(task.task_id).expected_answers[0],
    ...scored,
  })
}

const solved = taskScores.filter((score) => score.solved)
const byCategory = Object.fromEntries(
  [...new Set(taskScores.map((score) => score.category))].map((category) => {
    const scores = taskScores.filter((score) => score.category === category)
    return [
      category,
      {
        task_count: scores.length,
        solved_count: scores.filter((score) => score.solved).length,
        solve_rate: Number((scores.filter((score) => score.solved).length / scores.length).toFixed(4)),
      },
    ]
  }),
)

const report = {
  report_id: 'agentic-v8-candidate-shallow-baseline',
  suite_id: hiddenGold.suite_id,
  task_count: taskScores.length,
  solved_count: solved.length,
  solve_rate: Number((solved.length / taskScores.length).toFixed(4)),
  buyer_gate_passed: solved.length === 0,
  interpretation:
    solved.length === 0
      ? 'No candidate tasks were solved by this shallow metadata baseline.'
      : 'Candidate tasks are not buyer-ready: shallow metadata/role lookup solves too many tasks.',
  by_category: byCategory,
  solved_task_ids: solved.map((score) => score.task_id),
  task_scores: taskScores,
}

writeJson(outputPath, report)

const audit = readJson(auditPath)
audit.shallow_baseline = {
  report_path: 'generated/agentic-v8-candidate/shallow-baseline-report.json',
  solved_count: report.solved_count,
  solve_rate: report.solve_rate,
  buyer_gate_passed: report.buyer_gate_passed,
}
audit.checks.shallow_metadata_baseline_rejected = report.buyer_gate_passed
audit.status = report.buyer_gate_passed ? audit.status : 'candidate_rejected_by_shallow_baseline'
audit.reason = report.buyer_gate_passed
  ? audit.reason
  : 'This v8 candidate is not buyer-ready because a shallow metadata/string baseline solves tasks.'
audit.blockers = [
  ...(report.solved_count > 0 ? [`Rewrite or remove ${report.solved_count} tasks solved by the shallow metadata baseline.`] : []),
  ...audit.blockers.filter((blocker) => !blocker.startsWith('Run a shallow lexical/metadata baseline')),
]
writeJson(auditPath, audit)

writeText(
  markdownPath,
  `# Agentic V8 Shallow Baseline

This report runs a deliberately shallow solver against the v8 candidate suite. The solver uses quoted phrase lookup, visible short-result prose, visible dates, visible appendix markers, visible review-status markers, and category keywords.

## Result

- Tasks: ${report.task_count}
- Solved by shallow baseline: ${report.solved_count}
- Solve rate: ${Math.round(report.solve_rate * 1000) / 10}%
- Buyer gate passed: ${report.buyer_gate_passed}

${report.interpretation}

## By Category

| Category | Tasks | Solved | Solve rate |
| --- | ---: | ---: | ---: |
${Object.entries(byCategory)
  .map(([category, row]) => `| ${category} | ${row.task_count} | ${row.solved_count} | ${Math.round(row.solve_rate * 1000) / 10}% |`)
  .join('\n')}
`,
)

writeText(
  candidateMarkdownPath,
  `# Agentic V8 Candidate Suite

This candidate suite removes the v4 exact marker and public role-label shortcuts.

## Status

- Status: ${audit.status}
- Buyer ready: ${audit.buyer_ready}
- Tasks: ${audit.summary.task_count}
- Categories: ${audit.summary.categories}
- Unique native questions: ${audit.summary.unique_native_questions}/150
- Corpus documents per task: ${audit.summary.min_corpus_documents}-${audit.summary.max_corpus_documents}
- Source rows available: ${audit.summary.source_rows_available}
- Redistributable preview rows: ${audit.summary.redistributable_preview_rows_available}
- Pointer-only rows: ${audit.summary.pointer_only_rows_available}
- Shallow baseline solved: ${report.solved_count}/${report.task_count}

## Checks

| Check | Pass |
| --- | --- |
${Object.entries(audit.checks)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n')}

## Blockers

${audit.blockers.map((blocker) => `- ${blocker}`).join('\n')}
`,
)

console.log(`Wrote ${outputPath}`)
console.log(`Updated ${auditPath}`)
console.log(`Wrote ${markdownPath}`)
console.log(`Updated ${candidateMarkdownPath}`)
