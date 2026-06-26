import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const manifestJsonPath = join(generatedDir, 'version-manifest.json')
const manifestMarkdownPath = join(experimentDir, 'VERSION_MANIFEST.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  publicPackageSummary: join(generatedDir, 'public-package/summary.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
}

const artifactPaths = [
  'benchmark-spec.json',
  'rubrics.json',
  'README.md',
  'DATASET_CARD.md',
  'DATA_STATEMENT.md',
  'SUBMISSION_CONTRACT.md',
  'SCORING_CONTRACT.md',
  'MODEL_REPORTING_CARD.md',
  'DERIVED_LABEL_SUITE.md',
  'DERIVED_SCALE_SUITE.md',
  'REVIEW_EXECUTION_PLAN.md',
  'REVIEW_PACKET_AUDIT.md',
  'REVIEW_RETURN_CONTRACT.md',
  'REVIEW_RETURN_PREFLIGHT.md',
  'REVIEW_RETURN_CHECKLIST.md',
  'REVIEW_COLLECTION_TRACKER.md',
  'REVIEW_WAVE_SCHEDULE.md',
  'REVIEW_DROPOFF_MANIFEST.md',
  'REVIEW_INTAKE_VALIDATOR.md',
  'REVIEW_ASSIGNMENT_AUDIT.md',
  'GOLD_ADJUDICATION_PLAN.md',
  'SCALE_ADJUDICATION_PLAN.md',
  'SCALE_GAP_LEDGER.md',
  'SOURCE_LINEAGE_LEDGER.md',
  'DIFFICULTY_MECHANISM_LEDGER.md',
  'HYPOTHESIS_TEST_MATRIX.md',
  'RESULT_INTERPRETATION_GUIDE.md',
  'EVIDENCE_SUFFICIENCY_AUDIT.md',
  'ESTIMAND_REGISTRY.md',
  'SENSITIVITY_ANALYSIS_PLAN.md',
  'LOOKUP_CONTRAST_REGISTRY.md',
  'STATISTICAL_REPORTING_TEMPLATE.md',
  'CONTROL_ABLATION_PLAN.md',
  'REPRODUCTION_CAPSULE.md',
  'CITATION.md',
  'NOVELTY_WATCHLIST.md',
  'NOVELTY_RESOLUTION_MATRIX.md',
  'NOVELTY_FINALIZATION_PREFLIGHT.md',
  'NOVELTY_SOURCE_REVIEW_PACKETS.md',
  'NOVELTY_CLAIM_REVISION_PLAN.md',
  'NOVELTY_LINK_AUDIT.md',
  'NOVELTY_REPLACEMENT_CANDIDATES.md',
  'NOVELTY_OVERLAP_ADJUDICATION.md',
  'NOVELTY_REFRESH_LEDGER.md',
  'PUBLIC_PACKAGE_SCHEMA.md',
  'ERROR_CODEBOOK.md',
  'PAPER_DRAFT.md',
  'generated/pilot-suite.json',
  'generated/public-package/summary.json',
  'generated/public-package/scaled-summary.json',
  'generated/public-package-manifest.json',
  'generated/public-package-integrity.json',
  'generated/public-package-schema.json',
  'generated/data-statement.json',
  'generated/submission-contract.json',
  'generated/scoring-contract.json',
  'generated/model-reporting-card.json',
  'generated/derived-label-suite.json',
  'generated/derived-scale-suite.json',
  'generated/review-execution-plan.json',
  'generated/review-packet-audit.json',
  'generated/review-return-contract.json',
  'generated/review-return-preflight.json',
  'generated/review-return-checklist.json',
  'generated/review-collection-tracker.json',
  'generated/review-wave-schedule.json',
  'generated/review-dropoff-manifest.json',
  'generated/review-intake-validator.json',
  'generated/review-assignment-audit.json',
  'generated/gold-adjudication-plan.json',
  'generated/scale-adjudication-plan.json',
  'generated/scale-gap-ledger.json',
  'generated/source-lineage-ledger.json',
  'generated/difficulty-mechanism-ledger.json',
  'generated/hypothesis-test-matrix.json',
  'generated/result-interpretation-guide.json',
  'generated/evidence-sufficiency-audit.json',
  'generated/estimand-registry.json',
  'generated/sensitivity-analysis-plan.json',
  'generated/lookup-contrast-registry.json',
  'generated/statistical-reporting-template.json',
  'generated/control-ablation-plan.json',
  'generated/reproduction-capsule.json',
  'generated/citation-metadata.json',
  'generated/error-codebook.json',
  'generated/novelty-audit.json',
  'generated/novelty-evidence.json',
  'generated/novelty-watchlist.json',
  'generated/novelty-resolution-matrix.json',
  'generated/novelty-finalization-preflight.json',
  'generated/novelty-source-review-packets.json',
  'generated/novelty-claim-revision-plan.json',
  'generated/novelty-link-audit.json',
  'generated/novelty-replacement-candidates.json',
  'generated/novelty-overlap-adjudication.json',
  'generated/novelty-refresh-ledger.json',
  'generated/paper-claim-ledger.json',
]

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
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

function artifactEntry(relativePath) {
  const path = join(experimentDir, relativePath)
  if (!existsSync(path)) throw new Error(`Missing version-manifest artifact: ${relativePath}`)
  const stat = statSync(path)
  return {
    path: relativePath,
    bytes: stat.size,
    sha256: sha256File(path),
  }
}

function buildManifest({ spec, releaseGate, artifactChecklist, dataStatement, publicPackageSummary, scaledPublicPackageSummary }) {
  const artifacts = artifactPaths.map(artifactEntry)
  const blockers = releaseGate.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    }))

  return {
    benchmark_id: spec.id,
    version_manifest_ready:
      artifacts.length === artifactPaths.length &&
      artifacts.every((artifact) => artifact.sha256.length === 64 && artifact.bytes > 0) &&
      dataStatement.data_statement_ready &&
      artifactChecklist.summary?.artifact_classes_total >= 30,
    version: 'version-manifest-v1',
    generated_from: {
      release_gate: 'generated/release-gate.json',
      artifact_checklist: 'generated/artifact-checklist.json',
      data_statement: 'generated/data-statement.json',
      public_package_summary: 'generated/public-package/summary.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
    },
    release_state: {
      status: releaseGate.status,
      passing_checks: releaseGate.checks.filter((check) => check.passed).length,
      total_checks: releaseGate.checks.length,
      blockers,
      completion_claim_allowed: false,
    },
    package_state: {
      public_package_items: publicPackageSummary.item_count,
      public_pointer_only_evidence_units: publicPackageSummary.pointer_only_evidence_units,
      scaled_public_items: scaledPublicPackageSummary.item_count,
      scaled_pointer_only_evidence_units: scaledPublicPackageSummary.pointer_only_evidence_units,
    },
    artifacts,
    summary: {
      artifact_count: artifacts.length,
      total_bytes: artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0),
      release_blockers: blockers.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(manifest) {
  const artifactRows = manifest.artifacts.map((artifact) => [
    artifact.path,
    String(artifact.bytes),
    artifact.sha256.slice(0, 16),
  ])
  const blockerRows = manifest.release_state.blockers.map((blocker) => [
    blocker.id,
    blocker.detail,
    blocker.blocker,
  ])

  return `# Hard Grounded Research Version Manifest

This generated manifest records the package-critical artifacts and SHA-256 digests for the current benchmark state. It makes paper tables, release surfaces, and package metadata auditable without implying that blocked paper claims are complete.

## Summary

- Version manifest ready: ${manifest.version_manifest_ready}
- Version: ${manifest.version}
- Benchmark id: \`${manifest.benchmark_id}\`
- Artifacts hashed: ${manifest.summary.artifact_count}
- Total bytes: ${manifest.summary.total_bytes}
- Release checks: ${manifest.release_state.passing_checks}/${manifest.release_state.total_checks}
- Release blockers: ${manifest.summary.release_blockers}
- Completion claim allowed: ${manifest.summary.completion_claim_allowed}

## Package State

- Public package items: ${manifest.package_state.public_package_items}
- Public pointer-only evidence units: ${manifest.package_state.public_pointer_only_evidence_units}
- Scaled public items: ${manifest.package_state.scaled_public_items}
- Scaled pointer-only evidence units: ${manifest.package_state.scaled_pointer_only_evidence_units}

## Artifact Digests

${markdownTable(['Artifact', 'Bytes', 'SHA-256 prefix'], artifactRows)}

## Active Release Blockers

${blockerRows.length ? markdownTable(['Check', 'Detail', 'Required action'], blockerRows) : 'No active release blockers.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  if (!existsSync(path)) throw new Error(`Missing version-manifest input ${name}: ${path}`)
}

const manifest = buildManifest({
  spec: readJson(inputs.spec),
  releaseGate: readJson(inputs.releaseGate),
  artifactChecklist: readJson(inputs.artifactChecklist),
  dataStatement: readJson(inputs.dataStatement),
  publicPackageSummary: readJson(inputs.publicPackageSummary),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
})

writeJson(manifestJsonPath, manifest)
writeText(manifestMarkdownPath, renderMarkdown(manifest))

console.log(`Wrote hard grounded version manifest JSON to ${manifestJsonPath}`)
console.log(`Wrote hard grounded version manifest report to ${manifestMarkdownPath}`)
