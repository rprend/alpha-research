import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const publicPackageDir = join(generatedDir, 'public-package')
const reportJsonPath = join(generatedDir, 'public-package-integrity.json')
const reportMarkdownPath = join(experimentDir, 'PUBLIC_PACKAGE_INTEGRITY.md')

const inputs = {
  pilotSuite: join(publicPackageDir, 'hard-grounded-research-public-suite.json'),
  pilotJsonl: join(publicPackageDir, 'hard-grounded-research-public-suite.jsonl'),
  pilotSummary: join(publicPackageDir, 'summary.json'),
  scaledSuite: join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.json'),
  scaledJsonl: join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.jsonl'),
  scaledSummary: join(publicPackageDir, 'scaled-summary.json'),
  publicPackageManifest: join(generatedDir, 'public-package-manifest.json'),
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readJsonl(path) {
  return readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`)
}

function writeText(path, value) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, value)
}

function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function markdownTable(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.join(' | ')} |`),
  ].join('\n')
}

function evidenceUnits(item) {
  return (item.source_examples || []).flatMap((example) => example.evidence_units || [])
}

function duplicateIds(ids) {
  const seen = new Set()
  const duplicates = new Set()
  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id)
    seen.add(id)
  }
  return [...duplicates].sort()
}

function countPointerOnly(items) {
  let pointerOnlyItems = 0
  let pointerOnlyEvidenceUnits = 0
  let textLeakCount = 0
  let missingHashCount = 0
  for (const item of items) {
    let itemHasPointerOnly = false
    for (const unit of evidenceUnits(item)) {
      if (unit.text_included_in_public_package === false || unit.package_policy === 'pointer_only_no_text') {
        itemHasPointerOnly = true
        pointerOnlyEvidenceUnits += 1
        if (Object.hasOwn(unit, 'text')) textLeakCount += 1
        if (!unit.text_sha256) missingHashCount += 1
      }
    }
    if (itemHasPointerOnly) pointerOnlyItems += 1
  }
  return { pointerOnlyItems, pointerOnlyEvidenceUnits, textLeakCount, missingHashCount }
}

function inspectSuite({ name, suite, jsonlRows, summary, suitePath, jsonlPath }) {
  const items = suite.items || []
  const itemIds = items.map((item) => item.id)
  const jsonlIds = jsonlRows.map((item) => item.id)
  const duplicateItemIds = duplicateIds(itemIds)
  const duplicateJsonlIds = duplicateIds(jsonlIds)
  const missingFromJsonl = itemIds.filter((id) => !jsonlIds.includes(id)).sort()
  const extraJsonlRows = jsonlIds.filter((id) => !itemIds.includes(id)).sort()
  const pointer = countPointerOnly(items)
  const findings = []

  if (suite.item_count !== items.length) findings.push(`suite item_count ${suite.item_count} does not match items.length ${items.length}`)
  if (summary.item_count !== items.length) findings.push(`summary item_count ${summary.item_count} does not match items.length ${items.length}`)
  if (jsonlRows.length !== items.length) findings.push(`jsonl rows ${jsonlRows.length} do not match items.length ${items.length}`)
  if (duplicateItemIds.length) findings.push(`duplicate item ids: ${duplicateItemIds.join(', ')}`)
  if (duplicateJsonlIds.length) findings.push(`duplicate jsonl ids: ${duplicateJsonlIds.join(', ')}`)
  if (missingFromJsonl.length) findings.push(`items missing from jsonl: ${missingFromJsonl.slice(0, 5).join(', ')}`)
  if (extraJsonlRows.length) findings.push(`jsonl rows missing from json: ${extraJsonlRows.slice(0, 5).join(', ')}`)
  if (summary.pointer_only_evidence_units !== pointer.pointerOnlyEvidenceUnits) findings.push(`summary pointer_only_evidence_units ${summary.pointer_only_evidence_units} does not match observed ${pointer.pointerOnlyEvidenceUnits}`)
  if (summary.pointer_only_items !== pointer.pointerOnlyItems) findings.push(`summary pointer_only_items ${summary.pointer_only_items} does not match observed ${pointer.pointerOnlyItems}`)
  if (pointer.textLeakCount) findings.push(`${pointer.textLeakCount} pointer-only evidence units include text`)
  if (pointer.missingHashCount) findings.push(`${pointer.missingHashCount} pointer-only evidence units are missing text_sha256`)

  return {
    name,
    item_count: items.length,
    jsonl_rows: jsonlRows.length,
    pointer_only_items: pointer.pointerOnlyItems,
    pointer_only_evidence_units: pointer.pointerOnlyEvidenceUnits,
    duplicate_item_ids: duplicateItemIds,
    duplicate_jsonl_ids: duplicateJsonlIds,
    missing_from_jsonl: missingFromJsonl,
    extra_jsonl_rows: extraJsonlRows,
    pointer_only_text_leaks: pointer.textLeakCount,
    pointer_only_missing_hashes: pointer.missingHashCount,
    suite_sha256: sha256File(suitePath),
    jsonl_sha256: sha256File(jsonlPath),
    findings,
    ready: findings.length === 0,
  }
}

function buildReport({ pilotSuite, pilotJsonl, pilotSummary, scaledSuite, scaledJsonl, scaledSummary, publicPackageManifest }) {
  const suites = [
    inspectSuite({
      name: 'pilot_public_package',
      suite: pilotSuite,
      jsonlRows: pilotJsonl,
      summary: pilotSummary,
      suitePath: inputs.pilotSuite,
      jsonlPath: inputs.pilotJsonl,
    }),
    inspectSuite({
      name: 'scaled_public_package',
      suite: scaledSuite,
      jsonlRows: scaledJsonl,
      summary: scaledSummary,
      suitePath: inputs.scaledSuite,
      jsonlPath: inputs.scaledJsonl,
    }),
  ]
  const manifestFindings = []
  if (publicPackageManifest.item_count !== pilotSummary.item_count) {
    manifestFindings.push(`manifest item_count ${publicPackageManifest.item_count} does not match pilot summary ${pilotSummary.item_count}`)
  }
  if (publicPackageManifest.pointer_only_evidence_units !== pilotSummary.pointer_only_evidence_units) {
    manifestFindings.push(`manifest pointer_only_evidence_units ${publicPackageManifest.pointer_only_evidence_units} does not match pilot summary ${pilotSummary.pointer_only_evidence_units}`)
  }
  const findingCount = suites.reduce((sum, suite) => sum + suite.findings.length, 0) + manifestFindings.length

  return {
    public_package_integrity_ready: findingCount === 0,
    version: 'public-package-integrity-v1',
    generated_from: {
      pilot_public_suite: 'generated/public-package/hard-grounded-research-public-suite.json',
      pilot_public_jsonl: 'generated/public-package/hard-grounded-research-public-suite.jsonl',
      pilot_public_summary: 'generated/public-package/summary.json',
      scaled_public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
      scaled_public_jsonl: 'generated/public-package/hard-grounded-research-scaled-public-suite.jsonl',
      scaled_public_summary: 'generated/public-package/scaled-summary.json',
      public_package_manifest: 'generated/public-package-manifest.json',
    },
    suites,
    manifest_findings: manifestFindings,
    summary: {
      suites_checked: suites.length,
      total_items: suites.reduce((sum, suite) => sum + suite.item_count, 0),
      total_jsonl_rows: suites.reduce((sum, suite) => sum + suite.jsonl_rows, 0),
      pointer_only_evidence_units: suites.reduce((sum, suite) => sum + suite.pointer_only_evidence_units, 0),
      pointer_only_text_leaks: suites.reduce((sum, suite) => sum + suite.pointer_only_text_leaks, 0),
      findings: findingCount,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const suiteRows = report.suites.map((suite) => [
    suite.name,
    suite.ready ? 'yes' : 'no',
    String(suite.item_count),
    String(suite.jsonl_rows),
    String(suite.pointer_only_evidence_units),
    suite.suite_sha256.slice(0, 16),
    suite.jsonl_sha256.slice(0, 16),
  ])
  const findingRows = [
    ...report.suites.flatMap((suite) => suite.findings.map((finding) => [suite.name, finding])),
    ...report.manifest_findings.map((finding) => ['public_package_manifest', finding]),
  ]

  return `# Hard Grounded Research Public Package Integrity

This generated report verifies the public JSON and JSONL package artifacts. It checks item-count parity, item-id parity, pointer-only text stripping, pointer-only hashes, and package-manifest consistency.

## Summary

- Integrity ready: ${report.public_package_integrity_ready}
- Version: ${report.version}
- Suites checked: ${report.summary.suites_checked}
- Total items: ${report.summary.total_items}
- Total JSONL rows: ${report.summary.total_jsonl_rows}
- Pointer-only evidence units: ${report.summary.pointer_only_evidence_units}
- Pointer-only text leaks: ${report.summary.pointer_only_text_leaks}
- Findings: ${report.summary.findings}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Suites

${markdownTable(['Suite', 'Ready', 'Items', 'JSONL rows', 'Pointer-only units', 'Suite SHA-256', 'JSONL SHA-256'], suiteRows)}

## Findings

${findingRows.length ? markdownTable(['Scope', 'Finding'], findingRows) : 'No integrity findings.'}
`
}

const report = buildReport({
  pilotSuite: readJson(inputs.pilotSuite),
  pilotJsonl: readJsonl(inputs.pilotJsonl),
  pilotSummary: readJson(inputs.pilotSummary),
  scaledSuite: readJson(inputs.scaledSuite),
  scaledJsonl: readJsonl(inputs.scaledJsonl),
  scaledSummary: readJson(inputs.scaledSummary),
  publicPackageManifest: readJson(inputs.publicPackageManifest),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))
console.log(`Wrote hard grounded public package integrity to ${reportJsonPath}`)
console.log(`Wrote hard grounded public package integrity report to ${reportMarkdownPath}`)
