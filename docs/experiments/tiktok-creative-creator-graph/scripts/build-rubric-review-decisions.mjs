import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const rawReviewDir = join(experimentDir, 'data/raw/review-decisions')
const reportsDir = join(experimentDir, 'reports')

const args = new Map(process.argv.slice(2).map((arg) => {
  const [key, ...rest] = arg.split('=')
  return [key, rest.length ? rest.join('=') : true]
}))

const maxDecisions = Number(args.get('--max-decisions') ?? 500)
const reviewer = String(args.get('--reviewer') ?? 'rubric_bootstrap')
const executionId = new Date().toISOString().replace(/[:.]/g, '-')

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

function decisionFor(row) {
  if (row.primary_label === 'reject' || Number(row.repost_risk ?? 0) >= 70) return 'repost_or_aggregator'
  if (row.status === 'excellent' && Number(row.overall_usefulness ?? 0) >= 90) return 'excellent_benchmark'
  if (['excellent', 'useful'].includes(row.status) && Number(row.overall_usefulness ?? 0) >= 66) return 'keep'
  return 'maybe'
}

function notesFor(row, decision) {
  if (decision === 'excellent_benchmark') return `Rubric bootstrap: excellent ${row.primary_label} candidate with usefulness ${row.overall_usefulness}.`
  if (decision === 'keep') return `Rubric bootstrap: useful ${row.primary_label} candidate with usefulness ${row.overall_usefulness}.`
  if (decision === 'repost_or_aggregator') return `Rubric bootstrap: rejected by label/risk signals; repost risk ${row.repost_risk ?? 0}.`
  return `Rubric bootstrap: retained as maybe for later manual review; usefulness ${row.overall_usefulness}.`
}

function main() {
  ensureDir(rawReviewDir)
  ensureDir(reportsDir)

  const reviewQueue = readJsonl(join(processedDir, 'review_queue.jsonl'))
  const existingDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const alreadyReviewed = new Set(existingDecisions.map((row) => row.handle))

  const decisions = []
  for (const row of reviewQueue) {
    if (decisions.length >= maxDecisions) break
    if (!row.handle || alreadyReviewed.has(row.handle)) continue
    const decision = decisionFor(row)
    decisions.push({
      handle: row.handle,
      decision,
      reviewer,
      notes: notesFor(row, decision),
      packet_id: `rubric_bootstrap_${executionId}`,
      review_row_id: row.creator_id,
      reviewed_at: new Date().toISOString(),
    })
  }

  const outputPath = join(rawReviewDir, `${executionId}-rubric-bootstrap-review-decisions.jsonl`)
  writeJsonl(outputPath, decisions)

  const summary = {
    generated_at: new Date().toISOString(),
    execution_id: executionId,
    reviewer,
    output_path: outputPath.replace(`${root}/`, ''),
    requested_decisions: maxDecisions,
    output_rows: decisions.length,
    decision_counts: decisions.reduce((acc, row) => {
      acc[row.decision] = (acc[row.decision] ?? 0) + 1
      return acc
    }, {}),
    first_rows: decisions.slice(0, 25),
  }

  writeJson(join(reportsDir, 'rubric-review-decisions.json'), summary)
  writeFileSync(join(reportsDir, 'rubric-review-decisions.md'), `# Rubric Review Decisions

Generated: ${summary.generated_at}

- Reviewer: ${summary.reviewer}
- Output rows: ${summary.output_rows}
- Output path: ${summary.output_path}

## Decision Counts

${Object.entries(summary.decision_counts).map(([decision, count]) => `- ${decision}: ${count}`).join('\n') || '- None'}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
