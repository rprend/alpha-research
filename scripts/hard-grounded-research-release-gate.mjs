import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const releaseGateJsonPath = join(generatedDir, 'release-gate.json')
const releaseGateMarkdownPath = join(experimentDir, 'RELEASE_GATE.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  noveltyAudit: join(experimentDir, 'NOVELTY_AUDIT.md'),
  noveltyAuditJson: join(generatedDir, 'novelty-audit.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  expansionReviewMergeReport: join(generatedDir, 'expansion-review-merge-report.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  scalePlan: join(generatedDir, 'scale-plan.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageSummary: join(generatedDir, 'public-package/summary.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function readText(path) {
  return readFileSync(path, 'utf8')
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

function noveltyAuditStatus(noveltyAudit, noveltyAuditJson) {
  return {
    checked_date: noveltyAuditJson.checked_date || noveltyAudit.match(/^Date checked:\s*(.+)$/m)?.[1] || '',
    preliminary: noveltyAuditJson.status !== 'final',
    completion_claim_allowed: Boolean(noveltyAuditJson.completion_claim_allowed),
    high_novelty_risk_categories: noveltyAuditJson.high_novelty_risk_categories ?? null,
  }
}

function buildGate({
  spec,
  noveltyAudit,
  noveltyAuditJson,
  goldSummary,
  reviewPreflight,
  expansionReviewPreflight,
  expansionReviewMergeReport,
  reviewMergeReport,
  scalePlan,
  itemQualityAudit,
  baselineAnalysis,
  modelRunIndex,
  licenseReview,
  packageManifest,
  publicPackageSummary,
}) {
  const licenseBlockers = licenseReview.blockers || []
  const scoredModelRuns = modelRunIndex.eligible_model_baselines || []
  const novelty = noveltyAuditStatus(noveltyAudit, noveltyAuditJson)
  const checks = [
    {
      id: 'gold_review_complete',
      passed: Boolean(goldSummary.gold_ready),
      detail: `${goldSummary.valid_reviewed_items}/${goldSummary.total_items} valid reviewed items`,
      blocker: 'Complete double review, resolve disagreements, and promote reviewed gold.',
    },
    {
      id: 'review_preflight_ready',
      passed: Boolean(reviewPreflight.preflight_ready),
      detail: `${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows} complete review rows`,
      blocker: 'Complete all reviewer workbook fields until strict review preflight succeeds.',
    },
    {
      id: 'expansion_review_preflight_ready',
      passed: Boolean(expansionReviewPreflight.preflight_ready),
      detail: `${expansionReviewPreflight.complete_review_rows}/${expansionReviewPreflight.total_review_rows} complete expansion review rows`,
      blocker: 'Complete all expansion reviewer workbook fields before using scaled candidates for paper claims.',
    },
    {
      id: 'expansion_review_merge_ready',
      passed: Boolean(expansionReviewMergeReport.merge_ready),
      detail: `${expansionReviewMergeReport.merge_ready_items}/${expansionReviewMergeReport.unique_items} expansion merge-ready items`,
      blocker: 'Resolve expansion reviewer disagreement before using scaled candidates for paper claims.',
    },
    {
      id: 'review_merge_ready',
      passed: Boolean(reviewMergeReport.merge_ready),
      detail: `${reviewMergeReport.merge_ready_items}/${reviewMergeReport.unique_items} merge-ready items`,
      blocker: 'Fill reviewer workbooks until strict review merge succeeds.',
    },
    {
      id: 'category_scale_ready',
      passed: Boolean(scalePlan.scale_ready),
      detail: `${scalePlan.current_valid_reviewed_items}/${scalePlan.total_target_reviewed_items} valid reviewed target items; ${scalePlan.additional_reviewed_items_needed} reviewed items still needed`,
      blocker: 'Scale each category to the target reviewed item count before paper release.',
    },
    {
      id: 'unknown_license_resolved',
      passed: licenseBlockers.length === 0,
      detail: licenseBlockers.length
        ? licenseBlockers.map((dataset) => dataset.dataset_id).join(', ')
        : 'license review clear',
      blocker: 'Resolve, replace, or pointer-only package unknown-license sources before public redistribution.',
    },
    {
      id: 'public_package_manifest_present',
      passed: Boolean(packageManifest.public_package_policy),
      detail: `${packageManifest.pointer_only_items} pointer-only items; ${packageManifest.pointer_only_evidence_units} pointer-only evidence units`,
      blocker: 'Generate public package manifest before releasing artifacts.',
    },
    {
      id: 'sanitized_public_suite_present',
      passed:
        publicPackageSummary.item_count === packageManifest.item_count &&
        publicPackageSummary.pointer_only_evidence_units === packageManifest.pointer_only_evidence_units,
      detail: `${publicPackageSummary.item_count} sanitized items; ${publicPackageSummary.pointer_only_evidence_units} pointer-only evidence units`,
      blocker: 'Generate a sanitized public suite that applies the public package manifest.',
    },
    {
      id: 'repair_queue_clear',
      passed: itemQualityAudit.repair_before_gold === 0,
      detail: `${itemQualityAudit.repair_before_gold} repair-before-gold items`,
      blocker: 'Repair or explicitly waive all repair-before-gold items.',
    },
    {
      id: 'frontier_or_open_model_results_present',
      passed: scoredModelRuns.length >= 2,
      detail: scoredModelRuns.length ? scoredModelRuns.join(', ') : 'no scored model reports present',
      blocker: 'Run and score at least two frontier or open model baselines over the release scoring source.',
    },
    {
      id: 'novelty_audit_final',
      passed: !novelty.preliminary && novelty.completion_claim_allowed,
      detail: `checked=${novelty.checked_date || 'unknown'} status=${noveltyAuditJson.status || 'unknown'} completion_claim_allowed=${novelty.completion_claim_allowed} high_risk_categories=${novelty.high_novelty_risk_categories ?? 'unknown'}`,
      blocker: 'Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion.',
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    status: checks.every((check) => check.passed) ? 'release_ready' : 'blocked',
    generated_from: {
      spec: 'benchmark-spec.json',
      novelty_audit: 'NOVELTY_AUDIT.md',
      novelty_audit_json: 'generated/novelty-audit.json',
      gold_summary: 'generated/gold-suite-summary.json',
      review_preflight: 'generated/review-preflight.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge_report: 'generated/expansion-review-merge-report.json',
      review_merge_report: 'generated/review-merge-report.json',
      scale_plan: 'generated/scale-plan.json',
      item_quality_audit: 'generated/item-quality-audit.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      model_run_index: 'generated/model-run-index.json',
      license_review: 'generated/license-review.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      sanitized_public_suite: 'generated/public-package/hard-grounded-research-public-suite.json',
    },
    pilot_item_count: goldSummary.total_items,
    scored_system_count: baselineAnalysis.systems.length,
    checks,
    blockers: checks.filter((check) => !check.passed).map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    })),
  }
}

function renderMarkdown(gate) {
  const checkRows = gate.checks.map((check) => [
    check.id,
    check.passed ? 'yes' : 'no',
    check.detail,
    check.passed ? '' : check.blocker,
  ])

  return `# Hard Grounded Research Release Gate

This generated gate is intentionally conservative. It prevents the pilot benchmark from being treated as paper-ready or public-release-ready until review, licensing, model baselines, and novelty evidence are complete.

## Summary

- Status: ${gate.status}
- Pilot items: ${gate.pilot_item_count}
- Scored systems in baseline analysis: ${gate.scored_system_count}
- Blockers: ${gate.blockers.length}

## Checks

${markdownTable(['Check', 'Passed', 'Detail', 'Blocker if failed'], checkRows)}

## Current Blockers

${gate.blockers.length ? gate.blockers.map((blocker) => `- ${blocker.id}: ${blocker.blocker} (${blocker.detail})`).join('\n') : 'No release blockers are present.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing release gate input ${name}: ${path}`)
}

const gate = buildGate({
  spec: readJson(inputs.spec),
  noveltyAudit: readText(inputs.noveltyAudit),
  noveltyAuditJson: readJson(inputs.noveltyAuditJson),
  goldSummary: readJson(inputs.goldSummary),
  reviewPreflight: readJson(inputs.reviewPreflight),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  expansionReviewMergeReport: readJson(inputs.expansionReviewMergeReport),
  reviewMergeReport: readJson(inputs.reviewMergeReport),
  scalePlan: readJson(inputs.scalePlan),
  itemQualityAudit: readJson(inputs.itemQualityAudit),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  modelRunIndex: readJson(inputs.modelRunIndex),
  licenseReview: readJson(inputs.licenseReview),
  packageManifest: readJson(inputs.packageManifest),
  publicPackageSummary: readJson(inputs.publicPackageSummary),
})

writeJson(releaseGateJsonPath, gate)
writeText(releaseGateMarkdownPath, renderMarkdown(gate))
console.log(`Wrote hard grounded research release gate to ${releaseGateJsonPath}`)
console.log(`Wrote hard grounded research release gate report to ${releaseGateMarkdownPath}`)
