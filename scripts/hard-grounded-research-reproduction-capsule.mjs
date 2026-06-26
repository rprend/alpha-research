import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const capsuleJsonPath = join(generatedDir, 'reproduction-capsule.json')
const capsuleMarkdownPath = join(experimentDir, 'REPRODUCTION_CAPSULE.md')

const inputs = {
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  publicPackageSummary: join(generatedDir, 'public-package/summary.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
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

function buildCapsule({ artifactChecklist, versionManifest, releaseGate, dataStatement, publicPackageSummary, scaledPublicPackageSummary }) {
  const blockers = releaseGate.checks
    .filter((check) => !check.passed)
    .map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    }))
  const reproductionCommands = artifactChecklist.reproduction_commands.map((entry, index) => ({
    order: index + 1,
    step: entry.step,
    command: entry.command,
    caveat: entry.caveat || null,
  }))
  const validationCommands = reproductionCommands.filter((entry) => /Validate|build|dashboard|full repository/i.test(entry.step))

  return {
    reproduction_capsule_ready:
      artifactChecklist.artifact_checklist_ready === true &&
      versionManifest.version_manifest_ready === true &&
      dataStatement.data_statement_ready === true &&
      reproductionCommands.length >= 8 &&
      validationCommands.length >= 3,
    version: 'reproduction-capsule-v1',
    generated_from: {
      artifact_checklist: 'generated/artifact-checklist.json',
      version_manifest: 'generated/version-manifest.json',
      release_gate: 'generated/release-gate.json',
      data_statement: 'generated/data-statement.json',
      public_package_summary: 'generated/public-package/summary.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
    },
    package_identity: {
      benchmark_id: artifactChecklist.benchmark_id,
      release_status: releaseGate.status,
      release_checks: `${releaseGate.checks.filter((check) => check.passed).length}/${releaseGate.checks.length}`,
      version_manifest: versionManifest.version,
      artifact_hashes: versionManifest.summary.artifact_count,
      total_bytes: versionManifest.summary.total_bytes,
    },
    package_contents: {
      public_package_items: publicPackageSummary.item_count,
      public_pointer_only_evidence_units: publicPackageSummary.pointer_only_evidence_units,
      scaled_public_items: scaledPublicPackageSummary.item_count,
      scaled_pointer_only_evidence_units: scaledPublicPackageSummary.pointer_only_evidence_units,
      source_datasets: dataStatement.summary.source_dataset_count,
    },
    reproduction_commands: reproductionCommands,
    validation_commands: validationCommands,
    expected_blockers: blockers,
    claim_limits: {
      completion_claim_allowed: false,
      public_leaderboard_allowed: false,
      category_level_claims_allowed: false,
    },
    summary: {
      reproduction_commands: reproductionCommands.length,
      validation_commands: validationCommands.length,
      artifact_hashes: versionManifest.summary.artifact_count,
      release_blockers: blockers.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(capsule) {
  const commandRows = capsule.reproduction_commands.map((entry) => [
    String(entry.order),
    entry.step,
    entry.caveat ? `${entry.command}<br>${entry.caveat}` : entry.command,
  ])
  const blockerRows = capsule.expected_blockers.map((blocker) => [
    blocker.id,
    blocker.detail,
    blocker.blocker,
  ])

  return `# Hard Grounded Research Reproduction Capsule

This generated capsule is the reviewer start-here artifact for reproducing the current benchmark package state. It records the expected commands, hashes, package counts, and known blockers without implying that paper-release gates are complete.

## Summary

- Capsule ready: ${capsule.reproduction_capsule_ready}
- Version: ${capsule.version}
- Benchmark id: \`${capsule.package_identity.benchmark_id}\`
- Release status: ${capsule.package_identity.release_status}
- Release checks: ${capsule.package_identity.release_checks}
- Artifact hashes: ${capsule.package_identity.artifact_hashes}
- Reproduction commands: ${capsule.summary.reproduction_commands}
- Validation commands: ${capsule.summary.validation_commands}
- Completion claim allowed: ${capsule.claim_limits.completion_claim_allowed}

## Package Contents

- Public package items: ${capsule.package_contents.public_package_items}
- Public pointer-only evidence units: ${capsule.package_contents.public_pointer_only_evidence_units}
- Scaled public items: ${capsule.package_contents.scaled_public_items}
- Scaled pointer-only evidence units: ${capsule.package_contents.scaled_pointer_only_evidence_units}
- Source datasets: ${capsule.package_contents.source_datasets}

## Reproduction Commands

${markdownTable(['#', 'Step', 'Command'], commandRows)}

## Expected Blockers

${markdownTable(['Check', 'Detail', 'Required action'], blockerRows)}
`
}

const capsule = buildCapsule({
  artifactChecklist: readJson(inputs.artifactChecklist),
  versionManifest: readJson(inputs.versionManifest),
  releaseGate: readJson(inputs.releaseGate),
  dataStatement: readJson(inputs.dataStatement),
  publicPackageSummary: readJson(inputs.publicPackageSummary),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
})

writeJson(capsuleJsonPath, capsule)
writeText(capsuleMarkdownPath, renderMarkdown(capsule))
console.log(`Wrote hard grounded reproduction capsule to ${capsuleJsonPath}`)
console.log(`Wrote hard grounded reproduction capsule report to ${capsuleMarkdownPath}`)
