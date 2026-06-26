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
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  reviewOperations: join(generatedDir, 'review-operations.json'),
  reviewTriage: join(generatedDir, 'review-triage.json'),
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  expansionReviewMergeReport: join(generatedDir, 'expansion-review-merge-report.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  scalePlan: join(generatedDir, 'scale-plan.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelBaselinePackets: join(generatedDir, 'model-baseline-packets.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseImpact: join(generatedDir, 'license-impact.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  licenseRemediationPlan: join(generatedDir, 'license-remediation-plan.json'),
  licenseRemediatedExpansionCandidates: join(generatedDir, 'license-remediated-expansion-candidates.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageSummary: join(generatedDir, 'public-package/summary.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
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
  noveltyEvidence,
  goldSummary,
  annotationProtocol,
  reviewPreflight,
  reviewOperations,
  reviewTriage,
  annotationAssignments,
  reviewerHandoff,
  reviewProgress,
  adjudicationReadiness,
  annotatorAgreement,
  expansionReviewPreflight,
  expansionReviewMergeReport,
  reviewMergeReport,
  scalePlan,
  itemQualityAudit,
  baselineAnalysis,
  baselineUncertainty,
  modelRunIndex,
  modelBaselinePackets,
  annotationExport,
  annotationImportSmoke,
  annotationImport,
  goldPromotionSmoke,
  expansionPromotionSmoke,
  licenseReview,
  licenseImpact,
  licenseClearance,
  licenseRemediationPlan,
  licenseRemediatedExpansionCandidates,
  packageManifest,
  publicPackageSummary,
  scaledPublicPackageSummary,
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
      id: 'annotation_protocol_present',
      passed: Boolean(annotationProtocol.annotation_protocol_ready),
      detail: `${annotationProtocol.review_scope.pilot_review_rows} pilot review rows; ${annotationProtocol.review_scope.expansion_review_rows} expansion review rows`,
      blocker: 'Generate the reviewer annotation protocol before collecting final review labels.',
    },
    {
      id: 'review_preflight_ready',
      passed: Boolean(reviewPreflight.preflight_ready),
      detail: `${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows} complete review rows`,
      blocker: 'Complete all reviewer workbook fields until strict review preflight succeeds.',
    },
    {
      id: 'review_operations_ready',
      passed: Boolean(reviewOperations.review_operations_ready),
      detail: `${reviewOperations.pilot_review.incomplete_review_rows} pilot incomplete rows; ${reviewOperations.expansion_review.incomplete_review_rows} expansion incomplete rows`,
      blocker: 'Generate a consolidated pilot and expansion review operations queue.',
    },
    {
      id: 'review_triage_present',
      passed: Boolean(reviewTriage.review_triage_ready),
      detail: `${reviewTriage.urgent_or_high_items} urgent/high pilot items ranked from ${reviewTriage.model_baseline_count} model baselines`,
      blocker: 'Generate model-failure triage before starting paper review.',
    },
    {
      id: 'annotation_assignment_plan_present',
      passed: Boolean(annotationAssignments.assignment_plan_ready),
      detail: `${annotationAssignments.totals.pilot_assignment_count} pilot assignments; ${annotationAssignments.totals.expansion_assignment_count} expansion assignments; first-wave expansion rows=${annotationAssignments.totals.expansion_target_rows}`,
      blocker: 'Generate concrete annotation assignments for pilot triage and paper-scale expansion review.',
    },
    {
      id: 'reviewer_handoff_ready',
      passed: Boolean(reviewerHandoff.handoff_ready),
      detail: `${reviewerHandoff.totals.export_rows} handoff rows across ${reviewerHandoff.totals.export_files} files; gates=${reviewerHandoff.acceptance_gates.filter((gate) => gate.passed).length}/${reviewerHandoff.acceptance_gates.length}`,
      blocker: 'Generate a reviewer-facing handoff packet that ties assignments, exports, import checks, and acceptance gates together.',
    },
    {
      id: 'review_progress_ready',
      passed: Boolean(reviewProgress.review_progress_ready),
      detail: `${reviewProgress.summary.pilot_complete_review_rows}/${reviewProgress.summary.pilot_total_review_rows} pilot rows and ${reviewProgress.summary.expansion_complete_review_rows}/${reviewProgress.summary.expansion_total_review_rows} expansion rows complete; target_remaining=${reviewProgress.summary.reviewed_items_remaining}`,
      blocker: 'Generate a review progress report from preflight, merge, assignment, handoff, and scale artifacts.',
    },
    {
      id: 'adjudication_readiness_ready',
      passed: Boolean(adjudicationReadiness.adjudication_readiness_ready),
      detail: `pilot_queue=${adjudicationReadiness.summary.pilot_resolution_queue_items}; expansion_queue=${adjudicationReadiness.summary.expansion_resolution_queue_items}; gold_ready=${adjudicationReadiness.summary.gold_ready}; promotion_allowed=${adjudicationReadiness.release_promotion_allowed}`,
      blocker: 'Generate an adjudication readiness report that ties merge outputs to resolution queues and promotion preconditions.',
    },
    {
      id: 'annotator_agreement_ready',
      passed: Boolean(annotatorAgreement.annotator_agreement_ready),
      detail: `completed_metric_pairs=${annotatorAgreement.summary.completed_metric_pairs}; agreement_claim_allowed=${annotatorAgreement.summary.agreement_claim_allowed}`,
      blocker: 'Generate an annotator agreement report so paper claims can cite reliability once reviewer pairs are complete.',
    },
    {
      id: 'annotation_export_ready',
      passed: Boolean(annotationExport.export_ready),
      detail: `${annotationExport.totals.row_count} exported rows across ${annotationExport.totals.file_count} files; pilot=${annotationExport.totals.pilot_rows}; expansion=${annotationExport.totals.expansion_rows}`,
      blocker: 'Generate checksum-backed reviewer export files from the annotation assignment plan.',
    },
    {
      id: 'annotation_import_smoke_ready',
      passed: Boolean(annotationImportSmoke.annotation_import_smoke_ready),
      detail: `${annotationImportSmoke.rows_checked} returned fixture rows checked across ${annotationImportSmoke.files_checked} files; findings=${annotationImportSmoke.finding_count}`,
      blocker: 'Run the annotation import smoke to verify returned review packets preserve immutable fields.',
    },
    {
      id: 'annotation_import_path_ready',
      passed: Boolean(annotationImport.annotation_import_ready),
      detail: `${annotationImport.rows_importable}/${annotationImport.rows_checked} importable returned rows; files=${annotationImport.returned_files_found}/${annotationImport.expected_files}; fixture_allowed=${annotationImport.allow_fixture}; applied=${annotationImport.applied_to_workbooks}`,
      blocker: 'Run the reusable annotation importer against returned reviewer packets before attempting review preflight or merge.',
    },
    {
      id: 'gold_promotion_smoke_ready',
      passed: Boolean(goldPromotionSmoke.gold_promotion_smoke_ready) && goldPromotionSmoke.fixture_release_eligible === false,
      detail: `${goldPromotionSmoke.gold_summary.gold_items}/${goldPromotionSmoke.gold_summary.total_items} fixture gold items; release_eligible=${goldPromotionSmoke.fixture_release_eligible}`,
      blocker: 'Run the isolated fixture rehearsal that proves review merge and gold-shape promotion can succeed without modifying real workbooks.',
    },
    {
      id: 'expansion_promotion_smoke_ready',
      passed: Boolean(expansionPromotionSmoke.expansion_promotion_smoke_ready) && expansionPromotionSmoke.fixture_release_eligible === false,
      detail: `${expansionPromotionSmoke.merge.merge_ready_items}/${expansionPromotionSmoke.merge.unique_items} fixture expansion items merge-ready; release_eligible=${expansionPromotionSmoke.fixture_release_eligible}`,
      blocker: 'Run the isolated fixture rehearsal that proves scaled expansion review can become merge-ready without modifying real workbooks.',
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
      passed: licenseBlockers.length === 0 || Boolean(licenseClearance.public_redistribution_clearance_ready),
      detail: licenseBlockers.length
        ? `${licenseBlockers.map((dataset) => dataset.dataset_id).join(', ')}; packaged clearance=${licenseClearance.public_redistribution_clearance_ready}`
        : 'license review clear',
      blocker: 'Resolve, replace, or pointer-only package unknown-license sources before public redistribution.',
    },
    {
      id: 'license_impact_clear',
      passed: Boolean(licenseImpact.public_release_ready) || Boolean(licenseClearance.public_redistribution_clearance_ready),
      detail: `${licenseImpact.impacted_candidate_count}/${licenseImpact.expansion_candidate_count} expansion candidates depend on unknown-license sources; ${licenseClearance.remediated_replacement_count} replaced; ${licenseClearance.pointer_only_candidate_count} pointer-only; packaged clearance=${licenseClearance.public_redistribution_clearance_ready}`,
      blocker: 'Replace unknown-license expansion sources or keep impacted candidates pointer-only before public release.',
    },
    {
      id: 'license_remediation_plan_present',
      passed: Boolean(licenseRemediationPlan.remediation_ready),
      detail: `${licenseRemediationPlan.replace_candidate_count} replacement-path candidates; ${licenseRemediationPlan.pointer_only_candidate_count} pointer-only candidates`,
      blocker: 'Generate a category-level remediation plan for unknown-license scaled candidates.',
    },
    {
      id: 'license_remediated_expansion_candidates_present',
      passed: licenseRemediatedExpansionCandidates.remediated_candidate_count === licenseRemediationPlan.replace_candidate_count,
      detail: `${licenseRemediatedExpansionCandidates.remediated_candidate_count}/${licenseRemediationPlan.replace_candidate_count} replacement-path candidates materialized`,
      blocker: 'Generate known-license replacement candidates for every remediation-plan category with a replacement path.',
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
      id: 'scaled_public_package_present',
      passed:
        scaledPublicPackageSummary.item_count === licenseImpact.expansion_candidate_count &&
        scaledPublicPackageSummary.replacement_originals_skipped === licenseRemediationPlan.replace_candidate_count,
      detail: `${scaledPublicPackageSummary.item_count} scaled public items; ${scaledPublicPackageSummary.replacement_originals_skipped} remediated replacements; ${scaledPublicPackageSummary.pointer_only_items} pointer-only items`,
      blocker: 'Generate a scaled public package that applies remediated replacements and pointer-only text stripping.',
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
      id: 'baseline_uncertainty_present',
      passed: Boolean(baselineUncertainty.uncertainty_ready),
      detail: `${baselineUncertainty.system_count} systems with descriptive task-level intervals`,
      blocker: 'Generate uncertainty estimates for current scored baselines.',
    },
    {
      id: 'model_baseline_packets_present',
      passed: Boolean(modelBaselinePackets.packets_ready),
      detail: `${modelBaselinePackets.packet_count} prompt packets; scored_reports_ready=${modelBaselinePackets.scored_reports_ready}`,
      blocker: 'Generate reproducible prompt packets for at least two non-fixture model baselines.',
    },
    {
      id: 'novelty_audit_final',
      passed: !novelty.preliminary && novelty.completion_claim_allowed,
      detail: `checked=${novelty.checked_date || 'unknown'} status=${noveltyAuditJson.status || 'unknown'} completion_claim_allowed=${novelty.completion_claim_allowed} high_risk_categories=${novelty.high_novelty_risk_categories ?? 'unknown'}`,
      blocker: 'Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion.',
    },
    {
      id: 'novelty_evidence_registry_present',
      passed: noveltyEvidence.source_count >= 5 && noveltyEvidence.completion_claim_allowed === false,
      detail: `${noveltyEvidence.source_count} related-work sources registered; completion_claim_allowed=${noveltyEvidence.completion_claim_allowed}`,
      blocker: 'Generate a source-backed related-work registry while keeping final novelty claims gated.',
    },
  ]

  return {
    benchmark_id: 'hard-grounded-research-benchmark',
    status: checks.every((check) => check.passed) ? 'release_ready' : 'blocked',
    generated_from: {
      spec: 'benchmark-spec.json',
      novelty_audit: 'NOVELTY_AUDIT.md',
      novelty_audit_json: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      gold_summary: 'generated/gold-suite-summary.json',
      annotation_protocol: 'generated/annotation-protocol.json',
      review_preflight: 'generated/review-preflight.json',
      review_operations: 'generated/review-operations.json',
      review_triage: 'generated/review-triage.json',
      annotation_assignments: 'generated/annotation-assignments.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      review_progress: 'generated/review-progress.json',
      adjudication_readiness: 'generated/adjudication-readiness.json',
      annotator_agreement: 'generated/annotator-agreement.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      annotation_import_smoke: 'generated/annotation-import-smoke/report.json',
      annotation_import: 'generated/annotation-import/report.json',
      gold_promotion_smoke: 'generated/gold-promotion-smoke/report.json',
      expansion_promotion_smoke: 'generated/expansion-promotion-smoke/report.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge_report: 'generated/expansion-review-merge-report.json',
      review_merge_report: 'generated/review-merge-report.json',
      scale_plan: 'generated/scale-plan.json',
      item_quality_audit: 'generated/item-quality-audit.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      model_run_index: 'generated/model-run-index.json',
      model_baseline_packets: 'generated/model-baseline-packets.json',
      license_review: 'generated/license-review.json',
      license_impact: 'generated/license-impact.json',
      license_clearance: 'generated/license-clearance.json',
      license_remediation_plan: 'generated/license-remediation-plan.json',
      license_remediated_expansion_candidates: 'generated/license-remediated-expansion-candidates.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      sanitized_public_suite: 'generated/public-package/hard-grounded-research-public-suite.json',
      scaled_public_package: 'generated/public-package/hard-grounded-research-scaled-public-suite.json',
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
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  goldSummary: readJson(inputs.goldSummary),
  annotationProtocol: readJson(inputs.annotationProtocol),
  reviewPreflight: readJson(inputs.reviewPreflight),
  reviewOperations: readJson(inputs.reviewOperations),
  reviewTriage: readJson(inputs.reviewTriage),
  annotationAssignments: readJson(inputs.annotationAssignments),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  reviewProgress: readJson(inputs.reviewProgress),
  adjudicationReadiness: readJson(inputs.adjudicationReadiness),
  annotatorAgreement: readJson(inputs.annotatorAgreement),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  expansionReviewMergeReport: readJson(inputs.expansionReviewMergeReport),
  reviewMergeReport: readJson(inputs.reviewMergeReport),
  scalePlan: readJson(inputs.scalePlan),
  itemQualityAudit: readJson(inputs.itemQualityAudit),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  modelRunIndex: readJson(inputs.modelRunIndex),
  modelBaselinePackets: readJson(inputs.modelBaselinePackets),
  annotationExport: readJson(inputs.annotationExport),
  annotationImportSmoke: readJson(inputs.annotationImportSmoke),
  annotationImport: readJson(inputs.annotationImport),
  goldPromotionSmoke: readJson(inputs.goldPromotionSmoke),
  expansionPromotionSmoke: readJson(inputs.expansionPromotionSmoke),
  licenseReview: readJson(inputs.licenseReview),
  licenseImpact: readJson(inputs.licenseImpact),
  licenseClearance: readJson(inputs.licenseClearance),
  licenseRemediationPlan: readJson(inputs.licenseRemediationPlan),
  licenseRemediatedExpansionCandidates: readJson(inputs.licenseRemediatedExpansionCandidates),
  packageManifest: readJson(inputs.packageManifest),
  publicPackageSummary: readJson(inputs.publicPackageSummary),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
})

writeJson(releaseGateJsonPath, gate)
writeText(releaseGateMarkdownPath, renderMarkdown(gate))
console.log(`Wrote hard grounded research release gate to ${releaseGateJsonPath}`)
console.log(`Wrote hard grounded research release gate report to ${releaseGateMarkdownPath}`)
