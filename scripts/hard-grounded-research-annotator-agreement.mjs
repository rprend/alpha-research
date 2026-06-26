import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'annotator-agreement.json')
const reportMarkdownPath = join(experimentDir, 'ANNOTATOR_AGREEMENT.md')

const inputs = {
  pilotIndex: join(generatedDir, 'review-workbooks/index.json'),
  expansionIndex: join(generatedDir, 'expansion-review-workbooks/index.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line, index) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        throw new Error(`Invalid JSONL at ${path}:${index + 1}: ${error.message}`)
      }
    })
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function reviewerFields(row) {
  return row.reviewer_fields || {}
}

function isFilled(value) {
  return String(value || '').trim().length > 0
}

function loadWorkbookRows(indexPath) {
  const index = readJson(indexPath)
  const rows = index.workbooks.flatMap((workbook) => {
    const path = join(experimentDir, workbook.path)
    if (!existsSync(path)) throw new Error(`Missing workbook: ${path}`)
    return readJsonl(path).map((row) => ({
      ...row,
      workbook_id: workbook.workbook_id,
      reviewer_slot: workbook.reviewer_slot,
      category: workbook.category,
    }))
  })
  return { index, rows }
}

function completedPairs(rows, field) {
  const byItem = new Map()
  for (const row of rows) {
    if (!byItem.has(row.item_id)) byItem.set(row.item_id, [])
    byItem.get(row.item_id).push(row)
  }

  return [...byItem.entries()]
    .map(([itemId, itemRows]) => {
      const reviewerA = itemRows.find((row) => row.reviewer_slot === 'reviewer_a')
      const reviewerB = itemRows.find((row) => row.reviewer_slot === 'reviewer_b')
      const left = reviewerA ? reviewerFields(reviewerA)[field] : ''
      const right = reviewerB ? reviewerFields(reviewerB)[field] : ''
      return {
        item_id: itemId,
        category: itemRows[0]?.category || '',
        reviewer_a: left || '',
        reviewer_b: right || '',
        pair_complete: isFilled(left) && isFilled(right),
      }
    })
    .filter((pair) => pair.pair_complete)
}

function roundMetric(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return null
  return Number(value.toFixed(4))
}

function cohenKappa(pairs) {
  if (pairs.length === 0) return null
  const labels = [...new Set(pairs.flatMap((pair) => [pair.reviewer_a, pair.reviewer_b]))]
  const observedAgreement = pairs.filter((pair) => pair.reviewer_a === pair.reviewer_b).length / pairs.length
  const expectedAgreement = labels.reduce((sum, label) => {
    const leftRate = pairs.filter((pair) => pair.reviewer_a === label).length / pairs.length
    const rightRate = pairs.filter((pair) => pair.reviewer_b === label).length / pairs.length
    return sum + leftRate * rightRate
  }, 0)
  if (expectedAgreement === 1) return observedAgreement === 1 ? 1 : null
  return roundMetric((observedAgreement - expectedAgreement) / (1 - expectedAgreement))
}

function fieldAgreement(rows, field) {
  const pairs = completedPairs(rows, field)
  const agreements = pairs.filter((pair) => pair.reviewer_a === pair.reviewer_b)
  return {
    field,
    completed_pairs: pairs.length,
    exact_agreement_items: agreements.length,
    exact_agreement_rate: pairs.length ? roundMetric(agreements.length / pairs.length) : null,
    cohen_kappa: cohenKappa(pairs),
  }
}

function categoryAgreement(rows, field) {
  const pairs = completedPairs(rows, field)
  const categories = [...new Set(rows.map((row) => row.category))].sort()
  return categories.map((category) => {
    const categoryPairs = pairs.filter((pair) => pair.category === category)
    const agreements = categoryPairs.filter((pair) => pair.reviewer_a === pair.reviewer_b)
    return {
      category,
      field,
      completed_pairs: categoryPairs.length,
      exact_agreement_items: agreements.length,
      exact_agreement_rate: categoryPairs.length ? roundMetric(agreements.length / categoryPairs.length) : null,
      cohen_kappa: cohenKappa(categoryPairs),
    }
  })
}

function trackAgreement({ track, index, rows, fields }) {
  return {
    track,
    source_index: track === 'pilot_gold' ? 'generated/review-workbooks/index.json' : 'generated/expansion-review-workbooks/index.json',
    workbook_count: index.workbook_count,
    review_rows: rows.length,
    unique_items: new Set(rows.map((row) => row.item_id)).size,
    metrics: fields.map((field) => fieldAgreement(rows, field)),
    by_category: fields.flatMap((field) => categoryAgreement(rows, field)),
  }
}

function buildReport() {
  const pilot = loadWorkbookRows(inputs.pilotIndex)
  const expansion = loadWorkbookRows(inputs.expansionIndex)
  const tracks = [
    trackAgreement({
      track: 'pilot_gold',
      index: pilot.index,
      rows: pilot.rows,
      fields: ['final_label'],
    }),
    trackAgreement({
      track: 'scaled_expansion',
      index: expansion.index,
      rows: expansion.rows,
      fields: ['final_label', 'category_fit', 'generation_defect'],
    }),
  ]
  const completedPairs = tracks.reduce(
    (sum, track) => sum + track.metrics.reduce((metricSum, metric) => metricSum + metric.completed_pairs, 0),
    0,
  )

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    annotator_agreement_ready: true,
    generated_from: {
      pilot_review_workbooks: 'generated/review-workbooks/index.json',
      expansion_review_workbooks: 'generated/expansion-review-workbooks/index.json',
    },
    summary: {
      completed_metric_pairs: completedPairs,
      agreement_claim_allowed: completedPairs > 0,
      note: completedPairs > 0
        ? 'Agreement metrics are computed from completed reviewer pairs.'
        : 'No reviewer pairs are complete yet; agreement claims remain unavailable.',
    },
    tracks,
  }
}

function renderMarkdown(report) {
  const metricRows = report.tracks.flatMap((track) =>
    track.metrics.map((metric) => [
      track.track,
      metric.field,
      String(metric.completed_pairs),
      String(metric.exact_agreement_items),
      metric.exact_agreement_rate === null ? 'n/a' : String(metric.exact_agreement_rate),
      metric.cohen_kappa === null ? 'n/a' : String(metric.cohen_kappa),
    ]),
  )
  const categoryRows = report.tracks.flatMap((track) =>
    track.by_category.map((row) => [
      track.track,
      row.category,
      row.field,
      String(row.completed_pairs),
      row.exact_agreement_rate === null ? 'n/a' : String(row.exact_agreement_rate),
      row.cohen_kappa === null ? 'n/a' : String(row.cohen_kappa),
    ]),
  )

  return `# Hard Grounded Research Annotator Agreement

This generated report is the reliability measurement hook for the benchmark paper. It computes exact agreement and Cohen's kappa from completed reviewer pairs, and it explicitly withholds agreement claims while reviewer workbooks are blank.

## Summary

- Annotator agreement report ready: ${report.annotator_agreement_ready}
- Completed metric pairs: ${report.summary.completed_metric_pairs}
- Agreement claim allowed: ${report.summary.agreement_claim_allowed}
- Note: ${report.summary.note}

## Track Metrics

${markdownTable(['Track', 'Field', 'Completed pairs', 'Exact agreements', 'Exact agreement rate', "Cohen's kappa"], metricRows)}

## Category Metrics

${markdownTable(['Track', 'Category', 'Field', 'Completed pairs', 'Exact agreement rate', "Cohen's kappa"], categoryRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing annotator agreement input ${name}: ${path}`)
}

const report = buildReport()
writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))
console.log(`Wrote hard grounded annotator agreement to ${reportJsonPath}`)
console.log(`Wrote hard grounded annotator agreement report to ${reportMarkdownPath}`)
