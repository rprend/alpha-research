import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v4-candidate')
const workspaceRoot = join(candidateDir, 'workspaces')
const hiddenGoldPath = join(candidateDir, 'hidden-gold.json')
const outputPath = join(candidateDir, 'shallow-baseline-report.json')
const auditPath = join(candidateDir, 'audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V4_SHALLOW_BASELINE.md')
const candidateMarkdownPath = join(experimentDir, 'AGENTIC_V4_CANDIDATE.md')

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
  const match = String(doc.text || '').match(/Row answer field:\s*(.+?)(?:\n|$)/)
  return match ? match[1].trim() : ''
}

function solve(task, corpus) {
  const quotes = quotedStrings(task.user_question)
  const exactDocs = corpus.documents.filter((doc) => quotes.some((quote) => normalize(doc.text).includes(normalize(quote))))
  const category = task.category

  if (category === 'multi-hop synthesis' && exactDocs.length >= 2) {
    return {
      answer: `${rowAnswerFromDoc(exactDocs[0])} => ${rowAnswerFromDoc(exactDocs[1])}`,
      cited_evidence_ids: exactDocs.slice(0, 2).map((doc) => doc.document_id),
      strategy: 'quoted_title_lookup_two_docs',
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
      cited_evidence_ids: corpus.documents.filter((doc) => doc.role === 'document_a' || doc.role === 'document_b').map((doc) => doc.document_id),
      strategy: 'category_keyword_conflict',
    }
  }

  const controllingRoles = {
    'stale-vs-current document conflicts': 'current',
    'appended document lifecycle changes': 'appendix_update',
    'source authority conflicts': 'high_authority',
    'temporal questions: as of date X': 'as_of_valid',
  }
  if (controllingRoles[category]) {
    const doc = corpus.documents.find((candidate) => candidate.role === controllingRoles[category])
    const match = String(doc?.text || '').match(/answer (?:is |")([^".]+|"[^"]+")/i)
    const answer = match ? match[1].replace(/^"|"$/g, '').trim() : rowAnswerFromDoc(exactDocs[0])
    return {
      answer,
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: `role_lookup_${controllingRoles[category]}`,
    }
  }

  if (category === 'table + text reasoning') {
    const doc = exactDocs[0]
    return {
      answer: `${rowAnswerFromDoc(doc)} @ ${doc?.source_dataset || ''}`,
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'quoted_title_lookup_answer_and_dataset',
    }
  }

  if (category === 'entity disambiguation') {
    const sourceKey = task.target?.challenge?.exact_source_key || ''
    const doc = corpus.documents.find((candidate) => `${candidate.source_dataset}:${candidate.source_row_id}` === sourceKey)
    return {
      answer: rowAnswerFromDoc(doc),
      cited_evidence_ids: doc ? [doc.document_id] : [],
      strategy: 'source_key_lookup_from_task_json',
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
const taskDirs = readdirSync(workspaceRoot).filter((name) => name.startsWith('hgr_v4_candidate_')).sort()
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
  report_id: 'agentic-v4-candidate-shallow-baseline',
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
  report_path: 'generated/agentic-v4-candidate/shallow-baseline-report.json',
  solved_count: report.solved_count,
  solve_rate: report.solve_rate,
  buyer_gate_passed: report.buyer_gate_passed,
}
audit.checks.shallow_metadata_baseline_rejected = report.buyer_gate_passed
audit.status = report.buyer_gate_passed ? audit.status : 'candidate_rejected_by_shallow_baseline'
audit.reason = report.buyer_gate_passed
  ? audit.reason
  : 'This v4 candidate repairs source-question diversity but is not buyer-ready because a shallow metadata/role baseline solves many tasks.'
audit.blockers = [
  `Rewrite or remove ${report.solved_count} tasks solved by the shallow metadata baseline.`,
  ...audit.blockers.filter((blocker) => !blocker.startsWith('Run a shallow lexical/metadata baseline')),
]
writeJson(auditPath, audit)

writeText(
  markdownPath,
  `# Agentic V4 Shallow Baseline

This report runs a deliberately shallow solver against the v4 candidate suite. The solver uses quoted-title lookup, task metadata roles, and category keywords.

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
  `# Agentic V4 Candidate Suite

This candidate suite is a replacement path for the v3 suite's diversity failure.

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
