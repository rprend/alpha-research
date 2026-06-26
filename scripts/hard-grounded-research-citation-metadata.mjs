import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const metadataJsonPath = join(generatedDir, 'citation-metadata.json')
const metadataMarkdownPath = join(experimentDir, 'CITATION.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
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

function buildMetadata({ spec, versionManifest, dataStatement, releaseGate, noveltyAudit }) {
  const releaseBlockers = releaseGate.checks
    .filter((check) => !check.passed)
    .map((check) => check.id)
  const title = 'Benchmarks for Hard Grounded Research'
  const citationKey = 'hard_grounded_research_benchmark_2026'
  const authors = [
    { name: 'Alpha Research Contributors', affiliation: 'Alpha Research' },
  ]
  const bibtex = `@misc{${citationKey},
  title = {${title}},
  author = {{Alpha Research Contributors}},
  year = {2026},
  note = {Pilot benchmark package; completion, leaderboard, and novelty claims are gated. Version manifest: ${versionManifest.version}; artifact hashes: ${versionManifest.summary.artifact_count}.}
}`

  return {
    citation_metadata_ready:
      versionManifest.version_manifest_ready === true &&
      dataStatement.data_statement_ready === true &&
      releaseBlockers.includes('novelty_audit_final') &&
      releaseGate.status !== 'release_ready',
    version: 'citation-metadata-v1',
    generated_from: {
      benchmark_spec: 'benchmark-spec.json',
      version_manifest: 'generated/version-manifest.json',
      data_statement: 'generated/data-statement.json',
      release_gate: 'generated/release-gate.json',
      novelty_audit: 'generated/novelty-audit.json',
    },
    title,
    citation_key: citationKey,
    authors,
    year: 2026,
    benchmark_id: spec.id,
    package_version: versionManifest.version,
    artifact_hashes: versionManifest.summary.artifact_count,
    source_dataset_count: dataStatement.summary.source_dataset_count,
    release_state: {
      status: releaseGate.status,
      passing_checks: releaseGate.checks.filter((check) => check.passed).length,
      total_checks: releaseGate.checks.length,
      blockers: releaseBlockers,
    },
    novelty_state: {
      checked_date: noveltyAudit.checked_date,
      status: noveltyAudit.status,
      completion_claim_allowed: Boolean(noveltyAudit.completion_claim_allowed),
    },
    citation_caveats: [
      'Cite this as a pilot benchmark package until gold review, scale, and final novelty gates pass.',
      'Do not cite pilot scores as a public leaderboard.',
      'Use VERSION_MANIFEST.md and generated/version-manifest.json to identify the exact package state.',
      'Respect pointer-only package rules for unknown-license upstream evidence.',
    ],
    bibtex,
    summary: {
      citation_caveats: 4,
      artifact_hashes: versionManifest.summary.artifact_count,
      source_datasets: dataStatement.summary.source_dataset_count,
      release_blockers: releaseBlockers.length,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(metadata) {
  const caveatRows = metadata.citation_caveats.map((caveat, index) => [String(index + 1), caveat])
  const authorRows = metadata.authors.map((author) => [author.name, author.affiliation])

  return `# Hard Grounded Research Citation Metadata

This generated citation metadata describes how to cite the current benchmark package state. It does not grant permission to claim final benchmark completion, leaderboard readiness, or final novelty.

## Summary

- Citation metadata ready: ${metadata.citation_metadata_ready}
- Version: ${metadata.version}
- Title: ${metadata.title}
- Citation key: ${metadata.citation_key}
- Benchmark id: \`${metadata.benchmark_id}\`
- Package version source: ${metadata.package_version}
- Artifact hashes: ${metadata.artifact_hashes}
- Release checks: ${metadata.release_state.passing_checks}/${metadata.release_state.total_checks}
- Release blockers: ${metadata.summary.release_blockers}
- Completion claim allowed: ${metadata.summary.completion_claim_allowed}

## Authors

${markdownTable(['Name', 'Affiliation'], authorRows)}

## Citation Caveats

${markdownTable(['#', 'Caveat'], caveatRows)}

## BibTeX

\`\`\`bibtex
${metadata.bibtex}
\`\`\`
`
}

const metadata = buildMetadata({
  spec: readJson(inputs.spec),
  versionManifest: readJson(inputs.versionManifest),
  dataStatement: readJson(inputs.dataStatement),
  releaseGate: readJson(inputs.releaseGate),
  noveltyAudit: readJson(inputs.noveltyAudit),
})

writeJson(metadataJsonPath, metadata)
writeText(metadataMarkdownPath, renderMarkdown(metadata))
console.log(`Wrote hard grounded citation metadata to ${metadataJsonPath}`)
console.log(`Wrote hard grounded citation metadata report to ${metadataMarkdownPath}`)
