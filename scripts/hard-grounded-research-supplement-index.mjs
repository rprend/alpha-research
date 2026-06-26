import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const reportJsonPath = join(generatedDir, 'supplement-index.json')
const reportMarkdownPath = join(experimentDir, 'SUPPLEMENT_INDEX.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
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

function buildIndex({ spec, releaseGate, paperTables, paperClaimLedger, dataStatement, publicPackageIntegrity, publicPackageSchema, versionManifest, modelReportingCard, citationMetadata, reviewExecutionPlan, reproductionCapsule, artifactChecklist }) {
  const tableEntries = paperTables.tables.map((table) => ({
    id: table.id,
    title: table.title,
    source: 'generated/paper-tables.json',
    manuscript_use: table.caption,
  }))
  const claimEntries = paperClaimLedger.claims.map((claim) => ({
    id: claim.id,
    status: claim.status,
    claim: claim.claim,
    evidence: claim.evidence || [],
  }))
  const supplementSections = [
    {
      id: 'benchmark_definition',
      files: ['README.md', 'benchmark-spec.json', 'rubrics.json', 'CONSTRUCT_MAP.md'],
      purpose: 'Define the hard-grounded taxonomy, source datasets, rubrics, and construct operationalization.',
    },
    {
      id: 'data_package',
      files: ['DATASET_CARD.md', 'DATA_STATEMENT.md', 'PUBLIC_PACKAGE_MANIFEST.md', 'PUBLIC_PACKAGE_INTEGRITY.md', 'VERSION_MANIFEST.md', 'CITATION.md'],
      purpose: 'Document composition, licensing, package policy, package integrity, exact artifact hashes, and citation caveats.',
    },
    {
      id: 'evaluation_contract',
      files: ['SUBMISSION_CONTRACT.md', 'SCORING_CONTRACT.md', 'MODEL_REPORTING_CARD.md', 'ERROR_CODEBOOK.md', 'MODEL_BASELINES.md'],
      purpose: 'Define model input/output, scoring metrics, result reporting, qualitative error codes, and baseline import surfaces.',
    },
    {
      id: 'paper_evidence',
      files: ['PAPER_TABLES.md', 'PAPER_CLAIM_LEDGER.md', 'ANALYSIS_PLAN.md', 'POWER_PLAN.md'],
      purpose: 'Tie manuscript tables and claims to current evidence and blocked claims.',
    },
    {
      id: 'review_and_release_gates',
      files: ['ANNOTATION_PROTOCOL.md', 'REVIEWER_HANDOFF.md', 'REVIEW_EXECUTION_PLAN.md', 'RELEASE_GATE.md', 'THREATS_TO_VALIDITY.md'],
      purpose: 'Expose reviewer workflow, remaining workload, acceptance gates, blockers, and validity risks.',
    },
    {
      id: 'artifact_reproduction',
      files: ['REPRODUCTION_CAPSULE.md', 'ARTIFACT_CHECKLIST.md', 'VERSION_MANIFEST.md', 'RELEASE_GATE.md'],
      purpose: 'Record start-here reproduction commands, package-critical hashes, and current release readiness state.',
    },
  ]

  return {
    benchmark_id: spec.id,
    supplement_index_ready:
      supplementSections.length >= 6 &&
      tableEntries.length === paperTables.summary.table_count &&
      claimEntries.length === paperClaimLedger.summary.claims &&
      versionManifest.version_manifest_ready &&
      dataStatement.data_statement_ready &&
      publicPackageIntegrity.public_package_integrity_ready &&
      publicPackageSchema.public_package_schema_ready &&
      modelReportingCard.model_reporting_card_ready &&
      citationMetadata.citation_metadata_ready &&
      reviewExecutionPlan.review_execution_plan_ready &&
      reproductionCapsule.reproduction_capsule_ready &&
      artifactChecklist.artifact_checklist_ready,
    version: 'supplement-index-v2',
    generated_from: {
      release_gate: 'generated/release-gate.json',
      paper_tables: 'generated/paper-tables.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      data_statement: 'generated/data-statement.json',
      public_package_integrity: 'generated/public-package-integrity.json',
      public_package_schema: 'generated/public-package-schema.json',
      version_manifest: 'generated/version-manifest.json',
      model_reporting_card: 'generated/model-reporting-card.json',
      citation_metadata: 'generated/citation-metadata.json',
      review_execution_plan: 'generated/review-execution-plan.json',
      reproduction_capsule: 'generated/reproduction-capsule.json',
      artifact_checklist: 'generated/artifact-checklist.json',
    },
    supplement_sections: supplementSections,
    paper_tables: tableEntries,
    claim_map: claimEntries,
    release_state: {
      status: releaseGate.status,
      passing_checks: releaseGate.checks.filter((check) => check.passed).length,
      total_checks: releaseGate.checks.length,
      blockers: releaseGate.checks.filter((check) => !check.passed).map((check) => check.id),
      completion_claim_allowed: false,
    },
    summary: {
      sections: supplementSections.length,
      paper_tables: tableEntries.length,
      claims: claimEntries.length,
      artifact_hashes: versionManifest.summary.artifact_count,
      public_package_findings: publicPackageIntegrity.summary.findings,
      public_package_schema_violations: publicPackageSchema.summary.schema_violations,
      artifact_classes: artifactChecklist.summary.artifact_classes_total,
      model_reporting_fields: modelReportingCard.summary.required_reporting_fields,
      citation_caveats: citationMetadata.summary.citation_caveats,
      review_rows_remaining: reviewExecutionPlan.summary.total_rows_remaining,
      reproduction_commands: reproductionCapsule.summary.reproduction_commands,
      release_blockers: releaseGate.checks.filter((check) => !check.passed).length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(index) {
  const sectionRows = index.supplement_sections.map((section) => [
    section.id,
    section.files.join('<br>'),
    section.purpose,
  ])
  const tableRows = index.paper_tables.map((table) => [
    table.id,
    table.title,
    table.source,
  ])
  const claimRows = index.claim_map.map((claim) => [
    claim.id,
    claim.status,
    claim.claim,
  ])

  return `# Hard Grounded Research Supplement Index

This generated index maps the manuscript-facing supplement to source artifacts, claim boundaries, paper tables, and checksumed package state. It is a navigation artifact for reviewers; it does not clear the human-review, scale, or novelty gates.

## Summary

- Supplement index ready: ${index.supplement_index_ready}
- Version: ${index.version}
- Sections: ${index.summary.sections}
- Paper tables: ${index.summary.paper_tables}
- Claims: ${index.summary.claims}
- Version-manifest artifact hashes: ${index.summary.artifact_hashes}
- Public package findings: ${index.summary.public_package_findings}
- Artifact classes: ${index.summary.artifact_classes}
- Model reporting fields: ${index.summary.model_reporting_fields}
- Citation caveats: ${index.summary.citation_caveats}
- Review rows remaining: ${index.summary.review_rows_remaining}
- Reproduction commands: ${index.summary.reproduction_commands}
- Release checks: ${index.release_state.passing_checks}/${index.release_state.total_checks}
- Completion claim allowed: ${index.summary.completion_claim_allowed}

## Supplement Sections

${markdownTable(['Section', 'Files', 'Purpose'], sectionRows)}

## Paper Tables

${markdownTable(['Table', 'Title', 'Source'], tableRows)}

## Claim Map

${markdownTable(['Claim', 'Status', 'Text'], claimRows)}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing supplement-index input ${name}: ${path}`)
}

const index = buildIndex({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  paperTables: readJson(inputs.paperTables),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  dataStatement: readJson(inputs.dataStatement),
  publicPackageIntegrity: readJson(inputs.publicPackageIntegrity),
  publicPackageSchema: readJson(inputs.publicPackageSchema),
  versionManifest: readJson(inputs.versionManifest),
  modelReportingCard: readJson(inputs.modelReportingCard),
  citationMetadata: readJson(inputs.citationMetadata),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  reproductionCapsule: readJson(inputs.reproductionCapsule),
  artifactChecklist: readJson(inputs.artifactChecklist),
})

writeJson(reportJsonPath, index)
writeText(reportMarkdownPath, renderMarkdown(index))

console.log(`Wrote hard grounded supplement index JSON to ${reportJsonPath}`)
console.log(`Wrote hard grounded supplement index report to ${reportMarkdownPath}`)
