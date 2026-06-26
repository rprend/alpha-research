import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const publicPackageDir = join(generatedDir, 'public-package')
const reportJsonPath = join(generatedDir, 'public-package-schema.json')
const reportMarkdownPath = join(experimentDir, 'PUBLIC_PACKAGE_SCHEMA.md')

const inputs = {
  pilotSuite: join(publicPackageDir, 'hard-grounded-research-public-suite.json'),
  pilotSummary: join(publicPackageDir, 'summary.json'),
  scaledSuite: join(publicPackageDir, 'hard-grounded-research-scaled-public-suite.json'),
  scaledSummary: join(publicPackageDir, 'scaled-summary.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
}

const requiredItemFields = [
  'id',
  'category',
  'construction',
  'transform',
  'question',
  'source_examples',
  'expected_answer',
  'expected_failure',
  'review_status',
  'scoring_focus',
  'public_package',
]

const requiredSourceExampleFields = [
  'source_dataset',
  'source_row_id',
  'row_offset',
  'evidence_units',
]

const requiredEvidenceUnitFields = [
  'id',
  'title',
  'locator',
  'package_policy',
  'text_included_in_public_package',
  'text_sha256',
  'text_length',
  'license_status',
]

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

function hasOwn(value, key) {
  return Object.hasOwn(value, key)
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function requireFields({ object, requiredFields, path, violations }) {
  for (const field of requiredFields) {
    if (!hasOwn(object, field)) violations.push(`${path} missing required field ${field}`)
  }
}

function inspectSuite({ name, suite, summary }) {
  const items = suite.items || []
  const violations = []
  const requiredItemCoverage = Object.fromEntries(requiredItemFields.map((field) => [field, 0]))
  const requiredSourceExampleCoverage = Object.fromEntries(requiredSourceExampleFields.map((field) => [field, 0]))
  const requiredEvidenceUnitCoverage = Object.fromEntries(requiredEvidenceUnitFields.map((field) => [field, 0]))
  let sourceExamplesChecked = 0
  let evidenceUnitsChecked = 0
  let pointerOnlyEvidenceUnits = 0
  let textIncludedEvidenceUnits = 0

  if (suite.item_count !== items.length) {
    violations.push(`${name} suite item_count ${suite.item_count} does not match items.length ${items.length}`)
  }
  if (summary.item_count !== items.length) {
    violations.push(`${name} summary item_count ${summary.item_count} does not match items.length ${items.length}`)
  }

  items.forEach((item, itemIndex) => {
    const itemPath = `${name}.items[${itemIndex}]`
    requireFields({ object: item, requiredFields: requiredItemFields, path: itemPath, violations })
    for (const field of requiredItemFields) {
      if (hasOwn(item, field)) requiredItemCoverage[field] += 1
    }
    if (!isNonEmptyString(item.id)) violations.push(`${itemPath}.id must be a non-empty string`)
    if (!isNonEmptyString(item.category)) violations.push(`${itemPath}.category must be a non-empty string`)
    if (!isNonEmptyString(item.question)) violations.push(`${itemPath}.question must be a non-empty string`)
    if (!Array.isArray(item.source_examples) || item.source_examples.length === 0) violations.push(`${itemPath}.source_examples must be a non-empty array`)
    if (!Array.isArray(item.scoring_focus) || item.scoring_focus.length === 0) violations.push(`${itemPath}.scoring_focus must be a non-empty array`)
    if (typeof item.public_package !== 'object' || item.public_package === null) violations.push(`${itemPath}.public_package must be an object`)

    ;(item.source_examples || []).forEach((example, exampleIndex) => {
      const examplePath = `${itemPath}.source_examples[${exampleIndex}]`
      sourceExamplesChecked += 1
      requireFields({ object: example, requiredFields: requiredSourceExampleFields, path: examplePath, violations })
      for (const field of requiredSourceExampleFields) {
        if (hasOwn(example, field)) requiredSourceExampleCoverage[field] += 1
      }
      if (!isNonEmptyString(example.source_dataset)) violations.push(`${examplePath}.source_dataset must be a non-empty string`)
      if (!isNonEmptyString(example.source_row_id)) violations.push(`${examplePath}.source_row_id must be a non-empty string`)
      if (typeof example.row_offset !== 'number') violations.push(`${examplePath}.row_offset must be a number`)
      if (!Array.isArray(example.evidence_units) || example.evidence_units.length === 0) violations.push(`${examplePath}.evidence_units must be a non-empty array`)

      ;(example.evidence_units || []).forEach((unit, unitIndex) => {
        const unitPath = `${examplePath}.evidence_units[${unitIndex}]`
        evidenceUnitsChecked += 1
        requireFields({ object: unit, requiredFields: requiredEvidenceUnitFields, path: unitPath, violations })
        for (const field of requiredEvidenceUnitFields) {
          if (hasOwn(unit, field)) requiredEvidenceUnitCoverage[field] += 1
        }
        if (!isNonEmptyString(unit.id)) violations.push(`${unitPath}.id must be a non-empty string`)
        if (!isNonEmptyString(unit.title)) violations.push(`${unitPath}.title must be a non-empty string`)
        if (!isNonEmptyString(unit.locator)) violations.push(`${unitPath}.locator must be a non-empty string`)
        if (!isNonEmptyString(unit.package_policy)) violations.push(`${unitPath}.package_policy must be a non-empty string`)
        if (typeof unit.text_included_in_public_package !== 'boolean') violations.push(`${unitPath}.text_included_in_public_package must be a boolean`)
        if (typeof unit.text_length !== 'number') violations.push(`${unitPath}.text_length must be a number`)
        if (!isNonEmptyString(unit.text_sha256)) violations.push(`${unitPath}.text_sha256 must be a non-empty string`)

        const pointerOnly = unit.text_included_in_public_package === false || unit.package_policy === 'pointer_only_no_text'
        if (pointerOnly) {
          pointerOnlyEvidenceUnits += 1
          if (hasOwn(unit, 'text')) violations.push(`${unitPath} is pointer-only but includes text`)
        } else {
          textIncludedEvidenceUnits += 1
          if (!isNonEmptyString(unit.text)) violations.push(`${unitPath} includes public text but text is missing or empty`)
        }
      })
    })
  })

  return {
    name,
    item_count: items.length,
    summary_item_count: summary.item_count,
    source_examples_checked: sourceExamplesChecked,
    evidence_units_checked: evidenceUnitsChecked,
    pointer_only_evidence_units: pointerOnlyEvidenceUnits,
    text_included_evidence_units: textIncludedEvidenceUnits,
    required_coverage: {
      item: requiredItemCoverage,
      source_example: requiredSourceExampleCoverage,
      evidence_unit: requiredEvidenceUnitCoverage,
    },
    schema_violations: violations.length,
    violations,
    ready: violations.length === 0,
  }
}

function buildReport({ pilotSuite, pilotSummary, scaledSuite, scaledSummary, publicPackageIntegrity }) {
  const suites = [
    inspectSuite({ name: 'pilot_public_package', suite: pilotSuite, summary: pilotSummary }),
    inspectSuite({ name: 'scaled_public_package', suite: scaledSuite, summary: scaledSummary }),
  ]
  const schemaViolations = suites.reduce((sum, suite) => sum + suite.schema_violations, 0)

  return {
    public_package_schema_ready:
      schemaViolations === 0 &&
      Boolean(publicPackageIntegrity.public_package_integrity_ready) &&
      publicPackageIntegrity.summary?.findings === 0,
    version: 'public-package-schema-v1',
    generated_from: {
      pilot_public_suite: 'generated/public-package/hard-grounded-research-public-suite.json',
      pilot_public_summary: 'generated/public-package/summary.json',
      scaled_public_suite: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
      scaled_public_summary: 'generated/public-package/scaled-summary.json',
      public_package_integrity: 'generated/public-package-integrity.json',
    },
    schema_contract: {
      required_item_fields: requiredItemFields,
      required_source_example_fields: requiredSourceExampleFields,
      required_evidence_unit_fields: requiredEvidenceUnitFields,
      pointer_only_rule: 'Pointer-only evidence units must omit text and retain text_sha256.',
      included_text_rule: 'Redistributable evidence units must include non-empty text.',
      arrays_must_be_non_empty: ['source_examples', 'evidence_units', 'scoring_focus'],
    },
    suite_reports: suites,
    summary: {
      suites_checked: suites.length,
      items_checked: suites.reduce((sum, suite) => sum + suite.item_count, 0),
      source_examples_checked: suites.reduce((sum, suite) => sum + suite.source_examples_checked, 0),
      evidence_units_checked: suites.reduce((sum, suite) => sum + suite.evidence_units_checked, 0),
      pointer_only_evidence_units: suites.reduce((sum, suite) => sum + suite.pointer_only_evidence_units, 0),
      text_included_evidence_units: suites.reduce((sum, suite) => sum + suite.text_included_evidence_units, 0),
      schema_violations: schemaViolations,
      completion_claim_allowed: false,
    },
  }
}

function renderMarkdown(report) {
  const contractRows = [
    ['Item', report.schema_contract.required_item_fields.join(', ')],
    ['Source example', report.schema_contract.required_source_example_fields.join(', ')],
    ['Evidence unit', report.schema_contract.required_evidence_unit_fields.join(', ')],
  ]
  const suiteRows = report.suite_reports.map((suite) => [
    suite.name,
    suite.ready ? 'yes' : 'no',
    String(suite.item_count),
    String(suite.source_examples_checked),
    String(suite.evidence_units_checked),
    String(suite.pointer_only_evidence_units),
    String(suite.schema_violations),
  ])
  const violationRows = report.suite_reports.flatMap((suite) =>
    suite.violations.map((violation) => [suite.name, violation])
  )

  return `# Hard Grounded Research Public Package Schema

This generated report verifies that the public JSON package artifacts expose the field-level contract needed by downstream evaluators. It checks item, source-example, and evidence-unit fields, non-empty evidence arrays, and pointer-only text handling.

## Summary

- Schema ready: ${report.public_package_schema_ready}
- Version: ${report.version}
- Suites checked: ${report.summary.suites_checked}
- Items checked: ${report.summary.items_checked}
- Source examples checked: ${report.summary.source_examples_checked}
- Evidence units checked: ${report.summary.evidence_units_checked}
- Pointer-only evidence units: ${report.summary.pointer_only_evidence_units}
- Text-included evidence units: ${report.summary.text_included_evidence_units}
- Schema violations: ${report.summary.schema_violations}
- Completion claim allowed: ${report.summary.completion_claim_allowed}

## Required Fields

${markdownTable(['Object', 'Required fields'], contractRows)}

## Suites

${markdownTable(['Suite', 'Ready', 'Items', 'Source examples', 'Evidence units', 'Pointer-only units', 'Violations'], suiteRows)}

## Violations

${violationRows.length ? markdownTable(['Suite', 'Violation'], violationRows) : 'No schema violations.'}
`
}

const report = buildReport({
  pilotSuite: readJson(inputs.pilotSuite),
  pilotSummary: readJson(inputs.pilotSummary),
  scaledSuite: readJson(inputs.scaledSuite),
  scaledSummary: readJson(inputs.scaledSummary),
  publicPackageIntegrity: readJson(inputs.publicPackageIntegrity),
})

writeJson(reportJsonPath, report)
writeText(reportMarkdownPath, renderMarkdown(report))
