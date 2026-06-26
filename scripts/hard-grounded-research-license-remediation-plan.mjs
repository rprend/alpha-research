import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const specPath = join(experimentDir, 'benchmark-spec.json')
const licenseReviewPath = join(generatedDir, 'license-review.json')
const licenseImpactPath = join(generatedDir, 'license-impact.json')
const planJsonPath = join(generatedDir, 'license-remediation-plan.json')
const planMarkdownPath = join(experimentDir, 'LICENSE_REMEDIATION_PLAN.md')

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

function knownLicenseDatasets(spec, licenseReview) {
  const reviewById = new Map(licenseReview.datasets.map((dataset) => [dataset.dataset_id, dataset]))
  return spec.datasets.filter((dataset) => !reviewById.get(dataset.id)?.blocks_public_release)
}

function replacementDatasetsForCategory(category, knownDatasets) {
  return knownDatasets
    .filter((dataset) => dataset.covers.includes(category))
    .map((dataset) => ({
      dataset_id: dataset.id,
      license: dataset.license,
      construction_role: dataset.construction_role,
    }))
}

function buildPlan(spec, licenseReview, licenseImpact) {
  const knownDatasets = knownLicenseDatasets(spec, licenseReview)
  const categoryPlans = Object.entries(licenseImpact.by_category).map(([category, impact]) => {
    const replacements = replacementDatasetsForCategory(category, knownDatasets)
    return {
      category,
      impacted_candidate_count: impact.candidate_count,
      blocked_datasets: impact.blocked_datasets,
      recommended_policy: replacements.length
        ? 'replace_blocked_sources_with_known_license_sources'
        : 'pointer_only_public_package_until_source_replacement',
      replacement_datasets: replacements,
      public_package_policy: replacements.length
        ? 'Regenerate impacted candidates with replacement datasets before public release.'
        : 'Strip text for impacted evidence and publish source pointers plus hashes only.',
    }
  })

  const replaceCandidateCount = categoryPlans
    .filter((plan) => plan.recommended_policy === 'replace_blocked_sources_with_known_license_sources')
    .reduce((sum, plan) => sum + plan.impacted_candidate_count, 0)
  const pointerOnlyCandidateCount = categoryPlans
    .filter((plan) => plan.recommended_policy === 'pointer_only_public_package_until_source_replacement')
    .reduce((sum, plan) => sum + plan.impacted_candidate_count, 0)

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    source_license_review: 'generated/license-review.json',
    source_license_impact: 'generated/license-impact.json',
    impacted_candidate_count: licenseImpact.impacted_candidate_count,
    replace_candidate_count: replaceCandidateCount,
    pointer_only_candidate_count: pointerOnlyCandidateCount,
    remediation_ready: licenseImpact.impacted_candidate_count > 0,
    public_release_ready_after_plan_execution: licenseImpact.impacted_candidate_count === 0,
    category_plans: categoryPlans,
  }
}

function renderMarkdown(plan) {
  const rows = plan.category_plans.map((categoryPlan) => [
    categoryPlan.category,
    String(categoryPlan.impacted_candidate_count),
    categoryPlan.blocked_datasets.join('<br>'),
    categoryPlan.recommended_policy,
    categoryPlan.replacement_datasets.map((dataset) => `${dataset.dataset_id} (${dataset.license})`).join('<br>') || 'none',
  ])

  return `# Hard Grounded Research License Remediation Plan

This generated plan turns the license impact queue into category-level remediation actions for paper-scale candidates. It does not resolve upstream licenses; it defines what must be regenerated or packaged pointer-only before public release.

## Summary

- Source license review: ${plan.source_license_review}
- Source license impact: ${plan.source_license_impact}
- Impacted candidates: ${plan.impacted_candidate_count}
- Candidates with replacement-source path: ${plan.replace_candidate_count}
- Candidates requiring pointer-only packaging until replacement: ${plan.pointer_only_candidate_count}
- Remediation ready: ${plan.remediation_ready}
- Public release ready after plan execution: ${plan.public_release_ready_after_plan_execution}

## Category Plans

${markdownTable(['Category', 'Impacted candidates', 'Blocked datasets', 'Recommended policy', 'Known-license replacement options'], rows)}
`
}

const plan = buildPlan(readJson(specPath), readJson(licenseReviewPath), readJson(licenseImpactPath))
writeJson(planJsonPath, plan)
writeText(planMarkdownPath, renderMarkdown(plan))

console.log(`Wrote hard grounded license remediation plan to ${planJsonPath}`)
console.log(`Wrote hard grounded license remediation report to ${planMarkdownPath}`)
