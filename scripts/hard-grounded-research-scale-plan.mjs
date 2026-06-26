import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const goldSummaryPath = join(generatedDir, 'gold-suite-summary.json')
const derivedScaleSuitePath = join(generatedDir, 'derived-scale-suite.json')
const scalePlanJsonPath = join(generatedDir, 'scale-plan.json')
const scalePlanMarkdownPath = join(experimentDir, 'SCALE_PLAN.md')

const targetReviewedItemsPerCategory = 30
const targetNewItemsPerBatch = 9

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

function buildExpansionBatches(categories) {
  const batches = []
  let batchNumber = 1

  for (const category of categories) {
    let remainingItems = category.additional_pilot_items_needed
    while (remainingItems > 0) {
      const targetNewItems = Math.min(targetNewItemsPerBatch, remainingItems)
      batches.push({
        batch_id: `hgr_scale_batch_${String(batchNumber).padStart(2, '0')}`,
        category: category.category,
        seed_task_id: category.expansion.seed_task_id,
        target_new_items: targetNewItems,
        review_rows_required: targetNewItems * 2,
        source_datasets: category.expansion.source_datasets,
        generation_strategy: category.expansion.generation_strategy,
        review_requirement: category.expansion.review_requirement,
        adjudication_policy: 'Promote only examples with two agreeing reviews or a resolved adjudication note.',
        status: 'planned_not_generated',
      })
      remainingItems -= targetNewItems
      batchNumber += 1
    }
  }

  return batches
}

function buildPlan(spec, pilotSuite, goldSummary) {
  const datasetsById = datasetMap(spec)
  const tasksByCategory = seedTaskMap(spec)
  const counts = categoryCounts(pilotSuite)
  const derivedScaleSuite = readJson(derivedScaleSuitePath)
  const categories = spec.categories.map((category) => {
    const currentPilotItems = counts.get(category)
    const currentReviewedItems = 0
    const derivedCategory = derivedScaleSuite.by_category?.[category] || {}
    const currentDerivedItems = derivedCategory.paper_eligible_items || 0
    const task = tasksByCategory.get(category)
    return {
      category,
      target_reviewed_items: targetReviewedItemsPerCategory,
      target_hf_derived_items: targetReviewedItemsPerCategory,
      current_pilot_items: currentPilotItems || 0,
      current_valid_reviewed_items: currentReviewedItems,
      current_hf_derived_items: currentDerivedItems,
      additional_pilot_items_needed: Math.max(0, targetReviewedItemsPerCategory - (currentPilotItems || 0)),
      additional_reviewed_items_needed: Math.max(0, targetReviewedItemsPerCategory - currentReviewedItems),
      additional_hf_derived_items_needed: Math.max(0, targetReviewedItemsPerCategory - currentDerivedItems),
      scale_ready: currentDerivedItems >= targetReviewedItemsPerCategory,
      expansion: expansionStrategy(category, task, datasetsById),
    }
  })

  const totalTargetReviewedItems = categories.length * targetReviewedItemsPerCategory
  const currentPilotItems = categories.reduce((sum, category) => sum + category.current_pilot_items, 0)
  const currentValidReviewedItems = goldSummary.valid_reviewed_items || 0
  const currentHfDerivedItems = categories.reduce((sum, category) => sum + category.current_hf_derived_items, 0)
  const expansionBatches = buildExpansionBatches(categories)

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    target_reviewed_items_per_category: targetReviewedItemsPerCategory,
    target_hf_derived_items_per_category: targetReviewedItemsPerCategory,
    category_count: categories.length,
    total_target_reviewed_items: totalTargetReviewedItems,
    total_target_hf_derived_items: totalTargetReviewedItems,
    current_pilot_items: currentPilotItems,
    current_valid_reviewed_items: currentValidReviewedItems,
    current_hf_derived_items: currentHfDerivedItems,
    additional_pilot_items_needed: Math.max(0, totalTargetReviewedItems - currentPilotItems),
    additional_reviewed_items_needed: Math.max(0, totalTargetReviewedItems - currentValidReviewedItems),
    additional_hf_derived_items_needed: Math.max(0, totalTargetReviewedItems - currentHfDerivedItems),
    expansion_batch_size: targetNewItemsPerBatch,
    expansion_batch_count: expansionBatches.length,
    planned_new_items: expansionBatches.reduce((sum, batch) => sum + batch.target_new_items, 0),
    planned_review_rows: expansionBatches.reduce((sum, batch) => sum + batch.review_rows_required, 0),
    expansion_batches: expansionBatches,
    scale_ready: categories.every((category) => category.scale_ready),
    primary_label_source: 'HF-derived label suite; human review is optional audit only',
    derived_scale_suite: 'generated/derived-scale-suite.json',
    categories,
  }
}

function renderMarkdown(plan) {
  const rows = plan.categories.map((category) => [
    category.category,
    String(category.target_hf_derived_items),
    String(category.current_pilot_items),
    String(category.current_hf_derived_items),
    String(category.additional_pilot_items_needed),
    String(category.additional_hf_derived_items_needed),
    category.scale_ready ? 'yes' : 'no',
  ])
  const expansionRows = plan.categories.map((category) => [
    category.category,
    category.expansion.source_datasets.join('<br>'),
    category.expansion.generation_strategy,
  ])
  const batchRows = plan.expansion_batches.map((batch) => [
    batch.batch_id,
    batch.category,
    String(batch.target_new_items),
    String(batch.review_rows_required),
    batch.status,
  ])

  return `# Hard Grounded Research Scale Plan

This generated plan tracks the gap between the current pilot suite and a paper-grade benchmark scale. It intentionally uses reviewed item targets rather than raw generated examples.

## Summary

- Target reviewed items per category: ${plan.target_reviewed_items_per_category}
- Categories: ${plan.category_count}
- Total target reviewed items: ${plan.total_target_reviewed_items}
- Total target HF-derived items: ${plan.total_target_hf_derived_items}
- Current pilot items: ${plan.current_pilot_items}
- Current valid reviewed items: ${plan.current_valid_reviewed_items}
- Current HF-derived paper-eligible items: ${plan.current_hf_derived_items}
- Additional pilot items needed: ${plan.additional_pilot_items_needed}
- Additional reviewed items needed: ${plan.additional_reviewed_items_needed}
- Additional HF-derived items needed: ${plan.additional_hf_derived_items_needed}
- Expansion batch size: ${plan.expansion_batch_size}
- Expansion batches: ${plan.expansion_batch_count}
- Planned new items: ${plan.planned_new_items}
- Planned review rows: ${plan.planned_review_rows}
- Scale ready: ${plan.scale_ready}
- Primary label source: ${plan.primary_label_source}

## Category Targets

${markdownTable(
  ['Category', 'Target derived', 'Pilot items', 'HF-derived', 'Pilot gap', 'Derived gap', 'Ready'],
  rows,
)}

## Expansion Blueprint

${markdownTable(['Category', 'Source datasets', 'Generation strategy'], expansionRows)}

## Expansion Batches

${markdownTable(['Batch', 'Category', 'Target new items', 'Review rows required', 'Status'], batchRows)}
`
}

const plan = buildPlan(readJson(specPath), readJson(pilotSuitePath), readJson(goldSummaryPath))
writeJson(scalePlanJsonPath, plan)
writeText(scalePlanMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded scale plan to ${scalePlanJsonPath}`)
console.log(`Wrote hard grounded scale report to ${scalePlanMarkdownPath}`)
