import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const licenseImpactPath = join(generatedDir, 'license-impact.json')
const remediationPlanPath = join(generatedDir, 'license-remediation-plan.json')
const remediatedCandidatesPath = join(generatedDir, 'license-remediated-expansion-candidates.json')
const scaledPublicSuitePath = join(generatedDir, 'public-package/hard-grounded-research-scaled-public-suite.json')
const clearanceJsonPath = join(generatedDir, 'license-clearance.json')
const clearanceMarkdownPath = join(experimentDir, 'LICENSE_CLEARANCE.md')

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

function hasLeakedPointerOnlyText(item) {
  return item.source_examples.some((source) =>
    source.evidence_units.some((unit) => !unit.text_included_in_public_package && Object.hasOwn(unit, 'text')),
  )
}

function itemHasUnknownLicenseText(item) {
  return item.source_examples.some((source) =>
    source.evidence_units.some((unit) => unit.license_status === 'unknown' && unit.text_included_in_public_package),
  )
}

function buildClearance({ licenseImpact, remediationPlan, remediatedCandidates, scaledPublicSuite }) {
  const impactedIds = new Set(licenseImpact.impacted_candidates.map((candidate) => candidate.candidate_id))
  const remediatedSourceIds = new Set(
    remediatedCandidates.remediated_candidates.map((candidate) => candidate.provenance.source_expansion_candidate_id),
  )
  const pointerOnlyIds = new Set(remediatedCandidates.pointer_only_candidate_ids)
  const packageItemsBySourceId = new Map(
    scaledPublicSuite.items.map((item) => [item.source_expansion_candidate_id, item]),
  )

  const uncoveredImpactedCandidates = []
  const pointerOnlyTextLeaks = []
  const unknownLicenseTextLeaks = []
  const remediatedMissingFromPackage = []

  for (const impactedId of impactedIds) {
    const packagedItem = packageItemsBySourceId.get(impactedId)
    if (!packagedItem) {
      uncoveredImpactedCandidates.push(impactedId)
      continue
    }

    const mode = packagedItem.public_package.package_mode
    const isCovered =
      (pointerOnlyIds.has(impactedId) && mode === 'pointer_only_unknown_license_evidence') ||
      (remediatedSourceIds.has(impactedId) && mode === 'license_remediated_replacement')
    if (!isCovered) uncoveredImpactedCandidates.push(impactedId)
    if (hasLeakedPointerOnlyText(packagedItem)) pointerOnlyTextLeaks.push(impactedId)
    if (itemHasUnknownLicenseText(packagedItem)) unknownLicenseTextLeaks.push(impactedId)
  }

  for (const remediatedId of remediatedSourceIds) {
    if (!packageItemsBySourceId.has(remediatedId)) remediatedMissingFromPackage.push(remediatedId)
  }

  const checks = [
    {
      id: 'all_impacted_candidates_packaged',
      passed: uncoveredImpactedCandidates.length === 0,
      detail: `${licenseImpact.impacted_candidate_count - uncoveredImpactedCandidates.length}/${licenseImpact.impacted_candidate_count} impacted candidates covered by replacement or pointer-only package policy`,
    },
    {
      id: 'pointer_only_text_stripped',
      passed: pointerOnlyTextLeaks.length === 0,
      detail: `${pointerOnlyTextLeaks.length} pointer-only packaged items leaked text`,
    },
    {
      id: 'unknown_license_text_stripped',
      passed: unknownLicenseTextLeaks.length === 0,
      detail: `${unknownLicenseTextLeaks.length} impacted items include unknown-license text`,
    },
    {
      id: 'remediated_replacements_packaged',
      passed: remediatedMissingFromPackage.length === 0,
      detail: `${remediatedSourceIds.size - remediatedMissingFromPackage.length}/${remediatedSourceIds.size} remediated replacements present in scaled public package`,
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_license_impact: 'generated/license-impact.json',
    source_license_remediation_plan: 'generated/license-remediation-plan.json',
    source_license_remediated_expansion_candidates: 'generated/license-remediated-expansion-candidates.json',
    source_scaled_public_package: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
    public_redistribution_clearance_ready: checks.every((check) => check.passed),
    impacted_candidate_count: licenseImpact.impacted_candidate_count,
    remediated_replacement_count: remediatedSourceIds.size,
    pointer_only_candidate_count: pointerOnlyIds.size,
    scaled_public_item_count: scaledPublicSuite.item_count,
    package_mode_counts: scaledPublicSuite.package_mode_counts,
    remediation_policy: remediationPlan.category_plans.map((plan) => ({
      category: plan.category,
      impacted_candidate_count: plan.impacted_candidate_count,
      recommended_policy: plan.recommended_policy,
    })),
    checks,
    failures: {
      uncovered_impacted_candidates: uncoveredImpactedCandidates,
      pointer_only_text_leaks: pointerOnlyTextLeaks,
      unknown_license_text_leaks: unknownLicenseTextLeaks,
      remediated_missing_from_package: remediatedMissingFromPackage,
    },
  }
}

function renderMarkdown(clearance) {
  const checkRows = clearance.checks.map((check) => [
    check.id,
    check.passed ? 'yes' : 'no',
    check.detail,
  ])
  const policyRows = clearance.remediation_policy.map((plan) => [
    plan.category,
    String(plan.impacted_candidate_count),
    plan.recommended_policy,
  ])
  const modeRows = Object.entries(clearance.package_mode_counts).map(([mode, count]) => [mode, String(count)])

  return `# Hard Grounded Research License Clearance

This generated report verifies the public redistribution view of the scaled benchmark package. It does not change upstream license metadata; it proves that unknown-license expansion candidates are either replaced by known-license candidates or shipped pointer-only without source text.

## Summary

- Source license impact: ${clearance.source_license_impact}
- Source remediation plan: ${clearance.source_license_remediation_plan}
- Source scaled public package: ${clearance.source_scaled_public_package}
- Public redistribution clearance ready: ${clearance.public_redistribution_clearance_ready}
- Impacted candidates: ${clearance.impacted_candidate_count}
- Remediated replacements: ${clearance.remediated_replacement_count}
- Pointer-only candidates: ${clearance.pointer_only_candidate_count}
- Scaled public items: ${clearance.scaled_public_item_count}

## Checks

${markdownTable(['Check', 'Passed', 'Detail'], checkRows)}

## Package Modes

${markdownTable(['Mode', 'Items'], modeRows)}

## Remediation Policy

${markdownTable(['Category', 'Impacted candidates', 'Policy'], policyRows)}
`
}

for (const path of [licenseImpactPath, remediationPlanPath, remediatedCandidatesPath, scaledPublicSuitePath]) {
  if (!existsSync(path)) throw new Error(`Missing license clearance input: ${path}`)
}

const clearance = buildClearance({
  licenseImpact: readJson(licenseImpactPath),
  remediationPlan: readJson(remediationPlanPath),
  remediatedCandidates: readJson(remediatedCandidatesPath),
  scaledPublicSuite: readJson(scaledPublicSuitePath),
})

writeJson(clearanceJsonPath, clearance)
writeText(clearanceMarkdownPath, renderMarkdown(clearance))

console.log(`Wrote hard grounded license clearance to ${clearanceJsonPath}`)
console.log(`Wrote hard grounded license clearance report to ${clearanceMarkdownPath}`)
