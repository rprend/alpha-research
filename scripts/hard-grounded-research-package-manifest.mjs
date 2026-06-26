import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const pilotSuitePath = join(generatedDir, 'pilot-suite.json')
const licenseReviewPath = join(generatedDir, 'license-review.json')
const manifestJsonPath = join(generatedDir, 'public-package-manifest.json')
const manifestMarkdownPath = join(experimentDir, 'PUBLIC_PACKAGE_MANIFEST.md')

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

function sha256(value) {
  return createHash('sha256').update(String(value || '')).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function licenseMap(licenseReview) {
  return new Map(licenseReview.datasets.map((dataset) => [dataset.dataset_id, dataset]))
}

function evidenceManifest(unit, licenseByDataset) {
  const license = licenseByDataset.get(unit.dataset)
  const pointerOnly = Boolean(license?.blocks_public_release)
  return {
    evidence_id: unit.id,
    dataset_id: unit.dataset,
    title: unit.title,
    locator: unit.locator,
    package_policy: pointerOnly ? 'pointer_only_no_text' : 'redistribute_text_with_attribution',
    text_included_in_public_package: !pointerOnly,
    text_sha256: sha256(unit.text),
    text_length: String(unit.text || '').length,
    license_status: license?.observed_license || 'unknown',
  }
}

function buildManifest(pilotSuite, licenseReview) {
  const licenseByDataset = licenseMap(licenseReview)
  const items = pilotSuite.items.map((item) => {
    const evidenceUnits = item.source_examples.flatMap((source) =>
      (source.evidence_units || []).map((unit) => evidenceManifest({ ...unit, dataset: source.source_dataset }, licenseByDataset)),
    )
    const pointerOnlyEvidence = evidenceUnits.filter((unit) => !unit.text_included_in_public_package).length
    return {
      item_id: item.id,
      category: item.category,
      challenge_type: item.challenge?.type || 'native_row',
      evidence_unit_count: evidenceUnits.length,
      pointer_only_evidence_units: pointerOnlyEvidence,
      redistributable_evidence_units: evidenceUnits.length - pointerOnlyEvidence,
      package_ready: pointerOnlyEvidence === 0,
      evidence_units: evidenceUnits,
    }
  })
  const pointerOnlyItems = items.filter((item) => item.pointer_only_evidence_units > 0)
  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_suite: 'generated/pilot-suite.json',
    license_review: 'generated/license-review.json',
    item_count: items.length,
    package_ready_items: items.filter((item) => item.package_ready).length,
    pointer_only_items: pointerOnlyItems.length,
    pointer_only_evidence_units: items.reduce((sum, item) => sum + item.pointer_only_evidence_units, 0),
    public_package_policy:
      'Include text only for evidence units whose upstream dataset license is known; include dataset id, title, locator, and text hash for unknown-license evidence.',
    items,
  }
}

function renderMarkdown(manifest) {
  const rows = manifest.items.map((item) => [
    item.item_id,
    item.category,
    item.challenge_type,
    String(item.evidence_unit_count),
    String(item.pointer_only_evidence_units),
    item.package_ready ? 'yes' : 'pointer-only required',
  ])

  return `# Hard Grounded Research Public Package Manifest

This generated manifest defines what can be included in a public benchmark package under the current license review. Unknown-license evidence is not redistributed as text; the package keeps only stable pointers and text hashes for reproducibility.

## Summary

- Items: ${manifest.item_count}
- Package-ready items without pointer-only evidence: ${manifest.package_ready_items}
- Items requiring pointer-only evidence packaging: ${manifest.pointer_only_items}
- Pointer-only evidence units: ${manifest.pointer_only_evidence_units}

## Policy

${manifest.public_package_policy}

## Items

${markdownTable(['Item', 'Category', 'Challenge', 'Evidence units', 'Pointer-only units', 'Package status'], rows)}
`
}

if (!existsSync(pilotSuitePath)) throw new Error(`Missing pilot suite: ${pilotSuitePath}`)
if (!existsSync(licenseReviewPath)) throw new Error(`Missing license review: ${licenseReviewPath}`)

const manifest = buildManifest(readJson(pilotSuitePath), readJson(licenseReviewPath))
writeJson(manifestJsonPath, manifest)
writeText(manifestMarkdownPath, renderMarkdown(manifest))
console.log(`Wrote hard grounded research public package manifest to ${manifestJsonPath}`)
console.log(`Wrote hard grounded research public package report to ${manifestMarkdownPath}`)
