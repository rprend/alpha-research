import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const candidateDir = join(experimentDir, 'generated/agentic-v11-candidate')
const workspaceRoot = join(candidateDir, 'workspaces')
const hiddenGoldPath = join(candidateDir, 'hidden-gold.json')
const auditPath = join(candidateDir, 'audit.json')
const outputPath = join(candidateDir, 'retrieval-shortcut-audit.json')
const markdownPath = join(experimentDir, 'AGENTIC_V11_RETRIEVAL_SHORTCUT_AUDIT.md')
const candidateMarkdownPath = join(experimentDir, 'AGENTIC_V11_CANDIDATE.md')

const stop = new Set([
  'the',
  'and',
  'for',
  'with',
  'from',
  'that',
  'this',
  'what',
  'which',
  'whose',
  'about',
  'into',
  'does',
  'did',
  'was',
  'were',
  'are',
  'how',
  'why',
  'who',
  'when',
  'where',
  'using',
  'based',
  'study',
  'source',
  'sources',
  'answer',
  'question',
  'questions',
  'corpus',
  'return',
  'search',
  'cite',
  'cited',
  'evidence',
  'first',
  'second',
  'same',
  'date',
  'rule',
])

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

function tokens(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token))
}

function tokenSet(value) {
  return new Set(tokens(value))
}

function overlapScore(questionSet, doc) {
  const docSet = tokenSet(`${doc.title}\n${doc.text}`)
  let overlap = 0
  for (const token of questionSet) if (docSet.has(token)) overlap += 1
  return overlap / Math.sqrt(Math.max(1, docSet.size))
}

const hiddenGold = readJson(hiddenGoldPath)
const goldByTask = new Map(hiddenGold.tasks.map((entry) => [entry.task_id, entry.gold]))
const taskDirs = readdirSync(workspaceRoot).filter((name) => name.startsWith('hgr_v11_candidate_')).sort()
const taskAudits = []

for (const taskDir of taskDirs) {
  const task = readJson(join(workspaceRoot, taskDir, 'task.json'))
  const corpus = readJson(join(workspaceRoot, taskDir, 'corpus.json'))
  const gold = goldByTask.get(task.task_id)
  const required = new Set(gold.required_evidence_ids || [])
  const qSet = tokenSet(task.user_question)
  const ranked = corpus.documents
    .map((doc) => ({ document_id: doc.document_id, score: overlapScore(qSet, doc), required: required.has(doc.document_id) }))
    .sort((a, b) => b.score - a.score || a.document_id.localeCompare(b.document_id))
  const requiredRanks = ranked
    .map((row, index) => ({ ...row, rank: index + 1 }))
    .filter((row) => row.required)
  const allRequiredTop10 = requiredRanks.length > 0 && requiredRanks.every((row) => row.rank <= 10)
  const anyRequiredTop1 = requiredRanks.some((row) => row.rank === 1)
  const meanRank = requiredRanks.reduce((sum, row) => sum + row.rank, 0) / Math.max(1, requiredRanks.length)
  const finding = allRequiredTop10
    ? 'all_required_docs_in_top10_by_question_token_overlap'
    : anyRequiredTop1
      ? 'one_required_doc_ranked_first_by_question_token_overlap'
      : ''
  taskAudits.push({
    task_id: task.task_id,
    category: task.category,
    question_token_count: qSet.size,
    required_ranks: requiredRanks.map((row) => ({ document_id: row.document_id, rank: row.rank, score: Number(row.score.toFixed(4)) })),
    mean_required_rank: Number(meanRank.toFixed(2)),
    top5_required_count: requiredRanks.filter((row) => row.rank <= 5).length,
    top10_required_count: requiredRanks.filter((row) => row.rank <= 10).length,
    finding,
    pass: !finding,
  })
}

const findingCounts = {}
for (const row of taskAudits) {
  if (row.finding) findingCounts[row.finding] = (findingCounts[row.finding] || 0) + 1
}

const byCategory = Object.fromEntries(
  [...new Set(taskAudits.map((task) => task.category))].map((category) => {
    const rows = taskAudits.filter((task) => task.category === category)
    return [
      category,
      {
        task_count: rows.length,
        pass_count: rows.filter((row) => row.pass).length,
        mean_required_rank: Number((rows.reduce((sum, row) => sum + row.mean_required_rank, 0) / rows.length).toFixed(2)),
        top10_required_docs: rows.reduce((sum, row) => sum + row.top10_required_count, 0),
      },
    ]
  }),
)

const report = {
  report_id: 'agentic-v11-candidate-retrieval-shortcut-audit',
  suite_id: hiddenGold.suite_id,
  checked_date: '2026-06-27',
  task_count: taskAudits.length,
  pass_count: taskAudits.filter((row) => row.pass).length,
  fail_count: taskAudits.filter((row) => !row.pass).length,
  buyer_gate_passed: taskAudits.every((row) => row.pass),
  interpretation:
    'Ranks documents using only question-token overlap. Tasks fail if this cheap retrieval heuristic places all required documents in the top 10, or any required document first.',
  finding_counts: findingCounts,
  by_category: byCategory,
  failing_task_ids: taskAudits.filter((row) => !row.pass).map((row) => row.task_id),
  task_audits: taskAudits,
}

writeJson(outputPath, report)

const audit = readJson(auditPath)
audit.retrieval_shortcut_audit = {
  report_path: 'generated/agentic-v11-candidate/retrieval-shortcut-audit.json',
  pass_count: report.pass_count,
  fail_count: report.fail_count,
  buyer_gate_passed: report.buyer_gate_passed,
}
audit.checks.retrieval_shortcut_audit_passed = report.buyer_gate_passed
audit.status = report.buyer_gate_passed ? audit.status : 'candidate_not_buyer_ready'
audit.buyer_ready = false
audit.blockers = [
  ...(report.buyer_gate_passed ? [] : [`Rewrite ${report.fail_count} v11 tasks whose required evidence is exposed by token-overlap retrieval.`]),
  ...audit.blockers.filter((blocker) => !blocker.includes('token-overlap retrieval')),
]
writeJson(auditPath, audit)

writeText(
  markdownPath,
  `# Agentic V11 Retrieval Shortcut Audit

This audit ranks each task corpus with a cheap question-token-overlap score. It is intentionally weaker than a modern embedding retriever; it exists to catch tasks that are too easy before running expensive frontier-agent baselines.

## Result

- Tasks: ${report.task_count}
- Passed: ${report.pass_count}
- Failed: ${report.fail_count}
- Buyer gate passed: ${report.buyer_gate_passed}

## Finding Counts

| Finding | Count |
| --- | ---: |
${Object.entries(report.finding_counts)
  .map(([key, value]) => `| ${key} | ${value} |`)
  .join('\n') || '| none | 0 |'}

## By Category

| Category | Tasks | Passed | Mean required rank | Required docs in top 10 |
| --- | ---: | ---: | ---: | ---: |
${Object.entries(report.by_category)
  .map(([category, row]) => `| ${category} | ${row.task_count} | ${row.pass_count} | ${row.mean_required_rank} | ${row.top10_required_docs} |`)
  .join('\n')}
`,
)

const candidate = readFileSync(candidateMarkdownPath, 'utf8')
const withoutOld = candidate.replace(/\n- Retrieval shortcut audit failed: .*?\n/g, '\n')
writeText(
  candidateMarkdownPath,
  withoutOld.replace(
    '## Checks',
    `- Retrieval shortcut audit failed: ${report.fail_count}/${report.task_count}\n\n## Checks`,
  ),
)

console.log(`Wrote ${outputPath}`)
console.log(`Updated ${auditPath}`)
console.log(`Wrote ${markdownPath}`)
