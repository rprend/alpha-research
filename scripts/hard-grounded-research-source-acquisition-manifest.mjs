import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const manifestJsonPath = join(generatedDir, 'source-acquisition-manifest.json')
const manifestMarkdownPath = join(experimentDir, 'SOURCE_ACQUISITION_MANIFEST.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
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

function datasetPriority(dataset) {
  return dataset.license && dataset.license !== 'unknown' ? 0 : 1
}

function datasetCapacity(dataset) {
  return Number.isFinite(dataset.acquisition_capacity_new_rows) ? dataset.acquisition_capacity_new_rows : Number.POSITIVE_INFINITY
}

function splitDeficit(deficit, datasets, remainingCapacity) {
  if (!datasets.length || deficit <= 0) return []
  const allocations = new Map()
  let remaining = deficit
  while (remaining > 0) {
    const eligible = datasets.filter((dataset) => (remainingCapacity.get(dataset.id) ?? datasetCapacity(dataset)) > 0)
    if (!eligible.length) break
    for (const dataset of eligible) {
      if (remaining <= 0) break
      allocations.set(dataset.id, (allocations.get(dataset.id) || 0) + 1)
      remainingCapacity.set(dataset.id, (remainingCapacity.get(dataset.id) ?? datasetCapacity(dataset)) - 1)
      remaining -= 1
    }
  }
  return datasets
    .map((dataset) => ({ dataset, target: allocations.get(dataset.id) || 0 }))
    .filter((entry) => entry.target > 0)
}

function buildManifest({ spec, sourceDiversityPlan, licenseClearance, releaseGate }) {
  const datasetById = new Map(spec.datasets.map((dataset) => [dataset.id, dataset]))
  const remainingCapacity = new Map(spec.datasets.map((dataset) => [dataset.id, datasetCapacity(dataset)]))
  const acquisitionBatches = []

  for (const categoryPlan of sourceDiversityPlan.category_source_plan) {
    const candidateDatasets = categoryPlan.candidate_source_datasets
      .map((id) => datasetById.get(id))
      .filter(Boolean)
      .sort((left, right) => datasetPriority(left) - datasetPriority(right) || left.id.localeCompare(right.id))
    const preferredDatasets = candidateDatasets.filter((dataset) => datasetPriority(dataset) === 0)
    const fallbackDatasets = candidateDatasets.filter((dataset) => datasetPriority(dataset) !== 0)
    const allocationDatasets = preferredDatasets.length ? preferredDatasets : fallbackDatasets

    for (const allocation of splitDeficit(categoryPlan.source_row_deficit, allocationDatasets, remainingCapacity)) {
      const dataset = allocation.dataset
      acquisitionBatches.push({
        batch_id: `source_acq_${String(acquisitionBatches.length + 1).padStart(3, '0')}`,
        category: categoryPlan.category,
        source_dataset: dataset.id,
        hf_url: dataset.url,
        viewer: dataset.viewer,
        license: dataset.license || 'unknown',
        package_policy:
          dataset.license && dataset.license !== 'unknown'
            ? 'redistributable_known_license_evidence'
            : 'pointer_only_until_license_clearance',
        target_new_distinct_source_rows: allocation.target,
        current_category_source_rows: categoryPlan.current_distinct_source_rows,
        category_target_source_rows: categoryPlan.target_distinct_source_rows,
        native_signals: dataset.native_signals || [],
        availability_note: dataset.availability_note || '',
        acquisition_capacity_new_rows: dataset.acquisition_capacity_new_rows ?? null,
        construction_role: dataset.construction_role,
        review_status: 'source_acquisition_needed_before_paper_claim',
      })
    }
  }

  const targetRows = acquisitionBatches.reduce((sum, batch) => sum + batch.target_new_distinct_source_rows, 0)
  const pointerOnlyTargetRows = acquisitionBatches
    .filter((batch) => batch.package_policy === 'pointer_only_until_license_clearance')
    .reduce((sum, batch) => sum + batch.target_new_distinct_source_rows, 0)
  const knownLicenseTargetRows = targetRows - pointerOnlyTargetRows
  const categoriesCovered = new Set(acquisitionBatches.map((batch) => batch.category)).size
  const datasetsCovered = new Set(acquisitionBatches.map((batch) => batch.source_dataset)).size

  return {
    source_acquisition_manifest_ready:
      acquisitionBatches.length > 0 &&
      targetRows === sourceDiversityPlan.summary.source_row_deficit_total &&
      categoriesCovered === sourceDiversityPlan.summary.categories &&
      releaseGate.status !== 'release_ready',
    benchmark_id: spec.id,
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      license_clearance: 'generated/license-clearance.json',
      release_gate: 'generated/release-gate.json',
    },
    summary: {
      acquisition_batches: acquisitionBatches.length,
      categories_covered: categoriesCovered,
      source_datasets_covered: datasetsCovered,
      target_new_distinct_source_rows: targetRows,
      known_license_target_rows: knownLicenseTargetRows,
      pointer_only_target_rows: pointerOnlyTargetRows,
      source_row_deficit_total: sourceDiversityPlan.summary.source_row_deficit_total,
      pointer_only_candidate_count_current: licenseClearance.pointer_only_candidate_count,
      completion_claim_allowed: false,
    },
    acquisition_policy: {
      row_selection_rule: 'Select new distinct upstream rows not already represented in the pilot or scaled public package.',
      review_rule: 'Every acquired row must produce reviewer workbooks and pass double review before gold promotion.',
      packaging_rule: 'Known-license rows may include text with attribution; unknown-license rows must remain pointer-only until clearance.',
      dedupe_rule: 'Do not count multiple adversarial transforms from one source row toward the source-row target.',
    },
    acquisition_batches: acquisitionBatches,
  }
}

function renderMarkdown(manifest) {
  const policyRows = Object.entries(manifest.acquisition_policy).map(([id, rule]) => [id, rule])
  const batchRows = manifest.acquisition_batches.map((batch) => [
    batch.batch_id,
    batch.category,
    batch.source_dataset,
    batch.license,
    batch.package_policy,
    String(batch.target_new_distinct_source_rows),
    batch.review_status,
  ])

  return `# Hard Grounded Research Source Acquisition Manifest

This generated manifest converts the source-diversity deficit into concrete Hugging Face acquisition batches. It does not import new rows by itself and does not create gold labels; it specifies what the next corpus expansion must sample before large-corpus category claims are defensible.

## Summary

- Source acquisition manifest ready: ${manifest.source_acquisition_manifest_ready}
- Acquisition batches: ${manifest.summary.acquisition_batches}
- Categories covered: ${manifest.summary.categories_covered}
- Source datasets covered: ${manifest.summary.source_datasets_covered}
- Target new distinct source rows: ${manifest.summary.target_new_distinct_source_rows}
- Known-license target rows: ${manifest.summary.known_license_target_rows}
- Pointer-only target rows: ${manifest.summary.pointer_only_target_rows}
- Current source-row deficit total: ${manifest.summary.source_row_deficit_total}
- Current pointer-only candidates: ${manifest.summary.pointer_only_candidate_count_current}
- Completion claim allowed: ${manifest.summary.completion_claim_allowed}

## Acquisition Policy

${markdownTable(['Policy', 'Rule'], policyRows)}

## Acquisition Batches

${markdownTable(['Batch', 'Category', 'Dataset', 'License', 'Package policy', 'Target rows', 'Review status'], batchRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing source acquisition manifest input ${name}: ${path}`)
}

const manifest = buildManifest({
  spec: readJson(inputs.spec),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  licenseClearance: readJson(inputs.licenseClearance),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(manifestJsonPath, manifest)
writeText(manifestMarkdownPath, renderMarkdown(manifest))
console.log(`Wrote hard grounded research source acquisition manifest to ${manifestJsonPath}`)
console.log(`Wrote hard grounded research source acquisition manifest report to ${manifestMarkdownPath}`)
