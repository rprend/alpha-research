import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const datasetCardPath = join(experimentDir, 'DATASET_CARD.md')

const inputPaths = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  coverageMatrix: join(generatedDir, 'coverage-matrix.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
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

function datasetRows(spec) {
  return spec.datasets.map((dataset) => [
    dataset.id,
    dataset.license || 'unknown',
    dataset.url,
    dataset.covers.join('<br>'),
  ])
}

function categoryRows(coverageMatrix) {
  return coverageMatrix.map((row) => [
    row.category,
    String(row.dataset_count),
    String(row.task_count),
    row.datasets.join('<br>'),
  ])
}

function challengeRows(pilotSuite) {
  const counts = new Map()
  for (const item of pilotSuite.items) {
    const challengeType = item.challenge?.type || 'native_row'
    counts.set(challengeType, (counts.get(challengeType) || 0) + 1)
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([challengeType, count]) => [challengeType, String(count)])
}

function checkDetail(releaseGate, id) {
  const check = releaseGate.checks.find((candidate) => candidate.id === id)
  return check ? `${check.passed ? 'pass' : 'block'} - ${check.detail}` : 'not reported'
}

function modelRows(modelRunIndex) {
  return modelRunIndex.runs
    .filter((run) => run.eligible_model_baseline)
    .map((run) => [
      run.system_id,
      run.evaluation_source,
      String(run.task_count),
      String(run.macro_answer_correct),
      run.report_present ? 'yes' : 'no',
    ])
}

function expansionSmokeTotals(expansionPromotionSmoke) {
  return Object.values(expansionPromotionSmoke.category_summary).reduce(
    (totals, row) => ({
      total: totals.total + row.total_items,
      mergeReady: totals.mergeReady + row.merge_ready_items,
    }),
    { total: 0, mergeReady: 0 },
  )
}

function renderCard({
  spec,
  pilotSuite,
  coverageMatrix,
  itemQualityAudit,
  reviewMergeReport,
  goldSummary,
  baselineAnalysis,
  modelRunIndex,
  licenseReview,
  licenseClearance,
  packageManifest,
  releaseGate,
  annotationProtocol,
  annotationExport,
  annotationImport,
  annotationImportSmoke,
  goldPromotionSmoke,
  expansionPromotionSmoke,
}) {
  const expansionSmoke = expansionSmokeTotals(expansionPromotionSmoke)

  return `# Hard Grounded Research Dataset Card

Status: pilot benchmark card generated from repository artifacts. This is not a final public release card until gold review is complete.

## Dataset Summary

Hard Grounded Research is a pilot benchmark for grounded research QA failure modes that go beyond simple fact lookup. Items are derived from public Hugging Face datasets and transformed into tasks that test document-state reasoning, source authority, temporal validity, evidence sufficiency, table/text interpretation, citation overreach, entity disambiguation, and contradiction handling.

- Benchmark id: \`${spec.id}\`
- Pilot items: ${pilotSuite.items.length}
- Categories: ${spec.categories.length}
- Source Hugging Face datasets: ${spec.datasets.length}
- Gold ready: ${goldSummary.gold_ready}
- Valid reviewed items: ${goldSummary.valid_reviewed_items}/${goldSummary.total_items}
- Release gate status: ${releaseGate.status}
- License review status: ${licenseReview.status}
- Public redistribution clearance ready: ${licenseClearance.public_redistribution_clearance_ready}
- Pointer-only package items: ${packageManifest.pointer_only_items}
- Eligible external model baselines: ${modelRunIndex.eligible_model_baseline_count}

## Intended Uses

- Evaluate grounded research QA systems under adversarial evidence-use conditions.
- Diagnose whether failures come from answer selection, citation coverage, conclusion support, abstention, temporal validity, or contradiction handling.
- Support a benchmark/position paper about what makes grounded research hard beyond lookup.

## Out-of-Scope Uses

- Do not treat the current pilot as final gold data.
- Do not use mechanically seeded labels as human-validated truth.
- Do not compare production systems as a leaderboard until double review, disagreement resolution, and novelty refresh are complete.

## Source Datasets

${markdownTable(['Dataset', 'License', 'HF URL', 'Benchmark roles'], datasetRows(spec))}

## Category Coverage

${markdownTable(['Category', 'Datasets', 'Seed tasks', 'Dataset ids'], categoryRows(coverageMatrix))}

## Challenge-Type Coverage

${markdownTable(['Challenge type', 'Pilot items'], challengeRows(pilotSuite))}

## Annotation And Review

- Annotation protocol: \`ANNOTATION_PROTOCOL.md\`
- Review workbooks: \`generated/review-workbooks/*.jsonl\`
- Annotation export: ${annotationExport.export_ready ? 'ready' : 'not ready'} (${annotationExport.totals.row_count} rows across ${annotationExport.totals.file_count} files)
- Annotation import path: ${annotationImport.annotation_import_ready ? 'ready' : 'not ready'} (${annotationImport.rows_importable}/${annotationImport.rows_checked} fixture rows importable; applied=${annotationImport.applied_to_workbooks})
- Annotation import smoke: ${annotationImportSmoke.annotation_import_smoke_ready ? 'ready' : 'not ready'} (${annotationImportSmoke.rows_checked} returned fixture rows checked; findings=${annotationImportSmoke.finding_count})
- Independent reviews required per item: 2
- Required reviewer fields: ${annotationProtocol.required_reviewer_fields.map((field) => `\`${field}\``).join(', ')}
- Missing-review items: ${reviewMergeReport.missing_review_items}
- Disagreement items: ${reviewMergeReport.disagreement_items}
- Repair-before-gold items: ${itemQualityAudit.repair_before_gold}
- Review-carefully items: ${itemQualityAudit.review_carefully}
- Exact agreement rate: ${reviewMergeReport.agreement?.exact_agreement_rate ?? 'n/a'}
- Label agreement rate: ${reviewMergeReport.agreement?.label_agreement_rate ?? 'n/a'}

## Promotion Rehearsals

- Pilot gold promotion smoke: ${goldPromotionSmoke.gold_promotion_smoke_ready ? 'ready' : 'not ready'} (${goldPromotionSmoke.gold_summary.valid_reviewed_items}/${goldPromotionSmoke.gold_summary.total_items} fixture gold items; release_eligible=${goldPromotionSmoke.fixture_release_eligible})
- Scaled expansion promotion smoke: ${expansionPromotionSmoke.expansion_promotion_smoke_ready ? 'ready' : 'not ready'} (${expansionSmoke.mergeReady}/${expansionSmoke.total} fixture expansion items merge-ready; release_eligible=${expansionPromotionSmoke.fixture_release_eligible})
- These rehearsals use fixture reviewer fields only. They prove the mechanics of merge and promotion; they do not clear human-review blockers.

## Scoring

The evaluator reports answer correctness, evidence recall, citation precision, citation faithfulness, conclusion support, and abstention quality. Challenge-type diagnostics are present for ${baselineAnalysis.systems.length} scored baseline systems in \`generated/baseline-analysis.json\`.

## External Model Baselines

${markdownTable(['System', 'Evaluation source', 'Tasks', 'Macro answer correct', 'Report present'], modelRows(modelRunIndex))}

## Data Provenance And Licensing Notes

This benchmark stores normalized evidence snippets and metadata from upstream Hugging Face datasets. Upstream dataset licenses are mixed and include unknown-license sources, so a public release must either preserve attribution and license notices, replace unknown-license sources, or release only pointers/transforms where required. See \`LICENSE_REVIEW.md\`, \`generated/license-review.json\`, \`PUBLIC_PACKAGE_MANIFEST.md\`, and \`generated/public-package-manifest.json\` for the generated blocker and pointer-only packaging lists.

Packaged redistribution clearance is currently ${licenseClearance.public_redistribution_clearance_ready ? 'ready' : 'not ready'} for the generated public package: ${licenseClearance.remediated_replacement_count} impacted scaled candidates are replaced with known-license alternatives, ${licenseClearance.pointer_only_candidate_count} are pointer-only, and ${licenseClearance.package_mode_counts.redistributable_known_license_evidence} use redistributable known-license evidence. Raw upstream source-license status is still tracked separately from package clearance.

## Known Limitations

1. Current scale is ${pilotSuite.items.length} pilot items, not the target 30-50 reviewed items per category.
2. Gold labels are blocked until independent review and disagreement resolution are complete.
3. Some challenge items are synthetic transformations of existing rows and require human review before publication.
4. The novelty audit is preliminary and must be refreshed before any completion claim.
5. Unknown-license upstream datasets must remain pointer-only or be replaced before any package that redistributes source text.

## Release Gate

See \`RELEASE_GATE.md\` and \`generated/release-gate.json\`. Current blockers: ${releaseGate.blockers.length}.

Key release checks:

- Gold review: ${checkDetail(releaseGate, 'gold_review_complete')}
- Review preflight: ${checkDetail(releaseGate, 'review_preflight_ready')}
- Reviewer handoff: ${checkDetail(releaseGate, 'reviewer_handoff_ready')}
- Annotation export: ${checkDetail(releaseGate, 'annotation_export_ready')}
- Annotation import path: ${checkDetail(releaseGate, 'annotation_import_path_ready')}
- Pilot promotion smoke: ${checkDetail(releaseGate, 'gold_promotion_smoke_ready')}
- Expansion promotion smoke: ${checkDetail(releaseGate, 'expansion_promotion_smoke_ready')}
- Public package clearance: ${checkDetail(releaseGate, 'unknown_license_resolved')}
- External model baselines: ${checkDetail(releaseGate, 'frontier_or_open_model_results_present')}
- Novelty audit: ${checkDetail(releaseGate, 'novelty_audit_final')}
`
}

for (const [name, path] of Object.entries(inputPaths)) {
  assert(existsSync(path), `Missing dataset card input ${name}: ${path}`)
}

writeText(
  datasetCardPath,
  renderCard({
    spec: readJson(inputPaths.spec),
    pilotSuite: readJson(inputPaths.pilotSuite),
    coverageMatrix: readJson(inputPaths.coverageMatrix),
    itemQualityAudit: readJson(inputPaths.itemQualityAudit),
    reviewMergeReport: readJson(inputPaths.reviewMergeReport),
    goldSummary: readJson(inputPaths.goldSummary),
    baselineAnalysis: readJson(inputPaths.baselineAnalysis),
    modelRunIndex: readJson(inputPaths.modelRunIndex),
    licenseReview: readJson(inputPaths.licenseReview),
    licenseClearance: readJson(inputPaths.licenseClearance),
    packageManifest: readJson(inputPaths.packageManifest),
    releaseGate: readJson(inputPaths.releaseGate),
    annotationProtocol: readJson(inputPaths.annotationProtocol),
    annotationExport: readJson(inputPaths.annotationExport),
    annotationImport: readJson(inputPaths.annotationImport),
    annotationImportSmoke: readJson(inputPaths.annotationImportSmoke),
    goldPromotionSmoke: readJson(inputPaths.goldPromotionSmoke),
    expansionPromotionSmoke: readJson(inputPaths.expansionPromotionSmoke),
  }),
)

console.log(`Wrote hard grounded research dataset card to ${datasetCardPath}`)
