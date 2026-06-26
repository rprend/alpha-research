import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const goldSummaryPath = join(generatedDir, 'gold-suite-summary.json')
const scalePlanJsonPath = join(generatedDir, 'scale-plan.json')
const scalePlanMarkdownPath = join(experimentDir, 'SCALE_PLAN.md')

const targetReviewedItemsPerCategory = 30

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

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function categoryCounts(pilotSuite) {
  const counts = new Map()
  for (const item of pilotSuite.items) {
    counts.set(item.category, (counts.get(item.category) || 0) + 1)
  }
  return counts
}

function buildPlan(pilotSuite, goldSummary) {
  const counts = categoryCounts(pilotSuite)
  const categories = [...counts.keys()].map((category) => {
    const currentPilotItems = counts.get(category)
    const currentReviewedItems = 0
    return {
      category,
      target_reviewed_items: targetReviewedItemsPerCategory,
      current_pilot_items: currentPilotItems,
      current_valid_reviewed_items: currentReviewedItems,
      additional_pilot_items_needed: Math.max(0, targetReviewedItemsPerCategory - currentPilotItems),
      additional_reviewed_items_needed: Math.max(0, targetReviewedItemsPerCategory - currentReviewedItems),
      scale_ready: currentReviewedItems >= targetReviewedItemsPerCategory,
    }
  })

  const totalTargetReviewedItems = categories.length * targetReviewedItemsPerCategory
  const currentPilotItems = categories.reduce((sum, category) => sum + category.current_pilot_items, 0)
  const currentValidReviewedItems = goldSummary.valid_reviewed_items || 0

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    target_reviewed_items_per_category: targetReviewedItemsPerCategory,
    category_count: categories.length,
    total_target_reviewed_items: totalTargetReviewedItems,
    current_pilot_items: currentPilotItems,
    current_valid_reviewed_items: currentValidReviewedItems,
    additional_pilot_items_needed: Math.max(0, totalTargetReviewedItems - currentPilotItems),
    additional_reviewed_items_needed: Math.max(0, totalTargetReviewedItems - currentValidReviewedItems),
    scale_ready: categories.every((category) => category.scale_ready),
    categories,
  }
}

function renderMarkdown(plan) {
  const rows = plan.categories.map((category) => [
    category.category,
    String(category.target_reviewed_items),
    String(category.current_pilot_items),
    String(category.current_valid_reviewed_items),
    String(category.additional_pilot_items_needed),
    String(category.additional_reviewed_items_needed),
    category.scale_ready ? 'yes' : 'no',
  ])

  return `# Hard Grounded Research Scale Plan

This generated plan tracks the gap between the current pilot suite and a paper-grade benchmark scale. It intentionally uses reviewed item targets rather than raw generated examples.

## Summary

- Target reviewed items per category: ${plan.target_reviewed_items_per_category}
- Categories: ${plan.category_count}
- Total target reviewed items: ${plan.total_target_reviewed_items}
- Current pilot items: ${plan.current_pilot_items}
- Current valid reviewed items: ${plan.current_valid_reviewed_items}
- Additional pilot items needed: ${plan.additional_pilot_items_needed}
- Additional reviewed items needed: ${plan.additional_reviewed_items_needed}
- Scale ready: ${plan.scale_ready}

## Category Targets

${markdownTable(
  ['Category', 'Target reviewed', 'Pilot items', 'Valid reviewed', 'Pilot gap', 'Reviewed gap', 'Ready'],
  rows,
)}
`
}

const plan = buildPlan(readJson(pilotSuitePath), readJson(goldSummaryPath))
writeJson(scalePlanJsonPath, plan)
writeText(scalePlanMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded scale plan to ${scalePlanJsonPath}`)
console.log(`Wrote hard grounded scale report to ${scalePlanMarkdownPath}`)
