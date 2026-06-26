import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const publicPackageDir = join(generatedDir, 'public-package')
const auditJsonPath = join(generatedDir, 'corpus-audit.json')
const auditMarkdownPath = join(experimentDir, 'CORPUS_AUDIT.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  scaledPublicSuite: join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.json'),
  publicSummary: join(publicPackageDir, 'summary.json'),
  scaledSummary: join(publicPackageDir, 'scaled-summary.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
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

function evidenceUnits(item) {
  return (item.source_examples || []).flatMap((example) =>
    (example.evidence_units || []).map((unit) => ({
      ...unit,
      source_dataset: example.source_dataset || unit.dataset || '',
      source_row_id: example.source_row_id || unit.source_row_id || '',
    })),
  )
}

function increment(map, key, amount = 1) {
  map.set(key, (map.get(key) || 0) + amount)
}

function countMapEntries(map) {
  return Object.fromEntries([...map.entries()].sort(([left], [right]) => left.localeCompare(right)))
}

function suiteStats({ name, items }) {
  const categories = new Map()
  const challengeTypes = new Map()
  const sourceDatasets = new Map()
  const sourceRows = new Set()
  const evidenceIds = new Set()
  const packageModes = new Map()
  let evidenceUnitCount = 0
  let pointerOnlyEvidenceUnits = 0
  let redistributableEvidenceUnits = 0
  let textIncludedEvidenceUnits = 0

  for (const item of items) {
    increment(categories, item.category || 'unknown')
    increment(challengeTypes, item.challenge?.type || item.challenge_type || item.transform || 'native_row')
    const publicMode = item.public_package?.package_mode
    if (publicMode) increment(packageModes, publicMode)

    for (const example of item.source_examples || []) {
      if (example.source_dataset) increment(sourceDatasets, example.source_dataset)
      if (example.source_dataset && example.source_row_id) sourceRows.add(`${example.source_dataset}:${example.source_row_id}`)
    }

    for (const unit of evidenceUnits(item)) {
      evidenceUnitCount += 1
      evidenceIds.add(unit.id)
      if (unit.source_dataset) increment(sourceDatasets, unit.source_dataset, 0)
      if (unit.package_policy === 'pointer_only_no_text' || unit.text_included_in_public_package === false) {
        pointerOnlyEvidenceUnits += 1
      }
      if (unit.package_policy === 'redistribute_text_with_attribution' || unit.text_included_in_public_package === true) {
        redistributableEvidenceUnits += 1
      }
      if (typeof unit.text === 'string' && unit.text.length > 0) textIncludedEvidenceUnits += 1
    }
  }

  return {
    suite: name,
    item_count: items.length,
    category_count: categories.size,
    challenge_type_count: challengeTypes.size,
    source_dataset_count: sourceDatasets.size,
    source_row_count: sourceRows.size,
    evidence_unit_count: evidenceUnitCount,
    unique_evidence_unit_count: evidenceIds.size,
    pointer_only_evidence_units: pointerOnlyEvidenceUnits,
    redistributable_evidence_units: redistributableEvidenceUnits,
    text_included_evidence_units: textIncludedEvidenceUnits,
    by_category: countMapEntries(categories),
    by_challenge_type: countMapEntries(challengeTypes),
    by_source_dataset: countMapEntries(sourceDatasets),
    package_mode_counts: countMapEntries(packageModes),
  }
}

function coverageRows(coverageMatrix) {
  return coverageMatrix.map((row) => ({
    category: row.category,
    dataset_count: row.dataset_count,
    task_count: row.task_count,
    datasets: row.datasets,
  }))
}

function buildAudit({ spec, coverageMatrix, pilotSuite, scaledPublicSuite, publicSummary, scaledSummary, packageManifest }) {
  const pilotStats = suiteStats({ name: 'pilot_suite', items: pilotSuite.items || [] })
  const scaledStats = suiteStats({ name: 'scaled_public_suite', items: scaledPublicSuite.items || [] })
  const coverage = coverageRows(coverageMatrix)
  const minDatasetsPerCategory = Math.min(...coverage.map((row) => row.dataset_count))
  const maxDatasetsPerCategory = Math.max(...coverage.map((row) => row.dataset_count))
  const packagePolicyMatches =
    publicSummary.pointer_only_evidence_units === packageManifest.pointer_only_evidence_units &&
    scaledSummary.pointer_only_evidence_units === scaledStats.pointer_only_evidence_units

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    corpus_audit_ready: true,
    generated_from: {
      spec: 'benchmark-spec.json',
      coverage_matrix: 'generated/coverage-matrix.json',
      pilot_suite: 'generated/pilot-suite.json',
      scaled_public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
      public_package_summary: 'generated/public-package/summary.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
      public_package_manifest: 'generated/public-package-manifest.json',
    },
    summary: {
      category_count: spec.categories.length,
      source_dataset_count: spec.datasets.length,
      coverage_min_datasets_per_category: minDatasetsPerCategory,
      coverage_max_datasets_per_category: maxDatasetsPerCategory,
      pilot_items: pilotStats.item_count,
      scaled_public_items: scaledStats.item_count,
      scaled_public_source_rows: scaledStats.source_row_count,
      scaled_public_evidence_units: scaledStats.evidence_unit_count,
      scaled_public_pointer_only_items: scaledSummary.pointer_only_items,
      scaled_public_pointer_only_evidence_units: scaledStats.pointer_only_evidence_units,
      scaled_public_replacement_originals_skipped: scaledSummary.replacement_originals_skipped,
      package_policy_matches_summaries: packagePolicyMatches,
    },
    pilot_suite: pilotStats,
    scaled_public_suite: scaledStats,
    coverage,
    source_datasets: spec.datasets.map((dataset) => ({
      id: dataset.id,
      license: dataset.license || 'unknown',
      covers: dataset.covers || [],
    })),
    package_policy: {
      public_package_policy: packageManifest.public_package_policy,
      pilot_pointer_only_items: publicSummary.pointer_only_items,
      pilot_pointer_only_evidence_units: publicSummary.pointer_only_evidence_units,
      scaled_package_mode_counts: scaledSummary.package_mode_counts,
    },
  }
}

function renderStatsTable(stats) {
  return markdownTable(
    ['Suite', 'Items', 'Categories', 'Challenge types', 'Source datasets', 'Source rows', 'Evidence units', 'Pointer-only evidence'],
    [[
      stats.suite,
      String(stats.item_count),
      String(stats.category_count),
      String(stats.challenge_type_count),
      String(stats.source_dataset_count),
      String(stats.source_row_count),
      String(stats.evidence_unit_count),
      String(stats.pointer_only_evidence_units),
    ]],
  )
}

function renderCountRows(counts) {
  return Object.entries(counts).map(([key, count]) => [key, String(count)])
}

function renderMarkdown(audit) {
  const coverageTable = audit.coverage.map((row) => [
    row.category,
    String(row.dataset_count),
    String(row.task_count),
    row.datasets.join('<br>'),
  ])
  const sourceRows = audit.source_datasets.map((dataset) => [
    dataset.id,
    dataset.license,
    dataset.covers.join('<br>'),
  ])

  return `# Hard Grounded Research Corpus Audit

This generated audit makes the corpus-level grounding claim inspectable. It summarizes source datasets, category coverage, source-row diversity, evidence-unit packaging, and pointer-only scope for the pilot and scaled public suites. It does not mark gold review complete.

## Summary

- Corpus audit ready: ${audit.corpus_audit_ready}
- Categories: ${audit.summary.category_count}
- Source Hugging Face datasets: ${audit.summary.source_dataset_count}
- Dataset coverage per category: ${audit.summary.coverage_min_datasets_per_category}-${audit.summary.coverage_max_datasets_per_category}
- Pilot items: ${audit.summary.pilot_items}
- Scaled public items: ${audit.summary.scaled_public_items}
- Scaled public source rows: ${audit.summary.scaled_public_source_rows}
- Scaled public evidence units: ${audit.summary.scaled_public_evidence_units}
- Scaled public pointer-only items: ${audit.summary.scaled_public_pointer_only_items}
- Package policy matches summaries: ${audit.summary.package_policy_matches_summaries}

## Suite Scale

${renderStatsTable(audit.pilot_suite)}

${renderStatsTable(audit.scaled_public_suite)}

## Category Coverage

${markdownTable(['Category', 'Datasets', 'Seed tasks', 'Dataset ids'], coverageTable)}

## Source Datasets

${markdownTable(['Dataset', 'License', 'Benchmark roles'], sourceRows)}

## Scaled Package Modes

${markdownTable(['Package mode', 'Items'], renderCountRows(audit.package_policy.scaled_package_mode_counts))}

## Scaled Challenge Types

${markdownTable(['Challenge type', 'Items'], renderCountRows(audit.scaled_public_suite.by_challenge_type))}

## Scaled Source Dataset Rows

${markdownTable(['Dataset', 'Evidence-bearing items'], renderCountRows(audit.scaled_public_suite.by_source_dataset))}

## Package Policy

- ${audit.package_policy.public_package_policy}
- Pilot pointer-only items: ${audit.package_policy.pilot_pointer_only_items}
- Pilot pointer-only evidence units: ${audit.package_policy.pilot_pointer_only_evidence_units}
- Scaled pointer-only evidence units: ${audit.summary.scaled_public_pointer_only_evidence_units}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing corpus audit input ${name}: ${path}`)
}

const audit = buildAudit({
  spec: readJson(inputs.spec),
  coverageMatrix: readJson(inputs.coverageMatrix),
  pilotSuite: readJson(inputs.pilotSuite),
  scaledPublicSuite: readJson(inputs.scaledPublicSuite),
  publicSummary: readJson(inputs.publicSummary),
  scaledSummary: readJson(inputs.scaledSummary),
  packageManifest: readJson(inputs.packageManifest),
})

writeJson(auditJsonPath, audit)
writeText(auditMarkdownPath, renderMarkdown(audit))
console.log(`Wrote hard grounded corpus audit to ${auditJsonPath}`)
console.log(`Wrote hard grounded corpus audit report to ${auditMarkdownPath}`)
