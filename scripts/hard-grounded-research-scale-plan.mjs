import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
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

function datasetMap(spec) {
  return new Map(spec.datasets.map((dataset) => [dataset.id, dataset]))
}

function seedTaskMap(spec) {
  return new Map(spec.seed_tasks.map((task) => [task.category, task]))
}

function expansionStrategy(category, task, datasetsById) {
  const datasetRoles = (task?.dataset_ids || []).map((datasetId) => datasetsById.get(datasetId)?.construction_role || datasetId)
  const approaches = {
    'multi-hop synthesis': 'Sample additional bridge/comparison rows; preserve all required supporting facts; add distractor passages that support only one hop.',
    'stale-vs-current document conflicts': 'Pair older claim/evidence rows with newer controlling evidence; assign synthetic document dates and require stale-evidence rejection.',
    'appended document lifecycle changes': 'Select long-document QA rows and generate appendix/erratum wrappers that supersede one body claim while retaining original evidence.',
    'table + text reasoning': 'Pair table denotation questions with supporting or disambiguating text snippets; require both table cell grounding and textual context.',
    'source authority conflicts': 'Compose lower-authority explanatory/claim evidence with higher-authority source evidence; encode which source controls the answer.',
    'evidence insufficiency / abstention': 'Remove required evidence from otherwise relevant contexts and retain near-miss passages that should not justify an answer.',
    'citation supports fact but not conclusion': 'Keep citations that support true subfacts while withholding the link needed for the requested conclusion.',
    'entity disambiguation': 'Sample same-name or near-name entities across evidence sets; require citations that identify the intended referent.',
    'temporal questions: as of date X': 'Wrap evidence with as-of dates and conflicting later/earlier snapshots; require answers scoped to the requested date.',
    'cross-document contradiction': 'Compose mutually inconsistent evidence sets and require explicit conflict reporting unless an authority/date rule controls.',
  }

  return {
    seed_task_id: task?.id || null,
    source_datasets: task?.dataset_ids || [],
    dataset_roles: datasetRoles,
    generation_strategy: approaches[category] || 'Expand using the category seed task and preserve explicit evidence ids.',
    review_requirement: 'Two independent reviews plus adjudication for disagreements before gold promotion.',
  }
}

function buildPlan(spec, pilotSuite, goldSummary) {
  const datasetsById = datasetMap(spec)
  const tasksByCategory = seedTaskMap(spec)
  const counts = categoryCounts(pilotSuite)
  const categories = spec.categories.map((category) => {
    const currentPilotItems = counts.get(category)
    const currentReviewedItems = 0
    const task = tasksByCategory.get(category)
    return {
      category,
      target_reviewed_items: targetReviewedItemsPerCategory,
      current_pilot_items: currentPilotItems || 0,
      current_valid_reviewed_items: currentReviewedItems,
      additional_pilot_items_needed: Math.max(0, targetReviewedItemsPerCategory - (currentPilotItems || 0)),
      additional_reviewed_items_needed: Math.max(0, targetReviewedItemsPerCategory - currentReviewedItems),
      scale_ready: currentReviewedItems >= targetReviewedItemsPerCategory,
      expansion: expansionStrategy(category, task, datasetsById),
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
  const expansionRows = plan.categories.map((category) => [
    category.category,
    category.expansion.source_datasets.join('<br>'),
    category.expansion.generation_strategy,
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

## Expansion Blueprint

${markdownTable(['Category', 'Source datasets', 'Generation strategy'], expansionRows)}
`
}

const plan = buildPlan(readJson(specPath), readJson(pilotSuitePath), readJson(goldSummaryPath))
writeJson(scalePlanJsonPath, plan)
writeText(scalePlanMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded scale plan to ${scalePlanJsonPath}`)
console.log(`Wrote hard grounded scale report to ${scalePlanMarkdownPath}`)
