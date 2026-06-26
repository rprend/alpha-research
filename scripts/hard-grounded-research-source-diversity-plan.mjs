import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const planJsonPath = join(generatedDir, 'source-diversity-plan.json')
const planMarkdownPath = join(experimentDir, 'SOURCE_DIVERSITY_PLAN.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  scaledPublicSuite: join(generatedDir, 'public-package/hard-grounded-research-scaled-public-suite.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

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

function evidenceSourceRows(item) {
  return (item.source_examples || []).map((example) => ({
    source_dataset: example.source_dataset,
    source_row_id: example.source_row_id,
    source_key: `${example.source_dataset}:${example.source_row_id}`,
  }))
}

function buildCategorySummary({ spec, scaledItems, targetSourceRowsPerCategory, targetDatasetsPerCategory }) {
  return spec.categories.map((category) => {
    const items = scaledItems.filter((item) => item.category === category)
    const rowKeys = new Set()
    const datasets = new Set()
    for (const item of items) {
      for (const source of evidenceSourceRows(item)) {
        rowKeys.add(source.source_key)
        datasets.add(source.source_dataset)
      }
    }
    const specDatasets = spec.datasets
      .filter((dataset) => dataset.covers.includes(category))
      .map((dataset) => dataset.id)
    return {
      category,
      scaled_items: items.length,
      current_distinct_source_rows: rowKeys.size,
      target_distinct_source_rows: targetSourceRowsPerCategory,
      source_row_deficit: Math.max(0, targetSourceRowsPerCategory - rowKeys.size),
      current_source_datasets: [...datasets].sort(),
      candidate_source_datasets: specDatasets,
      current_dataset_count: datasets.size,
      target_dataset_count: Math.min(targetDatasetsPerCategory, Math.max(targetDatasetsPerCategory, specDatasets.length)),
      dataset_deficit: Math.max(0, Math.min(targetDatasetsPerCategory, Math.max(targetDatasetsPerCategory, specDatasets.length)) - datasets.size),
      recommended_action:
        rowKeys.size >= targetSourceRowsPerCategory
          ? 'source_row_target_met_pending_review'
          : `sample_${Math.max(0, targetSourceRowsPerCategory - rowKeys.size)}_additional_distinct_rows_before_final_category_claim`,
    }
  })
}

function buildPlan({ spec, corpusAudit, scaledPublicSuite, licenseClearance, powerPlan, releaseGate }) {
  const scaledItems = scaledPublicSuite.items || scaledPublicSuite
  const targetSourceRowsPerCategory = powerPlan.assumptions.target_reviewed_items_per_category
  const targetDatasetsPerCategory = 2
  const categorySummary = buildCategorySummary({
    spec,
    scaledItems,
    targetSourceRowsPerCategory,
    targetDatasetsPerCategory,
  })
  const totalSourceRowDeficit = categorySummary.reduce((sum, row) => sum + row.source_row_deficit, 0)
  const categoryTargetsMet = categorySummary.filter((row) => row.source_row_deficit === 0).length
  const datasetTargetsMet = categorySummary.filter((row) => row.dataset_deficit === 0).length
  const knownLicenseDatasets = spec.datasets.filter((dataset) => dataset.license && dataset.license !== 'unknown')
  const unknownLicenseDatasets = spec.datasets.filter((dataset) => !dataset.license || dataset.license === 'unknown')

  const acquisitionPolicy = [
    {
      id: 'prefer_known_license_sources',
      rule: 'Prefer additional rows from known-license Hugging Face datasets before using unknown-license sources.',
      current_evidence: `${knownLicenseDatasets.length}/${spec.datasets.length} current source datasets have known licenses.`,
    },
    {
      id: 'preserve_pointer_only_fallback',
      rule: 'If an unknown-license source is necessary for a construct, package only pointers, locators, hashes, and transforms until clearance is explicit.',
      current_evidence: `${licenseClearance.pointer_only_candidate_count} pointer-only candidates remain in the public package clearance view.`,
    },
    {
      id: 'avoid_seed_row_cloning',
      rule: 'Final category claims require distinct source rows, not multiple transformed copies of the same seed row.',
      current_evidence: `${corpusAudit.summary.scaled_public_items} scaled items currently derive from ${corpusAudit.summary.scaled_public_source_rows} source rows.`,
    },
  ]

  return {
    source_diversity_plan_ready:
      categorySummary.length === spec.categories.length &&
      totalSourceRowDeficit > 0 &&
      acquisitionPolicy.length >= 3 &&
      releaseGate.status !== 'release_ready',
    benchmark_id: spec.id,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      corpus_audit: 'generated/corpus-audit.json',
      scaled_public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
      license_clearance: 'generated/license-clearance.json',
      power_plan: 'generated/power-plan.json',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      categories: spec.categories.length,
      scaled_public_items: corpusAudit.summary.scaled_public_items,
      current_distinct_source_rows: corpusAudit.summary.scaled_public_source_rows,
      target_distinct_source_rows_per_category: targetSourceRowsPerCategory,
      target_distinct_source_rows_total: targetSourceRowsPerCategory * spec.categories.length,
      source_row_deficit_total: totalSourceRowDeficit,
      category_source_targets_met: categoryTargetsMet,
      dataset_targets_met: datasetTargetsMet,
      known_license_source_datasets: knownLicenseDatasets.length,
      unknown_license_source_datasets: unknownLicenseDatasets.length,
      completion_claim_allowed: false,
    },
    acquisition_policy: acquisitionPolicy,
    category_source_plan: categorySummary,
  }
}

function renderMarkdown(plan) {
  const policyRows = plan.acquisition_policy.map((entry) => [
    entry.id,
    entry.rule,
    entry.current_evidence,
  ])
  const categoryRows = plan.category_source_plan.map((entry) => [
    entry.category,
    String(entry.scaled_items),
    String(entry.current_distinct_source_rows),
    String(entry.target_distinct_source_rows),
    String(entry.source_row_deficit),
    entry.current_source_datasets.join('<br>') || 'none',
    entry.candidate_source_datasets.join('<br>') || 'none',
    entry.recommended_action,
  ])

  return `# Hard Grounded Research Source Diversity Plan

This generated plan turns the current corpus-audit limitation into a concrete expansion target. It is not a gold-data claim: it specifies how many additional distinct source rows are needed before the benchmark can support large-corpus category-level claims.

## Summary

- Source diversity plan ready: ${plan.source_diversity_plan_ready}
- Categories: ${plan.summary.categories}
- Scaled public items: ${plan.summary.scaled_public_items}
- Current distinct source rows: ${plan.summary.current_distinct_source_rows}
- Target distinct source rows/category: ${plan.summary.target_distinct_source_rows_per_category}
- Target distinct source rows total: ${plan.summary.target_distinct_source_rows_total}
- Source-row deficit total: ${plan.summary.source_row_deficit_total}
- Category source targets met: ${plan.summary.category_source_targets_met}/${plan.summary.categories}
- Dataset targets met: ${plan.summary.dataset_targets_met}/${plan.summary.categories}
- Known-license source datasets: ${plan.summary.known_license_source_datasets}
- Unknown-license source datasets: ${plan.summary.unknown_license_source_datasets}
- Completion claim allowed: ${plan.summary.completion_claim_allowed}

## Acquisition Policy

${markdownTable(['Policy', 'Rule', 'Current evidence'], policyRows)}

## Category Source Plan

${markdownTable(
  ['Category', 'Scaled items', 'Current rows', 'Target rows', 'Row deficit', 'Current datasets', 'Candidate datasets', 'Recommended action'],
  categoryRows,
)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source diversity plan input ${name}: ${path}`)
}

const plan = buildPlan({
  spec: readJson(inputs.spec),
  corpusAudit: readJson(inputs.corpusAudit),
  scaledPublicSuite: readJson(inputs.scaledPublicSuite),
  licenseClearance: readJson(inputs.licenseClearance),
  powerPlan: readJson(inputs.powerPlan),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))
console.log(`Wrote hard grounded research source diversity plan to ${planJsonPath}`)
console.log(`Wrote hard grounded research source diversity plan report to ${planMarkdownPath}`)
