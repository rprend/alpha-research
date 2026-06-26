import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const ledgerJsonPath = join(generatedDir, 'source-lineage-ledger.json')
const ledgerMarkdownPath = join(experimentDir, 'SOURCE_LINEAGE_LEDGER.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  publicPackageManifest: join(generatedDir, 'public-package-manifest.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
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

function releaseCheck(releaseGate, id) {
  return releaseGate.checks.find((check) => check.id === id) || {
    id,
    passed: false,
    detail: 'missing release check',
    blocker: 'missing release check',
  }
}

function datasetById(spec) {
  return new Map(spec.datasets.map((dataset) => [dataset.id, dataset]))
}

function pilotRows(pilotSuite, publicPackageManifest, datasets) {
  const packageByItem = new Map(publicPackageManifest.items.map((item) => [item.item_id, item]))
  return pilotSuite.items.map((item) => {
    const sourceRows = item.source_examples.map((source) => ({
      dataset_id: source.source_dataset,
      source_row_id: String(source.source_row_id),
      global_source_key: `${source.source_dataset}:${source.source_row_id}`,
      row_offset: source.row_offset,
      license: datasets.get(source.source_dataset)?.license || 'unknown',
      viewer: datasets.get(source.source_dataset)?.viewer || null,
      evidence_units: source.evidence_units.length,
    }))
    const packageItem = packageByItem.get(item.id)
    return {
      item_id: item.id,
      family: 'pilot_suite',
      category: item.category,
      construction: item.construction,
      transform: item.transform,
      source_rows: sourceRows,
      source_row_count: sourceRows.length,
      source_datasets: [...new Set(sourceRows.map((source) => source.dataset_id))],
      evidence_unit_count: packageItem?.evidence_unit_count ?? item.source_examples.reduce((sum, source) => sum + source.evidence_units.length, 0),
      pointer_only_evidence_units: packageItem?.pointer_only_evidence_units ?? null,
      redistributable_evidence_units: packageItem?.redistributable_evidence_units ?? null,
      package_ready: Boolean(packageItem?.package_ready),
      review_status: item.review_status,
      gold_promotion_allowed: false,
    }
  })
}

function candidateRows(sourceAcquisitionCandidates, datasets) {
  return sourceAcquisitionCandidates.candidates.map((candidate) => ({
    item_id: candidate.id,
    family: 'source_acquisition_candidate',
    category: candidate.category,
    construction: candidate.construction,
    transform: 'requires_task_materialization',
    source_rows: [
      {
        dataset_id: candidate.source_dataset,
        source_row_id: String(candidate.source_row_id),
        global_source_key: candidate.global_source_key,
        row_offset: candidate.source_locator?.row_idx ?? null,
        license: candidate.license || datasets.get(candidate.source_dataset)?.license || 'unknown',
        viewer: {
          config: candidate.source_locator?.config || datasets.get(candidate.source_dataset)?.viewer?.config || null,
          split: candidate.source_locator?.split || datasets.get(candidate.source_dataset)?.viewer?.split || null,
        },
        evidence_units: 0,
      },
    ],
    source_row_count: 1,
    source_datasets: [candidate.source_dataset],
    evidence_unit_count: 0,
    pointer_only_evidence_units: candidate.pointer_only ? 1 : 0,
    redistributable_evidence_units: candidate.pointer_only ? 0 : 1,
    package_ready: candidate.package_policy === 'redistributable_known_license_evidence' || candidate.pointer_only,
    review_status: candidate.review_status,
    gold_promotion_allowed: Boolean(candidate.gold_promotion_allowed),
  }))
}

function summarizeByDataset(rows, spec) {
  const datasetRows = new Map()
  for (const row of rows) {
    for (const source of row.source_rows) {
      const existing = datasetRows.get(source.dataset_id) || {
        dataset_id: source.dataset_id,
        license: spec.datasets.find((dataset) => dataset.id === source.dataset_id)?.license || source.license || 'unknown',
        families: new Set(),
        categories: new Set(),
        item_count: 0,
        distinct_source_rows: new Set(),
        pointer_only_evidence_units: 0,
        redistributable_evidence_units: 0,
      }
      existing.families.add(row.family)
      existing.categories.add(row.category)
      existing.item_count += 1
      existing.distinct_source_rows.add(source.global_source_key)
      existing.pointer_only_evidence_units += row.pointer_only_evidence_units || 0
      existing.redistributable_evidence_units += row.redistributable_evidence_units || 0
      datasetRows.set(source.dataset_id, existing)
    }
  }

  return [...datasetRows.values()].map((row) => ({
    dataset_id: row.dataset_id,
    license: row.license,
    families: [...row.families].sort(),
    categories: [...row.categories].sort(),
    item_count: row.item_count,
    distinct_source_rows: row.distinct_source_rows.size,
    pointer_only_evidence_units: row.pointer_only_evidence_units,
    redistributable_evidence_units: row.redistributable_evidence_units,
  }))
}

function buildLedger({
  spec,
  pilotSuite,
  publicPackageManifest,
  sourceAcquisitionCandidates,
  sourceAcquisitionFetchedRows,
  sourceAcquisitionReviewWorkbooks,
  sourceAcquisitionReviewPreflight,
  releaseGate,
}) {
  const datasets = datasetById(spec)
  const rows = [
    ...pilotRows(pilotSuite, publicPackageManifest, datasets),
    ...candidateRows(sourceAcquisitionCandidates, datasets),
  ]
  const datasetSummary = summarizeByDataset(rows, spec)
  const sourceKeys = rows.flatMap((row) => row.source_rows.map((source) => source.global_source_key))
  const gates = ['source_acquisition_candidates_ready', 'source_acquisition_review_workbooks_ready', 'source_acquisition_review_preflight_report_ready', 'unknown_license_resolved'].map((id) =>
    releaseCheck(releaseGate, id),
  )
  const nonGoldRows = rows.filter((row) => row.gold_promotion_allowed === false).length
  const checks = [
    {
      id: 'all_pilot_items_have_source_rows',
      passed: pilotSuite.items.length === 30 && rows.filter((row) => row.family === 'pilot_suite').every((row) => row.source_row_count > 0),
      detail: `${rows.filter((row) => row.family === 'pilot_suite' && row.source_row_count > 0).length}/${pilotSuite.items.length} pilot items have source rows`,
    },
    {
      id: 'all_acquisition_candidates_have_global_source_keys',
      passed:
        sourceAcquisitionCandidates.summary.candidates === rows.filter((row) => row.family === 'source_acquisition_candidate').length &&
        rows.filter((row) => row.family === 'source_acquisition_candidate').every((row) => row.source_rows.every((source) => source.global_source_key)),
      detail: `${sourceAcquisitionCandidates.summary.candidates} candidates; fetched rows=${sourceAcquisitionFetchedRows.summary.fetched_rows}`,
    },
    {
      id: 'dataset_summary_covers_registered_sources',
      passed: spec.datasets.every((dataset) => datasetSummary.some((row) => row.dataset_id === dataset.id)),
      detail: `${datasetSummary.length}/${spec.datasets.length} registered datasets represented in lineage rows`,
    },
    {
      id: 'package_policy_visible_for_all_rows',
      passed: rows.every((row) => typeof row.pointer_only_evidence_units === 'number' && typeof row.redistributable_evidence_units === 'number'),
      detail: `${rows.length} lineage rows expose pointer-only and redistributable evidence counts`,
    },
    {
      id: 'review_state_remains_gated',
      passed:
        nonGoldRows === rows.length &&
        sourceAcquisitionReviewWorkbooks.source_acquisition_review_workbooks_ready &&
        sourceAcquisitionReviewPreflight.preflight_ready === false &&
        sourceAcquisitionReviewPreflight.gold_promotion_allowed === false,
      detail: `${nonGoldRows}/${rows.length} lineage rows blocked from gold promotion; source keys=${new Set(sourceKeys).size}`,
    },
  ]

  return {
    source_lineage_ledger_ready: checks.every((check) => check.passed),
    version: 'source-lineage-ledger-v1',
    completion_claim_allowed: false,
    generated_from: {
      spec: 'benchmark-spec.json',
      pilot_suite: 'generated/pilot-suite.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
      source_acquisition_review_workbooks: 'generated/source-acquisition-review-workbooks/index.json',
      source_acquisition_review_preflight: 'generated/source-acquisition-review-preflight.json',
      release_gate: 'generated/release-gate.json',
    },
    checks,
    dataset_summary: datasetSummary,
    lineage_rows: rows,
    release_gates: gates.map((gate) => ({
      id: gate.id,
      passed: gate.passed,
      detail: gate.detail,
      blocker: gate.blocker,
    })),
    summary: {
      lineage_rows: rows.length,
      pilot_items: rows.filter((row) => row.family === 'pilot_suite').length,
      acquisition_candidates: rows.filter((row) => row.family === 'source_acquisition_candidate').length,
      registered_datasets: spec.datasets.length,
      represented_datasets: datasetSummary.length,
      distinct_source_rows: new Set(sourceKeys).size,
      pointer_only_evidence_units: rows.reduce((sum, row) => sum + (row.pointer_only_evidence_units || 0), 0),
      redistributable_evidence_units: rows.reduce((sum, row) => sum + (row.redistributable_evidence_units || 0), 0),
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(ledger) {
  const checkRows = ledger.checks.map((check) => [check.id, String(check.passed), check.detail])
  const datasetRows = ledger.dataset_summary.map((row) => [
    row.dataset_id,
    row.license,
    row.families.join('<br>'),
    row.categories.join('<br>'),
    String(row.item_count),
    String(row.distinct_source_rows),
    `${row.redistributable_evidence_units}/${row.pointer_only_evidence_units}`,
  ])
  const sampleRows = ledger.lineage_rows.slice(0, 30).map((row) => [
    row.item_id,
    row.family,
    row.category,
    row.source_datasets.join('<br>'),
    row.source_rows.map((source) => source.global_source_key).join('<br>'),
    row.review_status,
  ])
  const gateRows = ledger.release_gates.map((gate) => [gate.id, String(gate.passed), gate.detail, gate.blocker])

  return `# Hard Grounded Research Source Lineage Ledger

This generated ledger makes the Hugging Face grounding claim auditable. It maps pilot items and source-acquisition candidates to registered datasets, source-row keys, license/package policy, pointer-only status, and review state.

## Summary

- Ledger ready: ${ledger.source_lineage_ledger_ready}
- Version: ${ledger.version}
- Lineage rows: ${ledger.summary.lineage_rows}
- Pilot items: ${ledger.summary.pilot_items}
- Acquisition candidates: ${ledger.summary.acquisition_candidates}
- Represented datasets: ${ledger.summary.represented_datasets}/${ledger.summary.registered_datasets}
- Distinct source rows: ${ledger.summary.distinct_source_rows}
- Redistributable evidence units: ${ledger.summary.redistributable_evidence_units}
- Pointer-only evidence units: ${ledger.summary.pointer_only_evidence_units}
- Completion claim allowed: ${ledger.summary.completion_claim_allowed}

## Readiness Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Dataset Summary

${markdownTable(['Dataset', 'License', 'Families', 'Categories', 'Items', 'Distinct source rows', 'Redistributable / pointer-only units'], datasetRows)}

## Sample Lineage Rows

${markdownTable(['Item', 'Family', 'Category', 'Datasets', 'Source keys', 'Review status'], sampleRows)}

## Release Gates

${markdownTable(['Gate', 'Passed', 'Detail', 'Blocker'], gateRows)}
`
}

const ledger = buildLedger({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  publicPackageManifest: readJson(inputs.publicPackageManifest),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  sourceAcquisitionFetchedRows: readJson(inputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionReviewWorkbooks: readJson(inputs.sourceAcquisitionReviewWorkbooks),
  sourceAcquisitionReviewPreflight: readJson(inputs.sourceAcquisitionReviewPreflight),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(ledgerJsonPath, ledger)
writeText(ledgerMarkdownPath, renderMarkdown(ledger))

console.log(`Wrote hard grounded source lineage ledger to ${ledgerJsonPath}`)
console.log(`Wrote hard grounded source lineage ledger report to ${ledgerMarkdownPath}`)
