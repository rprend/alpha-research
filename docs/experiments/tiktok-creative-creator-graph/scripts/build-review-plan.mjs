import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/tiktok-creative-creator-graph')
const processedDir = join(experimentDir, 'data/processed')
const reportsDir = join(experimentDir, 'reports')

const targetReviewDecisions = 500
const defaultReviewBatchSize = 250
const categoryMinimum = 25

function readJson(path, fallback = null) {
  if (!existsSync(path)) return fallback
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
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

function ceilDiv(a, b) {
  return Math.ceil(a / Math.max(1, b))
}

function main() {
  const reviewSample = readJsonl(join(processedDir, 'review_sample.jsonl'))
  const reviewDecisions = readJsonl(join(processedDir, 'review_decisions.jsonl'))
  const categoryCoverage = readJsonl(join(processedDir, 'category_coverage.jsonl'))
  const scalePlan = readJson(join(reportsDir, 'scale-plan.json'), {})
  const readiness = readJson(join(reportsDir, 'readiness.json'), {})

  const reviewedByLabel = reviewDecisions.reduce((acc, row) => {
    const sample = reviewSample.find((candidate) => candidate.creator_id === row.creator_id)
    const label = sample?.primary_label || 'unknown'
    acc[label] = (acc[label] ?? 0) + 1
    return acc
  }, {})

  const categoryRows = categoryCoverage.map((row) => {
    const sampled = reviewSample.filter((sample) => sample.primary_label === row.label).length
    const reviewed = reviewedByLabel[row.label] ?? 0
    return {
      label: row.label,
      target_review_decisions: categoryMinimum,
      reviewed_decisions: reviewed,
      current_sample_rows: sampled,
      review_gap: Math.max(0, categoryMinimum - reviewed),
      useful_gap: row.useful_gap,
      priority: Number(row.recommended_priority) || 3,
    }
  }).sort((a, b) => a.priority - b.priority || b.review_gap - a.review_gap || b.useful_gap - a.useful_gap)

  const currentReviews = reviewDecisions.length
  const reviewGap = Math.max(0, targetReviewDecisions - currentReviews)
  const reviewBatchesNeeded = ceilDiv(reviewGap, defaultReviewBatchSize)
  const nextBatches = Array.from({ length: Math.max(1, reviewBatchesNeeded) }).map((_, index) => ({
    sequence: index + 1,
    batch_id: `review_batch_${String(index + 1).padStart(4, '0')}`,
    target_rows: index === reviewBatchesNeeded - 1 && reviewGap % defaultReviewBatchSize
      ? reviewGap % defaultReviewBatchSize
      : Math.min(defaultReviewBatchSize, reviewGap || defaultReviewBatchSize),
    sample_source: 'data/processed/review_sample.csv',
    focus: index === 0 ? 'current high-priority sample and uncovered categories' : 'next acquisition wave sample',
  }))

  const summary = {
    generated_at: new Date().toISOString(),
    target_review_decisions: targetReviewDecisions,
    current_review_decisions: currentReviews,
    review_gap: reviewGap,
    review_batch_size: defaultReviewBatchSize,
    review_batches_needed: reviewBatchesNeeded,
    current_sample_rows: reviewSample.length,
    scale_plan_review_batches_needed: scalePlan?.estimated_work?.review_batches_needed ?? null,
    readiness_review_gap: readiness?.remaining?.reviewed_accounts ?? reviewGap,
    category_minimum: categoryMinimum,
    category_rows: categoryRows,
    next_batches: nextBatches,
  }

  writeJson(join(reportsDir, 'review-plan.json'), summary)
  writeJsonl(join(processedDir, 'review_plan_categories.jsonl'), categoryRows)
  writeCsv(join(processedDir, 'review_plan_categories.csv'), categoryRows)
  writeFileSync(join(reportsDir, 'review-plan.md'), `# Review Plan

Generated: ${summary.generated_at}

- Target review decisions: ${summary.target_review_decisions}
- Current review decisions: ${summary.current_review_decisions}
- Review gap: ${summary.review_gap}
- Review batch size: ${summary.review_batch_size}
- Review batches needed: ${summary.review_batches_needed}
- Current sample rows: ${summary.current_sample_rows}

## Next Batches

| Seq | Batch | Target rows | Focus |
| ---: | --- | ---: | --- |
${nextBatches.map((row) => `| ${row.sequence} | ${row.batch_id} | ${row.target_rows} | ${row.focus} |`).join('\n')}

## Category Review Gaps

| Label | Target reviews | Reviewed | Current sample | Gap | Useful gap | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
${categoryRows.map((row) => `| ${row.label} | ${row.target_review_decisions} | ${row.reviewed_decisions} | ${row.current_sample_rows} | ${row.review_gap} | ${row.useful_gap} | ${row.priority} |`).join('\n')}
`)

  console.log(JSON.stringify(summary, null, 2))
}

main()
