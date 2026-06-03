import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { readJsonl, taskPath, valueForArg, writeJson, writeJsonl } from './gutenberg-pipeline-lib.mjs'

const runDir = valueForArg('--run-dir')
if (!runDir) throw new Error('Usage: --run-dir=PATH')

const candidates = new Map(readJsonl(join(runDir, 'candidate_pool.jsonl')).map((row) => [row.candidate_id, row]))
const labels = readJsonl(join(runDir, 'llm_labels.jsonl'))
const verifications = new Map(readJsonl(join(runDir, 'llm_verifications.jsonl')).map((row) => [row.candidate_id, row]))
const tasks = readJsonl(taskPath)

const finalRows = labels.map((label) => {
  const verification = verifications.get(label.candidate_id)
  const candidate = candidates.get(label.candidate_id)
  const finalLabel = verification?.corrected_label ?? label.label
  const adjudication = verification?.verdict === 'needs_human_review' || ['positive', 'ambiguous'].includes(finalLabel)
    ? 'needs_human_review'
    : 'machine_screened'
  return {
    ...label,
    final_label: finalLabel,
    adjudication,
    verification: verification ?? null,
    title: candidate?.title,
    author: candidate?.author,
    source_url: candidate?.source_url,
    discovery_path: candidate?.discovery_path,
    quote: candidate?.quote,
  }
})

const reviewRows = finalRows
  .filter((row) => row.adjudication === 'needs_human_review')
  .sort((a, b) => (a.final_label === 'positive' ? -1 : 1) - (b.final_label === 'positive' ? -1 : 1))

const nextTerms = {}
for (const row of finalRows.filter((item) => ['positive', 'ambiguous'].includes(item.final_label))) {
  const terms = new Set([...(row.suggested_query_terms ?? []), row.author, row.title].filter(Boolean).map((term) => String(term).toLowerCase()))
  nextTerms[row.task_id] ??= new Set()
  for (const term of terms) nextTerms[row.task_id].add(term)
}

const summary = {
  run_dir: runDir,
  synthesized_at: new Date().toISOString(),
  candidate_count: candidates.size,
  labeled_count: labels.length,
  verified_count: verifications.size,
  final_label_counts: finalRows.reduce((acc, row) => {
    acc[row.final_label] = (acc[row.final_label] ?? 0) + 1
    return acc
  }, {}),
  human_review_count: reviewRows.length,
  by_task: Object.fromEntries(
    tasks.map((task) => [
      task.id,
      {
        query: task.query,
        candidates: [...candidates.values()].filter((row) => row.task_id === task.id).length,
        labels: finalRows.filter((row) => row.task_id === task.id).length,
        review: reviewRows.filter((row) => row.task_id === task.id).length,
      },
    ]),
  ),
}

writeJsonl(join(runDir, 'final_candidate_labels.jsonl'), finalRows)
writeJson(join(runDir, 'next_query_variants.json'), Object.fromEntries(Object.entries(nextTerms).map(([taskId, terms]) => [taskId, [...terms].slice(0, 100)])))
writeJson(join(runDir, 'high_recall_summary.json'), summary)

const markdown = [
  '# High-Recall Human Review Queue',
  '',
  `Run: \`${runDir}\``,
  '',
  `Candidates: ${summary.candidate_count}`,
  `Labels: ${summary.labeled_count}`,
  `Verifications: ${summary.verified_count}`,
  `Needs human review: ${summary.human_review_count}`,
  '',
  ...reviewRows.slice(0, 100).flatMap((row, index) => [
    `## ${index + 1}. ${row.task_id} / ${row.final_label}`,
    '',
    `- Work: ${row.title ?? 'unknown'} by ${row.author ?? 'unknown'}`,
    `- Discovery: ${row.discovery_path ?? 'unknown'}`,
    `- Candidate: ${row.candidate_id}`,
    `- Rationale: ${row.rationale}`,
    '',
    '> ' + String(row.quote ?? row.evidence_quote ?? '').replace(/\s+/g, ' ').slice(0, 900),
    '',
  ]),
]
writeFileSync(join(runDir, 'human_review_queue.md'), `${markdown.join('\n')}\n`)

console.log(`Wrote high-recall synthesis to ${join(runDir, 'high_recall_summary.json')}`)
