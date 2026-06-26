import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'data-statement.json')
const reportMarkdownPath = join(experimentDir, 'DATA_STATEMENT.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
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
  return releaseGate.checks.find((check) => check.id === id) || { id, passed: false, detail: 'missing' }
}

function buildReport({
  spec,
  pilotSuite,
  corpusAudit,
  packageManifest,
  licenseClearance,
  responsibleUse,
  sourceAcquisitionCandidates,
  annotationQualityControl,
  releaseGate,
}) {
  const datasetRows = spec.datasets.map((dataset) => ({
    id: dataset.id,
    license: dataset.license || 'unknown',
    url: dataset.url,
    covers: dataset.covers,
  }))
  const packagePolicy = {
    redistributable_known_license_items: packageManifest.package_ready_items,
    pointer_only_items: packageManifest.pointer_only_items,
    pointer_only_evidence_units: packageManifest.pointer_only_evidence_units,
    public_package_policy: packageManifest.public_package_policy,
    public_redistribution_clearance_ready: licenseClearance.public_redistribution_clearance_ready,
  }
  const reviewState = {
    gold_review_complete: releaseCheck(releaseGate, 'gold_review_complete').passed,
    review_merge_ready: releaseCheck(releaseGate, 'review_merge_ready').passed,
    category_scale_ready: releaseCheck(releaseGate, 'category_scale_ready').passed,
    qa_rules: annotationQualityControl.qa_rules.length,
    completion_claim_allowed: false,
  }
  const intendedUse = [
    'Evaluate grounded research QA systems on document-state, source-authority, temporal, evidence-sufficiency, and citation-support failures.',
    'Support diagnostic benchmark-development claims while human-reviewed gold and scale gates remain incomplete.',
    'Provide auditable task provenance from Hugging Face source datasets and generated challenge transforms.',
  ]
  const outOfScopeUse = [
    'Public model leaderboards before reviewed gold, category scale, and final novelty gates pass.',
    'High-stakes medical, legal, financial, safety, or climate-policy decisions.',
    'Redistribution of unknown-license source text outside pointer-only package rules.',
  ]

  return {
    benchmark_id: spec.id,
    data_statement_ready:
      datasetRows.length === spec.datasets.length &&
      packagePolicy.public_redistribution_clearance_ready === true &&
      responsibleUse.public_leaderboard_allowed === false &&
      reviewState.qa_rules >= 5 &&
      intendedUse.length >= 3 &&
      outOfScopeUse.length >= 3,
    version: 'data-statement-v1',
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      pilot_suite: 'generated/pilot-suite.json',
      corpus_audit: 'generated/corpus-audit.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      license_clearance: 'generated/license-clearance.json',
      responsible_use: 'generated/responsible-use.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      release_gate: 'generated/release-gate.json',
    },
    composition: {
      categories: spec.categories.length,
      pilot_items: pilotSuite.items.length,
      scaled_public_items: corpusAudit.summary.scaled_public_items,
      scaled_public_source_rows: corpusAudit.summary.scaled_public_source_rows,
      scaled_public_evidence_units: corpusAudit.summary.scaled_public_evidence_units,
      source_acquisition_candidates: sourceAcquisitionCandidates.summary.candidates,
      source_acquisition_review_rows: sourceAcquisitionCandidates.summary.required_review_rows,
    },
    source_datasets: datasetRows,
    package_policy: packagePolicy,
    intended_use: intendedUse,
    out_of_scope_use: outOfScopeUse,
    review_state: reviewState,
    limitations: [
      'Pilot labels are machine-seeded and diagnostic until double review and merge gates pass.',
      'Source acquisition candidates are review-pending and cannot support final category claims.',
      'Some evidence is pointer-only because upstream licenses are unknown or mixed.',
      'Novelty is refreshed as of June 26, 2026 but remains preliminary until the final novelty gate passes.',
    ],
    summary: {
      source_dataset_count: datasetRows.length,
      known_license_datasets: datasetRows.filter((dataset) => dataset.license !== 'unknown').length,
      unknown_license_datasets: datasetRows.filter((dataset) => dataset.license === 'unknown').length,
      intended_use_rules: intendedUse.length,
      out_of_scope_rules: outOfScopeUse.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const datasetRows = report.source_datasets.map((dataset) => [
    dataset.id,
    dataset.license,
    dataset.covers.join('<br>'),
    dataset.url,
  ])
  const useRows = report.intended_use.map((rule, index) => [String(index + 1), rule])
  const outOfScopeRows = report.out_of_scope_use.map((rule, index) => [String(index + 1), rule])
  const limitationRows = report.limitations.map((rule, index) => [String(index + 1), rule])

  return `# Hard Grounded Research Data Statement

This generated data statement records benchmark composition, source provenance, redistribution policy, intended use, and review status. It complements the dataset card with a stricter package-facing summary.

## Summary

- Data statement ready: ${report.data_statement_ready}
- Version: ${report.version}
- Source datasets: ${report.summary.source_dataset_count}
- Pilot items: ${report.composition.pilot_items}
- Scaled public items: ${report.composition.scaled_public_items}
- Pointer-only items: ${report.package_policy.pointer_only_items}
- Public redistribution clearance ready: ${report.package_policy.public_redistribution_clearance_ready}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Source Datasets

${markdownTable(['Dataset', 'License', 'Covers', 'URL'], datasetRows)}

## Package Policy

- Redistributable known-license items: ${report.package_policy.redistributable_known_license_items}
- Pointer-only items: ${report.package_policy.pointer_only_items}
- Pointer-only evidence units: ${report.package_policy.pointer_only_evidence_units}
- Policy: ${report.package_policy.public_package_policy}

## Intended Use

${markdownTable(['#', 'Use'], useRows)}

## Out-of-Scope Use

${markdownTable(['#', 'Restriction'], outOfScopeRows)}

## Review State

- Gold review complete: ${report.review_state.gold_review_complete}
- Review merge ready: ${report.review_state.review_merge_ready}
- Category scale ready: ${report.review_state.category_scale_ready}
- Annotation QA rules: ${report.review_state.qa_rules}

## Limitations

${markdownTable(['#', 'Limitation'], limitationRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing data-statement input ${name}: ${path}`)
}

const report = buildReport({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  corpusAudit: readJson(inputs.corpusAudit),
  packageManifest: readJson(inputs.packageManifest),
  licenseClearance: readJson(inputs.licenseClearance),
  responsibleUse: readJson(inputs.responsibleUse),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))

console.log(`Wrote hard grounded data statement JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded data statement report to ${reportMarkdownPath}`)
