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
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  noveltySourceIdentityAudit: join(generatedDir, 'novelty-source-identity-audit.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  noveltyRefreshLedger: join(generatedDir, 'novelty-refresh-ledger.json'),
  finalNoveltyAdjudication: join(generatedDir, 'final-novelty-adjudication.json'),
  derivedLabelSuite: join(generatedDir, 'derived-label-suite.json'),
  derivedScaleSuite: join(generatedDir, 'derived-scale-suite.json'),
  goldSummary: join(generatedDir, 'gold-suite-summary.json'),
  annotationProtocol: join(generatedDir, 'annotation-protocol.json'),
  reviewPreflight: join(generatedDir, 'review-preflight.json'),
  reviewOperations: join(generatedDir, 'review-operations.json'),
  reviewTriage: join(generatedDir, 'review-triage.json'),
  annotationAssignments: join(generatedDir, 'annotation-assignments.json'),
  reviewAssignmentAudit: join(generatedDir, 'review-assignment-audit.json'),
  reviewerHandoff: join(generatedDir, 'reviewer-handoff.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  reviewIntakeValidator: join(generatedDir, 'review-intake-validator.json'),
  goldAdjudicationPlan: join(generatedDir, 'gold-adjudication-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  scaleGapLedger: join(generatedDir, 'scale-gap-ledger.json'),
  adjudicationReadiness: join(generatedDir, 'adjudication-readiness.json'),
  annotatorAgreement: join(generatedDir, 'annotator-agreement.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  annotationImportSmoke: join(generatedDir, 'annotation-import-smoke/report.json'),
  annotationImport: join(generatedDir, 'annotation-import/report.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  goldPromotionSmoke: join(generatedDir, 'gold-promotion-smoke/report.json'),
  expansionPromotionSmoke: join(generatedDir, 'expansion-promotion-smoke/report.json'),
  expansionReviewPreflight: join(generatedDir, 'expansion-review-preflight.json'),
  expansionReviewMergeReport: join(generatedDir, 'expansion-review-merge-report.json'),
  reviewMergeReport: join(generatedDir, 'review-merge-report.json'),
  scalePlan: join(generatedDir, 'scale-plan.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  itemQualityAudit: join(generatedDir, 'item-quality-audit.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  failureAtlas: join(generatedDir, 'failure-atlas.json'),
  hypothesisTestMatrix: join(generatedDir, 'hypothesis-test-matrix.json'),
  resultInterpretationGuide: join(generatedDir, 'result-interpretation-guide.json'),
  evidenceSufficiencyAudit: join(generatedDir, 'evidence-sufficiency-audit.json'),
  estimandRegistry: join(generatedDir, 'estimand-registry.json'),
  sensitivityAnalysisPlan: join(generatedDir, 'sensitivity-analysis-plan.json'),
  lookupContrastRegistry: join(generatedDir, 'lookup-contrast-registry.json'),
  statisticalReportingTemplate: join(generatedDir, 'statistical-reporting-template.json'),
  controlAblationPlan: join(generatedDir, 'control-ablation-plan.json'),
  errorCodebook: join(generatedDir, 'error-codebook.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  supplementIndex: join(generatedDir, 'supplement-index.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewerFaq: join(generatedDir, 'reviewer-faq.json'),
  baselineUncertainty: join(generatedDir, 'baseline-uncertainty.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelBaselinePackets: join(generatedDir, 'model-baseline-packets.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  sourceAcquisitionAudit: join(generatedDir, 'source-acquisition-audit.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  sourceLineageLedger: join(generatedDir, 'source-lineage-ledger.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  difficultyMechanismLedger: join(generatedDir, 'difficulty-mechanism-ledger.json'),
  artifactChecklist: join(generatedDir, 'artifact-checklist.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  threatsValidity: join(generatedDir, 'threats-validity.json'),
  licenseReview: join(generatedDir, 'license-review.json'),
  licenseImpact: join(generatedDir, 'license-impact.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  licenseRemediationPlan: join(generatedDir, 'license-remediation-plan.json'),
  licenseRemediatedExpansionCandidates: join(generatedDir, 'license-remediated-expansion-candidates.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
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
  noveltyWatchlist,
  noveltyResolutionMatrix,
  noveltyFinalizationPreflight,
  noveltySourceIdentityAudit,
  noveltySourceReviewPackets,
  noveltyClaimRevisionPlan,
  noveltyLinkAudit,
  noveltyReplacementCandidates,
  noveltyOverlapAdjudication,
  noveltyRefreshLedger,
  finalNoveltyAdjudication,
  derivedLabelSuite,
  derivedScaleSuite,
  goldSummary,
  annotationProtocol,
  reviewPreflight,
  reviewOperations,
  reviewTriage,
  annotationAssignments,
  reviewAssignmentAudit,
  reviewerHandoff,
  reviewProgress,
  reviewExecutionPlan,
  reviewPacketAudit,
  reviewReturnContract,
  reviewReturnPreflight,
  reviewReturnChecklist,
  reviewCollectionTracker,
  reviewWaveSchedule,
  reviewDropoffManifest,
  reviewIntakeValidator,
  goldAdjudicationPlan,
  scaleAdjudicationPlan,
  scaleGapLedger,
  adjudicationReadiness,
  annotatorAgreement,
  expansionReviewPreflight,
  expansionReviewMergeReport,
  reviewMergeReport,
  scalePlan,
  powerPlan,
  itemQualityAudit,
  baselineAnalysis,
  failureAtlas,
  hypothesisTestMatrix,
  resultInterpretationGuide,
  evidenceSufficiencyAudit,
  estimandRegistry,
  sensitivityAnalysisPlan,
  lookupContrastRegistry,
  statisticalReportingTemplate,
  controlAblationPlan,
  errorCodebook,
  paperTables,
  analysisPlan,
  paperClaimLedger,
  supplementIndex,
  citationMetadata,
  reviewerFaq,
  baselineUncertainty,
  modelRunIndex,
  modelBaselinePackets,
  modelReportingCard,
  submissionContract,
  scoringContract,
  corpusAudit,
  sourceDiversityPlan,
  sourceAcquisitionManifest,
  sourceAcquisitionPackets,
  sourceAcquisitionAudit,
  sourceAcquisitionFetchedRows,
  sourceAcquisitionCandidates,
  sourceAcquisitionReviewWorkbooks,
  sourceAcquisitionReviewPreflight,
  sourceLineageLedger,
  constructMap,
  difficultyMechanismLedger,
  artifactChecklist,
  reproductionCapsule,
  versionManifest,
  threatsValidity,
  annotationExport,
  annotationImportSmoke,
  annotationImport,
  reviewCalibration,
  annotationQualityControl,
  goldPromotionSmoke,
  expansionPromotionSmoke,
  licenseReview,
  licenseImpact,
  licenseClearance,
  licenseRemediationPlan,
  licenseRemediatedExpansionCandidates,
  packageManifest,
  publicPackageIntegrity,
  publicPackageSchema,
  responsibleUse,
  dataStatement,
  publicPackageSummary,
  scaledPublicPackageSummary,
}) {
  const licenseBlockers = licenseReview.blockers || []
  const scoredModelRuns = modelRunIndex.eligible_model_baselines || []
  const novelty = noveltyAuditStatus(noveltyAudit, noveltyAuditJson)
  const checks = [
    {
      id: 'hf_derived_label_suite_ready',
      passed:
        Boolean(derivedLabelSuite.derived_label_suite_ready) &&
        derivedLabelSuite.summary?.items === 30 &&
        derivedLabelSuite.summary?.paper_eligible_items === derivedLabelSuite.summary?.items &&
        derivedLabelSuite.summary?.categories === spec.categories.length &&
        derivedLabelSuite.summary?.finding_count === 0,
      detail: `${derivedLabelSuite.version}; ${derivedLabelSuite.summary?.paper_eligible_items ?? 0}/${derivedLabelSuite.summary?.items ?? 0} paper-eligible derived labels; datasets=${derivedLabelSuite.summary?.datasets ?? 0}; findings=${derivedLabelSuite.summary?.finding_count ?? 'unknown'}`,
      blocker: 'Generate HF-derived labels from native dataset supervision and deterministic challenge metadata before relying on reviewer annotation.',
    },
    {
      id: 'gold_review_complete',
      passed: Boolean(goldSummary.gold_ready) || Boolean(derivedLabelSuite.derived_label_suite_ready),
      detail: derivedLabelSuite.derived_label_suite_ready
        ? `${derivedLabelSuite.summary.paper_eligible_items}/${derivedLabelSuite.summary.items} HF-derived gold labels ready; human reviewed=${goldSummary.valid_reviewed_items}/${goldSummary.total_items}`
        : `${goldSummary.valid_reviewed_items}/${goldSummary.total_items} valid reviewed items`,
      blocker: 'Generate HF-derived labels or complete double review before promoting gold labels.',
    },
    {
      id: 'annotation_protocol_present',
      passed: Boolean(annotationProtocol.annotation_protocol_ready),
      detail: `${annotationProtocol.review_scope.pilot_review_rows} pilot review rows; ${annotationProtocol.review_scope.expansion_review_rows} expansion review rows`,
      blocker: 'Generate the reviewer annotation protocol before collecting final review labels.',
    },
    {
      id: 'review_preflight_ready',
      passed: Boolean(reviewPreflight.preflight_ready) || Boolean(derivedLabelSuite.derived_label_suite_ready),
      detail: derivedLabelSuite.derived_label_suite_ready
        ? `HF-derived labels bypass mandatory human-review preflight; optional audit rows=${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows}`
        : `${reviewPreflight.complete_review_rows}/${reviewPreflight.total_review_rows} complete review rows`,
      blocker: 'Generate HF-derived labels or complete reviewer workbook fields until strict review preflight succeeds.',
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
      id: 'review_assignment_audit_ready',
      passed:
        Boolean(reviewAssignmentAudit.review_assignment_audit_ready) &&
        reviewAssignmentAudit.summary?.blocked_assignments === 0 &&
        reviewAssignmentAudit.summary?.completion_claim_allowed === false,
      detail: `${reviewAssignmentAudit.version}; assignments=${reviewAssignmentAudit.summary?.total_assignments ?? 0}; double_review=${reviewAssignmentAudit.summary?.double_review_assignments ?? 'unknown'}; blocked=${reviewAssignmentAudit.summary?.blocked_assignments ?? 'unknown'}`,
      blocker: 'Generate a blind double-review assignment audit before accepting returned labels.',
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
      id: 'review_execution_plan_ready',
      passed:
        Boolean(reviewExecutionPlan.review_execution_plan_ready) &&
        reviewExecutionPlan.summary?.total_rows_remaining === reviewProgress.summary?.reviewed_items_remaining * 2 &&
        reviewExecutionPlan.claim_limits?.completion_claim_allowed === false,
      detail: `${reviewExecutionPlan.version}; rows_remaining=${reviewExecutionPlan.summary?.total_rows_remaining ?? 'unknown'}; reviewer_hours=${reviewExecutionPlan.summary?.reviewer_hours_with_reserve ?? 'unknown'}; blocking_review_checks=${reviewExecutionPlan.summary?.blocking_review_checks ?? 'unknown'}`,
      blocker: 'Generate a review execution plan that turns remaining human-review blockers into a measurable workload.',
    },
    {
      id: 'review_packet_audit_ready',
      passed:
        Boolean(reviewPacketAudit.review_packet_audit_ready) &&
        reviewPacketAudit.summary?.finding_count === 0 &&
        reviewPacketAudit.summary?.rows_checked === reviewProgress.summary?.first_wave_export_rows,
      detail: `${reviewPacketAudit.version}; files=${reviewPacketAudit.summary?.files_checked ?? 0}; rows=${reviewPacketAudit.summary?.rows_checked ?? 0}; findings=${reviewPacketAudit.summary?.finding_count ?? 'unknown'}`,
      blocker: 'Audit the first-wave reviewer packet before collecting returned annotations.',
    },
    {
      id: 'review_return_contract_ready',
      passed:
        Boolean(reviewReturnContract.review_return_contract_ready) &&
        reviewReturnContract.summary?.finding_count === 0 &&
        reviewReturnContract.summary?.expected_return_rows === reviewPacketAudit.summary?.rows_checked,
      detail: `${reviewReturnContract.version}; files=${reviewReturnContract.summary?.expected_return_files ?? 0}; rows=${reviewReturnContract.summary?.expected_return_rows ?? 0}; findings=${reviewReturnContract.summary?.finding_count ?? 'unknown'}`,
      blocker: 'Generate the real returned-reviewer packet contract before accepting annotations.',
    },
    {
      id: 'review_return_preflight_ready',
      passed:
        Boolean(reviewReturnPreflight.review_return_preflight_ready) &&
        reviewReturnPreflight.summary?.expected_return_files === reviewReturnContract.summary?.expected_return_files &&
        reviewReturnPreflight.summary?.expected_return_rows === reviewReturnContract.summary?.expected_return_rows,
      detail: `${reviewReturnPreflight.version}; present=${reviewReturnPreflight.summary?.present_return_files ?? 0}/${reviewReturnPreflight.summary?.expected_return_files ?? 0}; missing=${reviewReturnPreflight.summary?.missing_return_files ?? 'unknown'}; latest_import_ready=${reviewReturnPreflight.summary?.latest_import_ready}`,
      blocker: 'Generate a real-return preflight report before running reviewer import apply.',
    },
    {
      id: 'review_return_checklist_ready',
      passed:
        Boolean(reviewReturnChecklist.review_return_checklist_ready) &&
        reviewReturnChecklist.summary?.packets === reviewReturnContract.summary?.expected_return_files &&
        reviewReturnChecklist.summary?.expected_rows === reviewReturnContract.summary?.expected_return_rows,
      detail: `${reviewReturnChecklist.version}; packets=${reviewReturnChecklist.summary?.packets ?? 0}; rows=${reviewReturnChecklist.summary?.expected_rows ?? 0}; missing=${reviewReturnChecklist.summary?.missing_packets ?? 'unknown'}`,
      blocker: 'Generate a per-packet returned-review checklist before assigning or tracking reviewer returns.',
    },
    {
      id: 'review_collection_tracker_ready',
      passed:
        Boolean(reviewCollectionTracker.review_collection_tracker_ready) &&
        reviewCollectionTracker.summary?.packets === reviewReturnChecklist.summary?.packets &&
        reviewCollectionTracker.summary?.missing_packets === reviewReturnChecklist.summary?.missing_packets &&
        reviewCollectionTracker.summary?.completion_claim_allowed === false,
      detail: `${reviewCollectionTracker.version}; packets=${reviewCollectionTracker.summary?.packets ?? 0}; missing=${reviewCollectionTracker.summary?.missing_packets ?? 'unknown'}; returned=${reviewCollectionTracker.summary?.returned_packets ?? 'unknown'}`,
      blocker: 'Generate a prioritized reviewer-return collection tracker before collecting or applying real labels.',
    },
    {
      id: 'review_wave_schedule_ready',
      passed:
        Boolean(reviewWaveSchedule.review_wave_schedule_ready) &&
        reviewWaveSchedule.summary?.packets === reviewReturnChecklist.summary?.packets &&
        reviewWaveSchedule.summary?.completion_claim_allowed === false,
      detail: `${reviewWaveSchedule.version}; waves=${reviewWaveSchedule.summary?.waves ?? 0}; packets=${reviewWaveSchedule.summary?.packets ?? 0}; missing=${reviewWaveSchedule.summary?.scheduled_missing_packets ?? 'unknown'}`,
      blocker: 'Generate an ordered reviewer-return wave schedule before claiming review collection is operationally ready.',
    },
    {
      id: 'review_dropoff_manifest_ready',
      passed:
        Boolean(reviewDropoffManifest.review_dropoff_manifest_ready) &&
        reviewDropoffManifest.summary?.packets === reviewWaveSchedule.summary?.packets &&
        reviewDropoffManifest.summary?.completion_claim_allowed === false,
      detail: `${reviewDropoffManifest.version}; packets=${reviewDropoffManifest.summary?.packets ?? 0}; hashes=${reviewDropoffManifest.summary?.export_hashes ?? 'unknown'}; rows=${reviewDropoffManifest.summary?.expected_rows ?? 'unknown'}`,
      blocker: 'Generate a reviewer drop-off manifest with export hashes and import acceptance criteria before collecting real labels.',
    },
    {
      id: 'review_intake_validator_ready',
      passed:
        Boolean(reviewIntakeValidator.review_intake_validator_ready) &&
        reviewIntakeValidator.summary?.packets === reviewDropoffManifest.summary?.packets &&
        reviewIntakeValidator.summary?.completion_claim_allowed === false,
      detail: `${reviewIntakeValidator.version}; packets=${reviewIntakeValidator.summary?.packets ?? 0}; accepted=${reviewIntakeValidator.summary?.accepted_packets ?? 'unknown'}; blocked=${reviewIntakeValidator.summary?.blocked_packets ?? 'unknown'}`,
      blocker: 'Generate a packet-level reviewer-return intake validator before applying returned labels.',
    },
    {
      id: 'gold_adjudication_plan_ready',
      passed:
        Boolean(goldAdjudicationPlan.gold_adjudication_plan_ready) &&
        goldAdjudicationPlan.summary?.pilot_items === goldSummary.total_items &&
        goldAdjudicationPlan.summary?.completion_claim_allowed === false,
      detail: `${goldAdjudicationPlan.version}; items=${goldAdjudicationPlan.summary?.pilot_items ?? 0}; missing_reviews=${goldAdjudicationPlan.summary?.missing_reviews ?? 'unknown'}; promotion_ready=${goldAdjudicationPlan.summary?.promotion_ready_items ?? 'unknown'}`,
      blocker: 'Generate an item-level gold adjudication plan before promoting reviewed pilot gold.',
    },
    {
      id: 'scale_adjudication_plan_ready',
      passed:
        Boolean(scaleAdjudicationPlan.scale_adjudication_plan_ready) &&
        scaleAdjudicationPlan.summary?.planned_new_items === scalePlan.planned_new_items &&
        scaleAdjudicationPlan.summary?.completion_claim_allowed === false,
      detail: `${scaleAdjudicationPlan.version}; batches=${scaleAdjudicationPlan.summary?.expansion_batches ?? 0}; missing_review_rows=${scaleAdjudicationPlan.summary?.missing_review_rows ?? 'unknown'}; merge_ready=${scaleAdjudicationPlan.summary?.merge_ready_items ?? 'unknown'}`,
      blocker: 'Generate a batch-level scale adjudication plan before using expansion candidates for category claims.',
    },
    {
      id: 'scale_gap_ledger_ready',
      passed:
        Boolean(scaleGapLedger.scale_gap_ledger_ready) &&
        scaleGapLedger.summary?.reviewed_item_deficit === scalePlan.additional_reviewed_items_needed &&
        scaleGapLedger.summary?.completion_claim_allowed === false,
      detail: `${scaleGapLedger.version}; deficit=${scaleGapLedger.summary?.reviewed_item_deficit ?? 'unknown'}; planned_candidates=${scaleGapLedger.summary?.planned_candidate_items ?? 'unknown'}; planned_review_rows=${scaleGapLedger.summary?.planned_review_rows ?? 'unknown'}`,
      blocker: 'Generate a category-level scale gap ledger before category-level paper claims.',
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
      id: 'annotation_return_readiness_ready',
      passed:
        Boolean(annotationExport.return_readiness?.ready) &&
        annotationExport.return_readiness.expected_files === annotationExport.totals.file_count &&
        annotationExport.return_readiness.expected_rows === annotationExport.totals.row_count,
      detail: `${annotationExport.return_readiness?.expected_files ?? 0} expected returned files; ${annotationExport.return_readiness?.expected_rows ?? 0} expected returned rows`,
      blocker: 'Generate reviewer return-readiness checklist and expected packet counts before collecting labels.',
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
      id: 'review_calibration_ready',
      passed:
        Boolean(reviewCalibration.review_calibration_ready) &&
        reviewCalibration.sentinel_count === spec.categories.length &&
        reviewCalibration.gold_promotion_allowed === false &&
        reviewCalibration.acceptance_policy?.must_pass_before_review_batch_assignment === true,
      detail: `${reviewCalibration.sentinel_count ?? 0} calibration sentinels; minimum_accuracy=${reviewCalibration.acceptance_policy?.minimum_accuracy ?? 'unknown'}; gold_promotion_allowed=${reviewCalibration.gold_promotion_allowed}`,
      blocker: 'Generate reviewer calibration sentinels before assigning paper-scale human review.',
    },
    {
      id: 'annotation_quality_control_ready',
      passed:
        Boolean(annotationQualityControl.annotation_quality_control_ready) &&
        annotationQualityControl.thresholds?.required_reviews_per_item === 2 &&
        annotationQualityControl.thresholds?.allow_sentinel_rows_in_gold === false &&
        annotationQualityControl.completion_claim_allowed === false,
      detail: `${annotationQualityControl.workload?.total_review_rows ?? 0} review rows governed; calibration_sentinels=${annotationQualityControl.workload?.calibration_sentinels ?? 0}; completion_claim_allowed=${annotationQualityControl.completion_claim_allowed}`,
      blocker: 'Generate a pre-registered annotation quality-control policy before collecting paper labels.',
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
      passed: Boolean(expansionReviewPreflight.preflight_ready) || Boolean(derivedLabelSuite.derived_label_suite_ready),
      detail: derivedLabelSuite.derived_label_suite_ready
        ? `HF-derived labels bypass mandatory expansion human-review preflight; optional audit rows=${expansionReviewPreflight.complete_review_rows}/${expansionReviewPreflight.total_review_rows}`
        : `${expansionReviewPreflight.complete_review_rows}/${expansionReviewPreflight.total_review_rows} complete expansion review rows`,
      blocker: 'Generate HF-derived labels for scaled candidates or complete expansion reviewer workbook fields before using scaled candidates for paper claims.',
    },
    {
      id: 'expansion_review_merge_ready',
      passed: Boolean(expansionReviewMergeReport.merge_ready) || Boolean(derivedLabelSuite.derived_label_suite_ready),
      detail: derivedLabelSuite.derived_label_suite_ready
        ? `HF-derived labels bypass mandatory expansion review merge; optional audit merge-ready=${expansionReviewMergeReport.merge_ready_items}/${expansionReviewMergeReport.unique_items}`
        : `${expansionReviewMergeReport.merge_ready_items}/${expansionReviewMergeReport.unique_items} expansion merge-ready items`,
      blocker: 'Generate HF-derived labels for scaled candidates or resolve expansion reviewer disagreement before using scaled candidates for paper claims.',
    },
    {
      id: 'review_merge_ready',
      passed: Boolean(reviewMergeReport.merge_ready) || Boolean(derivedLabelSuite.derived_label_suite_ready),
      detail: derivedLabelSuite.derived_label_suite_ready
        ? `HF-derived labels bypass mandatory human-review merge; optional audit merge-ready=${reviewMergeReport.merge_ready_items}/${reviewMergeReport.unique_items}`
        : `${reviewMergeReport.merge_ready_items}/${reviewMergeReport.unique_items} merge-ready items`,
      blocker: 'Generate HF-derived labels or fill reviewer workbooks until strict review merge succeeds.',
    },
    {
      id: 'category_scale_ready',
      passed: Boolean(scalePlan.scale_ready) && Boolean(derivedScaleSuite.derived_scale_suite_ready),
      detail: `${scalePlan.current_hf_derived_items}/${scalePlan.total_target_hf_derived_items} HF-derived paper-eligible items; ${scalePlan.additional_hf_derived_items_needed} still needed; ${derivedScaleSuite.summary.ready_categories}/${derivedScaleSuite.summary.categories} categories ready`,
      blocker: 'Scale each category to the target HF-derived label count before paper release.',
    },
    {
      id: 'power_plan_ready',
      passed:
        Boolean(powerPlan.power_plan_ready) &&
        powerPlan.assumptions?.target_reviewed_items_per_category === scalePlan.target_reviewed_items_per_category &&
        powerPlan.assumptions?.target_reviewed_items_total === scalePlan.total_target_reviewed_items,
      detail: `${powerPlan.assumptions?.target_reviewed_items_per_category ?? 'unknown'} reviewed items/category; ${powerPlan.assumptions?.target_reviewed_items_total ?? 'unknown'} total target; remaining=${powerPlan.current_state?.reviewed_items_remaining ?? 'unknown'}`,
      blocker: 'Generate a statistical scale and sensitivity plan for paper-size category claims.',
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
      id: 'public_package_integrity_ready',
      passed:
        Boolean(publicPackageIntegrity.public_package_integrity_ready) &&
        publicPackageIntegrity.summary?.pointer_only_text_leaks === 0 &&
        publicPackageIntegrity.summary?.findings === 0,
      detail: `${publicPackageIntegrity.version}; suites=${publicPackageIntegrity.summary?.suites_checked ?? 0}; items=${publicPackageIntegrity.summary?.total_items ?? 0}; findings=${publicPackageIntegrity.summary?.findings ?? 'unknown'}; pointer_text_leaks=${publicPackageIntegrity.summary?.pointer_only_text_leaks ?? 'unknown'}`,
      blocker: 'Run public package integrity checks before sharing JSON or JSONL package artifacts.',
    },
    {
      id: 'public_package_schema_ready',
      passed:
        Boolean(publicPackageSchema.public_package_schema_ready) &&
        publicPackageSchema.summary?.schema_violations === 0 &&
        Boolean(publicPackageIntegrity.public_package_integrity_ready),
      detail: `${publicPackageSchema.version}; suites=${publicPackageSchema.summary?.suites_checked ?? 0}; items=${publicPackageSchema.summary?.items_checked ?? 0}; evidence_units=${publicPackageSchema.summary?.evidence_units_checked ?? 0}; schema_violations=${publicPackageSchema.summary?.schema_violations ?? 'unknown'}`,
      blocker: 'Run public package schema checks before downstream evaluator release.',
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
      id: 'failure_atlas_ready',
      passed:
        Boolean(failureAtlas.failure_atlas_ready) &&
        failureAtlas.summary?.failure_case_count > 0 &&
        failureAtlas.summary?.completion_claim_allowed === false,
      detail: `${failureAtlas.summary?.failure_case_count ?? 0} failure cases; ${failureAtlas.summary?.failure_mode_count ?? 0} failure modes; systems=${failureAtlas.summary?.scored_systems ?? 0}`,
      blocker: 'Generate a qualitative failure atlas from scored pilot reports while keeping paper claims gated.',
    },
    {
      id: 'hypothesis_test_matrix_ready',
      passed:
        Boolean(hypothesisTestMatrix.hypothesis_test_matrix_ready) &&
        hypothesisTestMatrix.summary?.categories === spec.categories.length &&
        hypothesisTestMatrix.summary?.observed_failure_cases === failureAtlas.summary?.failure_case_count &&
        hypothesisTestMatrix.summary?.completion_claim_allowed === false,
      detail: `${hypothesisTestMatrix.version}; hypotheses=${hypothesisTestMatrix.summary?.hypotheses ?? 0}; observed_signature_categories=${hypothesisTestMatrix.summary?.categories_with_observed_expected_failure_modes ?? 0}; reviewed_deficit=${hypothesisTestMatrix.summary?.reviewed_item_deficit ?? 'unknown'}`,
      blocker: 'Generate a hypothesis-test matrix that links difficulty mechanisms to measurable model-failure predictions and claim gates.',
    },
    {
      id: 'result_interpretation_guide_ready',
      passed:
        Boolean(resultInterpretationGuide.result_interpretation_guide_ready) &&
        resultInterpretationGuide.summary?.categories === hypothesisTestMatrix.summary?.categories &&
        resultInterpretationGuide.summary?.completion_claim_allowed === false,
      detail: `${resultInterpretationGuide.version}; rules=${resultInterpretationGuide.summary?.interpretation_rules ?? 0}; target_n=${resultInterpretationGuide.summary?.reviewed_items_total_target ?? 'unknown'}; blocked_gates=${resultInterpretationGuide.summary?.blocked_claim_gates ?? 'unknown'}`,
      blocker: 'Generate result interpretation rules before using reviewed results as mechanism evidence.',
    },
    {
      id: 'evidence_sufficiency_audit_ready',
      passed:
        Boolean(evidenceSufficiencyAudit.evidence_sufficiency_audit_ready) &&
        evidenceSufficiencyAudit.summary?.pilot_items === spec.categories.length * 3 &&
        evidenceSufficiencyAudit.summary?.completion_claim_allowed === false,
      detail: `${evidenceSufficiencyAudit.version}; items=${evidenceSufficiencyAudit.summary?.pilot_items ?? 0}; evidence_contracts=${evidenceSufficiencyAudit.summary?.items_with_required_evidence_contract ?? 0}; insufficiency=${evidenceSufficiencyAudit.summary?.insufficiency_items ?? 0}; overreach=${evidenceSufficiencyAudit.summary?.citation_overreach_items ?? 0}`,
      blocker: 'Generate item-level evidence sufficiency contracts before claiming the categories isolate grounded-research failure mechanisms.',
    },
    {
      id: 'estimand_registry_ready',
      passed:
        Boolean(estimandRegistry.estimand_registry_ready) &&
        estimandRegistry.summary?.estimands === hypothesisTestMatrix.summary?.categories &&
        estimandRegistry.summary?.completion_claim_allowed === false,
      detail: `${estimandRegistry.version}; estimands=${estimandRegistry.summary?.estimands ?? 0}; target_n=${estimandRegistry.summary?.target_reviewed_items_total ?? 'unknown'}; blocked_gates=${estimandRegistry.summary?.blocked_claim_gates ?? 'unknown'}`,
      blocker: 'Generate a statistical estimand registry before treating category hypotheses as paper-ready analysis claims.',
    },
    {
      id: 'sensitivity_analysis_plan_ready',
      passed:
        Boolean(sensitivityAnalysisPlan.sensitivity_analysis_plan_ready) &&
        sensitivityAnalysisPlan.summary?.sensitivity_checks >= 6 &&
        sensitivityAnalysisPlan.summary?.completion_claim_allowed === false,
      detail: `${sensitivityAnalysisPlan.version}; checks=${sensitivityAnalysisPlan.summary?.sensitivity_checks ?? 0}; metrics=${sensitivityAnalysisPlan.summary?.required_metrics ?? 'unknown'}; blocked_gates=${sensitivityAnalysisPlan.summary?.blocked_claim_gates ?? 'unknown'}`,
      blocker: 'Generate a sensitivity analysis plan before interpreting benchmark result claims as robust.',
    },
    {
      id: 'lookup_contrast_registry_ready',
      passed:
        Boolean(lookupContrastRegistry.lookup_contrast_registry_ready) &&
        lookupContrastRegistry.summary?.categories === spec.categories.length &&
        lookupContrastRegistry.summary?.completion_claim_allowed === false,
      detail: `${lookupContrastRegistry.version}; categories=${lookupContrastRegistry.summary?.categories ?? 0}; lookup_controls=${lookupContrastRegistry.summary?.lookup_controls ?? 0}; estimand_links=${lookupContrastRegistry.summary?.estimand_links ?? 0}`,
      blocker: 'Generate a lookup contrast registry before claiming the tasks are hard beyond simple fact lookup.',
    },
    {
      id: 'statistical_reporting_template_ready',
      passed:
        Boolean(statisticalReportingTemplate.statistical_reporting_template_ready) &&
        statisticalReportingTemplate.summary?.categories === spec.categories.length &&
        statisticalReportingTemplate.summary?.required_table_sections >= 4 &&
        statisticalReportingTemplate.summary?.completion_claim_allowed === false,
      detail: `${statisticalReportingTemplate.version}; categories=${statisticalReportingTemplate.summary?.categories ?? 0}; table_sections=${statisticalReportingTemplate.summary?.required_table_sections ?? 0}; blocked_gates=${statisticalReportingTemplate.summary?.blocked_claim_gates ?? 'unknown'}`,
      blocker: 'Generate a statistical reporting template before treating reviewed results as paper-ready tables.',
    },
    {
      id: 'control_ablation_plan_ready',
      passed:
        Boolean(controlAblationPlan.control_ablation_plan_ready) &&
        controlAblationPlan.summary?.categories === spec.categories.length &&
        controlAblationPlan.summary?.negative_controls === spec.categories.length &&
        controlAblationPlan.summary?.completion_claim_allowed === false,
      detail: `${controlAblationPlan.version}; categories=${controlAblationPlan.summary?.categories ?? 0}; negative_controls=${controlAblationPlan.summary?.negative_controls ?? 0}; ablations=${controlAblationPlan.summary?.ablation_conditions ?? 0}`,
      blocker: 'Generate negative controls and ablations before attributing benchmark failures to the intended hard-grounding mechanisms.',
    },
    {
      id: 'error_codebook_ready',
      passed:
        Boolean(errorCodebook.error_codebook_ready) &&
        errorCodebook.summary?.code_count >= failureAtlas.summary?.failure_mode_count &&
        errorCodebook.summary?.completion_claim_allowed === false,
      detail: `${errorCodebook.version}; codes=${errorCodebook.summary?.code_count ?? 0}; categories=${errorCodebook.summary?.categories ?? 0}; observed_cases=${errorCodebook.summary?.observed_failure_cases ?? 0}`,
      blocker: 'Generate qualitative error-code definitions and reviewer coding rules before using failure modes in the paper.',
    },
    {
      id: 'paper_tables_ready',
      passed:
        Boolean(paperTables.paper_tables_ready) &&
        paperTables.summary?.table_count >= 6 &&
        paperTables.summary?.completion_claim_allowed === false,
      detail: `${paperTables.summary?.table_count ?? 0} paper tables; systems=${paperTables.summary?.scored_systems ?? 0}; blockers=${paperTables.summary?.release_blockers ?? 0}`,
      blocker: 'Generate synchronized paper tables and figure data from canonical benchmark artifacts.',
    },
    {
      id: 'analysis_plan_ready',
      passed:
        Boolean(analysisPlan.analysis_plan_ready) &&
        analysisPlan.summary?.hypotheses >= 4 &&
        analysisPlan.summary?.completion_claim_allowed === false,
      detail: `${analysisPlan.summary?.hypotheses ?? 0} hypotheses; ${analysisPlan.summary?.model_families ?? 0} model families; HF-derived=${analysisPlan.summary?.hf_derived_items_current ?? 0}/${analysisPlan.summary?.hf_derived_items_target ?? 0}`,
      blocker: 'Generate a statistical analysis plan that pre-specifies hypotheses, contrasts, covariates, and claim gates.',
    },
    {
      id: 'paper_claim_ledger_ready',
      passed:
        Boolean(paperClaimLedger.paper_claim_ledger_ready) &&
        paperClaimLedger.completion_claim_allowed === false &&
        paperClaimLedger.summary?.prohibited_claims >= 1,
      detail: `${paperClaimLedger.summary?.claims ?? 0} claims; allowed=${paperClaimLedger.summary?.allowed_claims ?? 0}; diagnostic=${paperClaimLedger.summary?.diagnostic_only_claims ?? 0}; prohibited=${paperClaimLedger.summary?.prohibited_claims ?? 0}`,
      blocker: 'Generate a paper claim ledger that binds manuscript claims to current release evidence and blockers.',
    },
    {
      id: 'supplement_index_ready',
      passed:
        Boolean(supplementIndex.supplement_index_ready) &&
        supplementIndex.summary?.paper_tables === paperTables.summary?.table_count &&
        supplementIndex.summary?.claims === paperClaimLedger.summary?.claims &&
        supplementIndex.summary?.completion_claim_allowed === false,
      detail: `${supplementIndex.version}; sections=${supplementIndex.summary?.sections ?? 0}; tables=${supplementIndex.summary?.paper_tables ?? 0}; claims=${supplementIndex.summary?.claims ?? 0}`,
      blocker: 'Generate a reviewer-facing supplement index before submitting the benchmark paper package.',
    },
    {
      id: 'reproduction_capsule_ready',
      passed:
        Boolean(reproductionCapsule.reproduction_capsule_ready) &&
        reproductionCapsule.summary?.validation_commands >= 3 &&
        reproductionCapsule.claim_limits?.completion_claim_allowed === false,
      detail: `${reproductionCapsule.version}; commands=${reproductionCapsule.summary?.reproduction_commands ?? 0}; hashes=${reproductionCapsule.summary?.artifact_hashes ?? 0}; blockers=${reproductionCapsule.summary?.release_blockers ?? 'unknown'}`,
      blocker: 'Generate a start-here reproduction capsule before sending the benchmark package to reviewers.',
    },
    {
      id: 'citation_metadata_ready',
      passed:
        Boolean(citationMetadata.citation_metadata_ready) &&
        citationMetadata.summary?.completion_claim_allowed === false &&
        citationMetadata.citation_caveats?.length >= 4,
      detail: `${citationMetadata.version}; artifact_hashes=${citationMetadata.summary?.artifact_hashes ?? 0}; caveats=${citationMetadata.summary?.citation_caveats ?? 0}; release_blockers=${citationMetadata.summary?.release_blockers ?? 'unknown'}`,
      blocker: 'Generate package citation metadata before sharing benchmark artifacts outside the repository.',
    },
    {
      id: 'reviewer_faq_ready',
      passed:
        Boolean(reviewerFaq.reviewer_faq_ready) &&
        reviewerFaq.summary?.questions >= 6 &&
        reviewerFaq.summary?.completion_claim_allowed === false,
      detail: `${reviewerFaq.version}; questions=${reviewerFaq.summary?.questions ?? 0}; blockers=${reviewerFaq.summary?.release_blockers ?? 'unknown'}; prohibited_claims=${reviewerFaq.summary?.prohibited_claims ?? 'unknown'}`,
      blocker: 'Generate a reviewer-facing FAQ that answers likely paper objections from current artifacts.',
    },
    {
      id: 'responsible_use_ready',
      passed:
        Boolean(responsibleUse.responsible_use_ready) &&
        responsibleUse.public_leaderboard_allowed === false &&
        responsibleUse.completion_claim_allowed === false,
      detail: `${responsibleUse.summary?.policy_rules ?? 0} policy rules; active_restrictions=${responsibleUse.summary?.active_restrictions ?? 0}; public_leaderboard_allowed=${responsibleUse.public_leaderboard_allowed}`,
      blocker: 'Generate a responsible-use and leaderboard policy before publishing benchmark artifacts.',
    },
    {
      id: 'data_statement_ready',
      passed:
        Boolean(dataStatement.data_statement_ready) &&
        dataStatement.package_policy?.public_redistribution_clearance_ready === true &&
        dataStatement.summary?.completion_claim_allowed === false,
      detail: `${dataStatement.version}; source_datasets=${dataStatement.summary?.source_dataset_count ?? 0}; scaled_items=${dataStatement.composition?.scaled_public_items ?? 0}; pointer_only_items=${dataStatement.package_policy?.pointer_only_items ?? 0}`,
      blocker: 'Generate a package-facing data statement before publishing benchmark artifacts.',
    },
    {
      id: 'model_baseline_packets_present',
      passed: Boolean(modelBaselinePackets.packets_ready),
      detail: `${modelBaselinePackets.packet_count} prompt packets; scored_reports_ready=${modelBaselinePackets.scored_reports_ready}`,
      blocker: 'Generate reproducible prompt packets for at least two non-fixture model baselines.',
    },
    {
      id: 'model_reporting_card_ready',
      passed:
        Boolean(modelReportingCard.model_reporting_card_ready) &&
        modelReportingCard.claim_limits?.public_leaderboard_allowed === false &&
        modelReportingCard.claim_limits?.completion_claim_allowed === false &&
        modelReportingCard.required_reporting_fields?.includes('prompt_packet_hash_or_manifest') &&
        modelReportingCard.required_reporting_fields?.includes('scoring_contract_version'),
      detail: `${modelReportingCard.version}; systems=${modelReportingCard.summary?.systems_reported ?? 0}; eligible=${modelReportingCard.summary?.eligible_model_baselines ?? 0}; leaderboard_allowed=${modelReportingCard.claim_limits?.public_leaderboard_allowed}`,
      blocker: 'Generate a model reporting card before publishing or comparing model results.',
    },
    {
      id: 'submission_contract_ready',
      passed:
        Boolean(submissionContract.submission_contract_ready) &&
        submissionContract.public_leaderboard_allowed === false &&
        submissionContract.schema?.answer_required_fields?.includes('task_id') &&
        submissionContract.schema?.answer_required_fields?.includes('evidence_assessment'),
      detail: `${submissionContract.version}; pilot_tasks=${submissionContract.scoring_sources?.pilot?.task_count ?? 0}; leaderboard_allowed=${submissionContract.public_leaderboard_allowed}`,
      blocker: 'Generate an external model submission schema and validation policy before accepting model results.',
    },
    {
      id: 'scoring_contract_ready',
      passed:
        Boolean(scoringContract.scoring_contract_ready) &&
        scoringContract.claim_limits?.public_leaderboard_allowed === false &&
        scoringContract.claim_limits?.completion_claim_allowed === false &&
        scoringContract.required_metric_ids?.includes('citation_faithfulness') &&
        scoringContract.required_metric_ids?.includes('abstention_quality'),
      detail: `${scoringContract.version}; metrics=${scoringContract.summary?.metric_count ?? 0}; required=${scoringContract.summary?.required_metric_count ?? 0}/${scoringContract.required_metric_ids?.length ?? 0}; leaderboard_allowed=${scoringContract.claim_limits?.public_leaderboard_allowed}`,
      blocker: 'Generate metric formulas, aggregation rules, and claim limits before accepting scored model submissions.',
    },
    {
      id: 'novelty_audit_final',
      passed: !novelty.preliminary && novelty.completion_claim_allowed,
      detail: `checked=${novelty.checked_date || 'unknown'} status=${noveltyAuditJson.status || 'unknown'} completion_claim_allowed=${novelty.completion_claim_allowed} high_risk_categories=${novelty.high_novelty_risk_categories ?? 'unknown'}`,
      blocker: 'Refresh the June 2026 literature scan and replace the preliminary novelty gate before claiming completion.',
    },
    {
      id: 'novelty_refresh_ledger_ready',
      passed:
        noveltyAuditJson.refresh_summary?.checked_date === novelty.checked_date &&
        noveltyAuditJson.refresh_summary?.query_count >= 4 &&
        noveltyAuditJson.refresh_summary?.related_source_count >= 8 &&
        noveltyAuditJson.refresh_summary?.completion_claim_allowed === false,
      detail: `${noveltyAuditJson.refresh_summary?.query_count ?? 0} refresh queries; ${noveltyAuditJson.refresh_summary?.related_source_count ?? 0} related sources; completion_claim_allowed=${noveltyAuditJson.refresh_summary?.completion_claim_allowed}`,
      blocker: 'Record a current June 2026 novelty refresh ledger before using the benchmark paper draft.',
    },
    {
      id: 'novelty_evidence_registry_present',
      passed: noveltyEvidence.source_count >= 5 && noveltyEvidence.completion_claim_allowed === false,
      detail: `${noveltyEvidence.source_count} related-work sources registered; completion_claim_allowed=${noveltyEvidence.completion_claim_allowed}`,
      blocker: 'Generate a source-backed related-work registry while keeping final novelty claims gated.',
    },
    {
      id: 'novelty_claim_boundaries_ready',
      passed:
        Array.isArray(noveltyEvidence.search_queries) &&
        noveltyEvidence.search_queries.length >= 5 &&
        Array.isArray(noveltyEvidence.claim_boundaries) &&
        noveltyEvidence.allowed_claim_count >= 1 &&
        noveltyEvidence.prohibited_claim_count >= 3 &&
        noveltyEvidence.completion_claim_allowed === false,
      detail: `${noveltyEvidence.search_queries?.length ?? 0} search queries; ${noveltyEvidence.allowed_claim_count ?? 0} allowed claims; ${noveltyEvidence.prohibited_claim_count ?? 0} prohibited/unsupported claims`,
      blocker: 'Record explicit novelty search provenance and paper claim boundaries before submission.',
    },
    {
      id: 'novelty_watchlist_ready',
      passed:
        Boolean(noveltyWatchlist.novelty_watchlist_ready) &&
        noveltyWatchlist.summary?.watchlist_source_count >= 4 &&
        noveltyWatchlist.summary?.completion_claim_allowed === false,
      detail: `${noveltyWatchlist.version}; sources=${noveltyWatchlist.summary?.watchlist_source_count ?? 0}; high_risk=${noveltyWatchlist.summary?.high_risk_source_count ?? 0}; completion_claim_allowed=${noveltyWatchlist.summary?.completion_claim_allowed}`,
      blocker: 'Record live-search novelty watchlist sources before final novelty adjudication.',
    },
    {
      id: 'novelty_resolution_matrix_ready',
      passed:
        Boolean(noveltyResolutionMatrix.novelty_resolution_matrix_ready) &&
        noveltyResolutionMatrix.summary?.watchlist_sources === noveltyWatchlist.summary?.watchlist_source_count &&
        noveltyResolutionMatrix.summary?.completion_claim_allowed === false,
      detail: `${noveltyResolutionMatrix.version}; sources=${noveltyResolutionMatrix.summary?.watchlist_sources ?? 0}; unresolved=${noveltyResolutionMatrix.summary?.unresolved_sources ?? 'unknown'}; high_risk=${noveltyResolutionMatrix.summary?.high_risk_sources ?? 'unknown'}`,
      blocker: 'Generate a source-level novelty resolution matrix before the final literature audit.',
    },
    {
      id: 'novelty_finalization_preflight_ready',
      passed:
        Boolean(noveltyFinalizationPreflight.novelty_finalization_preflight_ready) &&
        noveltyFinalizationPreflight.summary?.watchlist_sources === noveltyWatchlist.summary?.watchlist_source_count &&
        noveltyFinalizationPreflight.summary?.unresolved_sources === noveltyResolutionMatrix.summary?.unresolved_sources &&
        noveltyFinalizationPreflight.summary?.invalid_or_unverified_sources === noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources &&
        noveltyFinalizationPreflight.summary?.completion_claim_allowed === false,
      detail: `${noveltyFinalizationPreflight.version}; unresolved=${noveltyFinalizationPreflight.summary?.unresolved_sources ?? 'unknown'}; high_risk_unresolved=${noveltyFinalizationPreflight.summary?.high_risk_unresolved_sources ?? 'unknown'}; final_allowed=${noveltyFinalizationPreflight.summary?.final_novelty_claim_allowed}`,
      blocker: 'Generate a final-novelty preflight that enumerates unresolved related-work conditions before the final audit.',
    },
    {
      id: 'novelty_source_identity_audit_ready',
      passed:
        Boolean(noveltySourceIdentityAudit.novelty_source_identity_audit_ready) &&
        noveltySourceIdentityAudit.summary?.watchlist_sources === noveltyWatchlist.summary?.watchlist_source_count &&
        noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources > 0 &&
        noveltySourceIdentityAudit.summary?.completion_claim_allowed === false,
      detail: `${noveltySourceIdentityAudit.version}; verified=${noveltySourceIdentityAudit.summary?.identity_verified_sources ?? 0}/${noveltySourceIdentityAudit.summary?.watchlist_sources ?? 0}; invalid_or_unverified=${noveltySourceIdentityAudit.summary?.invalid_or_unverified_sources ?? 'unknown'}`,
      blocker: 'Verify live novelty watchlist source identity before final related-work adjudication.',
    },
    {
      id: 'novelty_source_review_packets_ready',
      passed:
        Boolean(noveltySourceReviewPackets.novelty_source_review_packets_ready) &&
        noveltySourceReviewPackets.summary?.packets === noveltyResolutionMatrix.summary?.unresolved_sources &&
        noveltySourceReviewPackets.summary?.completion_claim_allowed === false,
      detail: `${noveltySourceReviewPackets.version}; packets=${noveltySourceReviewPackets.summary?.packets ?? 0}; high_risk=${noveltySourceReviewPackets.summary?.high_risk_packets ?? 'unknown'}; final_allowed=${noveltySourceReviewPackets.summary?.final_novelty_claim_allowed}`,
      blocker: 'Generate source-level novelty review packets before resolving the final novelty audit.',
    },
    {
      id: 'novelty_claim_revision_plan_ready',
      passed:
        Boolean(noveltyClaimRevisionPlan.novelty_claim_revision_plan_ready) &&
        noveltyClaimRevisionPlan.summary?.revisions === noveltySourceReviewPackets.summary?.packets &&
        noveltyClaimRevisionPlan.summary?.completion_claim_allowed === false,
      detail: `${noveltyClaimRevisionPlan.version}; revisions=${noveltyClaimRevisionPlan.summary?.revisions ?? 0}; high_risk=${noveltyClaimRevisionPlan.summary?.high_risk_revisions ?? 'unknown'}; linked_claims=${noveltyClaimRevisionPlan.summary?.linked_claims ?? 'unknown'}`,
      blocker: 'Generate a claim-level revision plan for unresolved novelty packets before resolving the final novelty audit.',
    },
    {
      id: 'novelty_link_audit_ready',
      passed:
        Boolean(noveltyLinkAudit.novelty_link_audit_ready) &&
        noveltyLinkAudit.summary?.checked_sources === noveltySourceReviewPackets.summary?.packets &&
        noveltyLinkAudit.summary?.completion_claim_allowed === false,
      detail: `${noveltyLinkAudit.version}; checked=${noveltyLinkAudit.summary?.checked_sources ?? 0}; quarantined=${noveltyLinkAudit.summary?.quarantined_sources ?? 'unknown'}; title_mismatches=${noveltyLinkAudit.summary?.title_mismatches ?? 'unknown'}`,
      blocker: 'Generate a link audit that quarantines invalid or unverified novelty watchlist URLs before final novelty adjudication.',
    },
    {
      id: 'novelty_replacement_candidates_ready',
      passed:
        Boolean(noveltyReplacementCandidates.novelty_replacement_candidates_ready) &&
        noveltyReplacementCandidates.summary?.covered_quarantined_sources === noveltyLinkAudit.summary?.quarantined_sources &&
        noveltyReplacementCandidates.summary?.completion_claim_allowed === false,
      detail: `${noveltyReplacementCandidates.version}; candidates=${noveltyReplacementCandidates.summary?.candidates ?? 0}; verified=${noveltyReplacementCandidates.summary?.verified_title_match_candidates ?? 'unknown'}; covered_quarantined=${noveltyReplacementCandidates.summary?.covered_quarantined_sources ?? 'unknown'}`,
      blocker: 'Generate verified replacement candidates for quarantined novelty sources before final related-work adjudication.',
    },
    {
      id: 'novelty_overlap_adjudication_ready',
      passed:
        Boolean(noveltyOverlapAdjudication.novelty_overlap_adjudication_ready) &&
        noveltyOverlapAdjudication.summary?.candidates === noveltyReplacementCandidates.summary?.candidates &&
        noveltyOverlapAdjudication.summary?.completion_claim_allowed === false,
      detail: `${noveltyOverlapAdjudication.version}; candidates=${noveltyOverlapAdjudication.summary?.candidates ?? 0}; high_overlap=${noveltyOverlapAdjudication.summary?.high_overlap_candidates ?? 'unknown'}; pending=${noveltyOverlapAdjudication.summary?.pending_dispositions ?? 'unknown'}`,
      blocker: 'Generate an overlap adjudication worksheet for verified related-work candidates before final novelty audit.',
    },
    {
      id: 'novelty_refresh_ledger_ready',
      passed:
        Boolean(noveltyRefreshLedger.novelty_refresh_ledger_ready) &&
        noveltyRefreshLedger.summary?.source_count >= 8 &&
        noveltyRefreshLedger.summary?.completion_claim_allowed === false &&
        noveltyRefreshLedger.summary?.final_novelty_claim_allowed === false,
      detail: `${noveltyRefreshLedger.version}; sources=${noveltyRefreshLedger.summary?.source_count ?? 0}; high_overlap_categories=${noveltyRefreshLedger.summary?.high_overlap_categories ?? 'unknown'}; final_allowed=${noveltyRefreshLedger.summary?.final_novelty_claim_allowed}`,
      blocker: 'Generate and adjudicate a June 2026 novelty refresh ledger before final novelty claims.',
    },
    {
      id: 'final_novelty_adjudication_ready',
      passed:
        Boolean(finalNoveltyAdjudication.final_novelty_adjudication_ready) &&
        finalNoveltyAdjudication.summary?.refreshed_sources === noveltyRefreshLedger.summary?.source_count &&
        finalNoveltyAdjudication.summary?.replacement_candidate_sources === noveltyOverlapAdjudication.summary?.candidates &&
        finalNoveltyAdjudication.summary?.high_overlap_rows >= noveltyRefreshLedger.summary?.high_overlap_categories &&
        finalNoveltyAdjudication.summary?.completion_claim_allowed === false &&
        finalNoveltyAdjudication.summary?.final_novelty_claim_allowed === false,
      detail: `${finalNoveltyAdjudication.version}; rows=${finalNoveltyAdjudication.summary?.adjudication_rows ?? 0}; high_overlap=${finalNoveltyAdjudication.summary?.high_overlap_rows ?? 'unknown'}; final_allowed=${finalNoveltyAdjudication.summary?.final_novelty_claim_allowed}`,
      blocker: 'Generate source-by-source final novelty adjudication boundaries before replacing the preliminary novelty audit.',
    },
    {
      id: 'corpus_audit_ready',
      passed: Boolean(corpusAudit.corpus_audit_ready) && Boolean(corpusAudit.summary.package_policy_matches_summaries),
      detail: `${corpusAudit.summary.source_dataset_count} source datasets; ${corpusAudit.summary.scaled_public_items} scaled public items; ${corpusAudit.summary.scaled_public_evidence_units} scaled evidence units; pointer_only=${corpusAudit.summary.scaled_public_pointer_only_evidence_units}`,
      blocker: 'Generate a corpus audit that makes large-corpus grounding, coverage, and packaging scope inspectable.',
    },
    {
      id: 'source_diversity_plan_ready',
      passed:
        Boolean(sourceDiversityPlan.source_diversity_plan_ready) &&
        sourceDiversityPlan.summary?.source_row_deficit_total > 0 &&
        sourceDiversityPlan.summary?.completion_claim_allowed === false,
      detail: `${sourceDiversityPlan.summary?.current_distinct_source_rows ?? 0}/${sourceDiversityPlan.summary?.target_distinct_source_rows_total ?? 0} target source rows; deficit=${sourceDiversityPlan.summary?.source_row_deficit_total ?? 0}`,
      blocker: 'Generate a source-diversity plan that prevents large-corpus claims from relying on cloned seed rows.',
    },
    {
      id: 'source_acquisition_manifest_ready',
      passed:
        Boolean(sourceAcquisitionManifest.source_acquisition_manifest_ready) &&
        sourceAcquisitionManifest.summary?.target_new_distinct_source_rows === sourceDiversityPlan.summary?.source_row_deficit_total &&
        sourceAcquisitionManifest.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionManifest.summary?.acquisition_batches ?? 0} batches; target_rows=${sourceAcquisitionManifest.summary?.target_new_distinct_source_rows ?? 0}; known_license_rows=${sourceAcquisitionManifest.summary?.known_license_target_rows ?? 0}`,
      blocker: 'Generate a source acquisition manifest that turns source-diversity deficits into concrete Hugging Face sampling batches.',
    },
    {
      id: 'source_acquisition_packets_ready',
      passed:
        Boolean(sourceAcquisitionPackets.source_acquisition_packets_ready) &&
        sourceAcquisitionPackets.summary?.target_new_distinct_source_rows === sourceAcquisitionManifest.summary?.target_new_distinct_source_rows &&
        sourceAcquisitionPackets.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionPackets.summary?.packet_count ?? 0} packets; target_rows=${sourceAcquisitionPackets.summary?.target_new_distinct_source_rows ?? 0}`,
      blocker: 'Generate executable source acquisition packet JSONL files for the Hugging Face sampling batches.',
    },
    {
      id: 'source_acquisition_audit_ready',
      passed:
        Boolean(sourceAcquisitionAudit.source_acquisition_audit_ready) &&
        sourceAcquisitionAudit.summary?.finding_count === 0 &&
        sourceAcquisitionAudit.summary?.audited_rows === sourceAcquisitionPackets.summary?.target_new_distinct_source_rows &&
        sourceAcquisitionAudit.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionAudit.summary?.audited_rows ?? 0}/${sourceAcquisitionAudit.summary?.expected_rows ?? 0} packet rows audited; findings=${sourceAcquisitionAudit.summary?.finding_count ?? 0}`,
      blocker: 'Audit source acquisition packet JSONL files against the manifest before using them for corpus expansion.',
    },
    {
      id: 'source_acquisition_fetch_report_ready',
      passed:
        Boolean(sourceAcquisitionFetchedRows.source_acquisition_fetch_report_ready) &&
        sourceAcquisitionFetchedRows.summary?.fetched_rows > 0 &&
        sourceAcquisitionFetchedRows.summary?.requested_rows === sourceAcquisitionPackets.summary?.target_new_distinct_source_rows &&
        sourceAcquisitionFetchedRows.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionFetchedRows.summary?.fetched_rows ?? 0}/${sourceAcquisitionFetchedRows.summary?.requested_rows ?? 0} rows fetched; findings=${sourceAcquisitionFetchedRows.summary?.finding_count ?? 0}; full_ready=${sourceAcquisitionFetchedRows.source_acquisition_fetch_ready}`,
      blocker: 'Run the Hugging Face source acquisition fetch report before rebalancing or materializing expansion candidates.',
    },
    {
      id: 'source_acquisition_fetch_full_ready',
      passed:
        Boolean(sourceAcquisitionFetchedRows.source_acquisition_fetch_ready) &&
        sourceAcquisitionFetchedRows.summary?.fetched_rows === sourceAcquisitionPackets.summary?.target_new_distinct_source_rows &&
        sourceAcquisitionFetchedRows.summary?.distinct_source_rows === sourceAcquisitionFetchedRows.summary?.requested_rows &&
        sourceAcquisitionFetchedRows.summary?.finding_count === 0 &&
        sourceAcquisitionFetchedRows.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionFetchedRows.summary?.distinct_source_rows ?? 0}/${sourceAcquisitionFetchedRows.summary?.requested_rows ?? 0} distinct fetched source rows; known_license=${sourceAcquisitionFetchedRows.summary?.known_license_rows ?? 0}; pointer_only=${sourceAcquisitionFetchedRows.summary?.pointer_only_rows ?? 0}`,
      blocker: 'Rebalance acquisition batches until all target Hugging Face source rows fetch with no underfilled batches.',
    },
    {
      id: 'source_acquisition_candidates_ready',
      passed:
        Boolean(sourceAcquisitionCandidates.source_acquisition_candidates_ready) &&
        sourceAcquisitionCandidates.summary?.candidates === sourceAcquisitionFetchedRows.summary?.fetched_rows &&
        sourceAcquisitionCandidates.summary?.categories === spec.categories.length &&
        sourceAcquisitionCandidates.summary?.completion_claim_allowed === false,
      detail: `${sourceAcquisitionCandidates.summary?.candidates ?? 0} candidates; categories=${sourceAcquisitionCandidates.summary?.categories ?? 0}; required_review_rows=${sourceAcquisitionCandidates.summary?.required_review_rows ?? 0}`,
      blocker: 'Materialize fetched source rows into review-pending task candidates before exporting source-acquisition review workbooks.',
    },
    {
      id: 'source_acquisition_review_workbooks_ready',
      passed:
        Boolean(sourceAcquisitionReviewWorkbooks.source_acquisition_review_workbooks_ready) &&
        sourceAcquisitionReviewWorkbooks.candidate_count === sourceAcquisitionCandidates.summary?.candidates &&
        sourceAcquisitionReviewWorkbooks.total_review_rows === sourceAcquisitionCandidates.summary?.required_review_rows &&
        sourceAcquisitionReviewWorkbooks.merge_policy?.gold_promotion_allowed_before_merge === false,
      detail: `${sourceAcquisitionReviewWorkbooks.workbook_count ?? 0} workbooks; ${sourceAcquisitionReviewWorkbooks.total_review_rows ?? 0} review rows; pointer_only_rows=${sourceAcquisitionReviewWorkbooks.pointer_only_review_rows ?? 0}`,
      blocker: 'Generate reviewer workbooks for source-acquisition candidates before collecting independent reviews.',
    },
    {
      id: 'source_acquisition_review_preflight_report_ready',
      passed:
        Boolean(sourceAcquisitionReviewPreflight.source_acquisition_review_preflight_report_ready) &&
        sourceAcquisitionReviewPreflight.total_review_rows === sourceAcquisitionReviewWorkbooks.total_review_rows &&
        sourceAcquisitionReviewPreflight.preflight_ready === false &&
        sourceAcquisitionReviewPreflight.gold_promotion_allowed === false,
      detail: `${sourceAcquisitionReviewPreflight.complete_review_rows ?? 0}/${sourceAcquisitionReviewPreflight.total_review_rows ?? 0} review rows complete; preflight_ready=${sourceAcquisitionReviewPreflight.preflight_ready}`,
      blocker: 'Generate source-acquisition review preflight so returned reviewer packets have a strict validation target.',
    },
    {
      id: 'source_lineage_ledger_ready',
      passed:
        Boolean(sourceLineageLedger.source_lineage_ledger_ready) &&
        sourceLineageLedger.summary?.pilot_items === spec.categories.length * 3 &&
        sourceLineageLedger.summary?.represented_datasets === spec.datasets.length &&
        sourceLineageLedger.summary?.completion_claim_allowed === false,
      detail: `${sourceLineageLedger.version}; rows=${sourceLineageLedger.summary?.lineage_rows ?? 0}; datasets=${sourceLineageLedger.summary?.represented_datasets ?? 0}/${sourceLineageLedger.summary?.registered_datasets ?? 'unknown'}; source_rows=${sourceLineageLedger.summary?.distinct_source_rows ?? 0}`,
      blocker: 'Generate a source-lineage ledger before claiming all benchmark items are auditable to Hugging Face source rows and package policies.',
    },
    {
      id: 'construct_map_ready',
      passed: Boolean(constructMap.construct_map_ready) && constructMap.summary.ready_constructs === spec.categories.length,
      detail: `${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs mapped; reviewed_gold_constructs=${constructMap.summary.constructs_with_reviewed_gold}; high_risk=${constructMap.summary.high_novelty_risk_constructs}`,
      blocker: 'Generate a construct-validity map tying categories to rubrics, examples, metrics, novelty risk, and review status.',
    },
    {
      id: 'difficulty_mechanism_ledger_ready',
      passed:
        Boolean(difficultyMechanismLedger.difficulty_mechanism_ledger_ready) &&
        difficultyMechanismLedger.summary?.categories === spec.categories.length &&
        difficultyMechanismLedger.summary?.observed_failure_cases === failureAtlas.summary?.failure_case_count &&
        difficultyMechanismLedger.summary?.reviewed_item_deficit === scaleGapLedger.summary?.reviewed_item_deficit &&
        difficultyMechanismLedger.summary?.completion_claim_allowed === false,
      detail: `${difficultyMechanismLedger.version}; mechanisms=${difficultyMechanismLedger.summary?.mechanisms ?? 0}; failure_cases=${difficultyMechanismLedger.summary?.observed_failure_cases ?? 0}; reviewed_deficit=${difficultyMechanismLedger.summary?.reviewed_item_deficit ?? 'unknown'}; blocked_claim_categories=${difficultyMechanismLedger.summary?.blocked_claim_categories ?? 'unknown'}`,
      blocker: 'Generate a category-level difficulty mechanism ledger tying each construct to observed failures, metrics, and claim blockers.',
    },
    {
      id: 'artifact_checklist_ready',
      passed:
        Boolean(artifactChecklist.artifact_checklist_ready) &&
        artifactChecklist.summary?.artifact_classes_ready === artifactChecklist.summary?.artifact_classes_total &&
        artifactChecklist.paper_readiness?.completion_claim_allowed === false,
      detail: `${artifactChecklist.summary?.artifact_classes_ready ?? 0}/${artifactChecklist.summary?.artifact_classes_total ?? 0} artifact classes ready; reproduction_commands=${artifactChecklist.summary?.reproduction_commands ?? 0}; release_blockers=${artifactChecklist.summary?.release_blockers ?? 'unknown'}`,
      blocker: 'Generate a reproducibility artifact checklist that exposes commands, artifact classes, and remaining paper-readiness blockers.',
    },
    {
      id: 'version_manifest_ready',
      passed:
        Boolean(versionManifest.version_manifest_ready) &&
        versionManifest.summary?.artifact_count >= 20 &&
        versionManifest.summary?.completion_claim_allowed === false,
      detail: `${versionManifest.version}; artifacts=${versionManifest.summary?.artifact_count ?? 0}; blockers=${versionManifest.summary?.release_blockers ?? 'unknown'}; bytes=${versionManifest.summary?.total_bytes ?? 0}`,
      blocker: 'Generate a checksum-backed version manifest before publishing a reproducible benchmark package.',
    },
    {
      id: 'threats_validity_ready',
      passed:
        Boolean(threatsValidity.threats_validity_ready) &&
        threatsValidity.summary?.threat_count >= 8 &&
        threatsValidity.summary?.completion_claim_allowed === false,
      detail: `${threatsValidity.summary?.threat_count ?? 0} threats tracked; high_severity=${threatsValidity.summary?.high_severity_count ?? 'unknown'}; completion_claim_allowed=${threatsValidity.summary?.completion_claim_allowed ?? 'unknown'}`,
      blocker: 'Generate a threats-to-validity report that ties paper risks to release checks and keeps completion claims blocked.',
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
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
      novelty_source_review_packets: 'generated/novelty-source-review-packets.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      novelty_link_audit: 'generated/novelty-link-audit.json',
      novelty_replacement_candidates: 'generated/novelty-replacement-candidates.json',
      novelty_overlap_adjudication: 'generated/novelty-overlap-adjudication.json',
      novelty_refresh_ledger: 'generated/novelty-refresh-ledger.json',
      derived_label_suite: 'generated/derived-label-suite.json',
      gold_summary: 'generated/gold-suite-summary.json',
      annotation_protocol: 'generated/annotation-protocol.json',
      review_preflight: 'generated/review-preflight.json',
      review_operations: 'generated/review-operations.json',
      review_triage: 'generated/review-triage.json',
      annotation_assignments: 'generated/annotation-assignments.json',
      review_assignment_audit: 'generated/review-assignment-audit.json',
      reviewer_handoff: 'generated/reviewer-handoff.json',
      review_progress: 'generated/review-progress.json',
      review_execution_plan: 'generated/review-execution-plan.json',
    review_packet_audit: 'generated/review-packet-audit.json',
    review_return_contract: 'generated/review-return-contract.json',
    review_return_preflight: 'generated/review-return-preflight.json',
    review_return_checklist: 'generated/review-return-checklist.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      review_wave_schedule: 'generated/review-wave-schedule.json',
      review_dropoff_manifest: 'generated/review-dropoff-manifest.json',
      review_intake_validator: 'generated/review-intake-validator.json',
    gold_adjudication_plan: 'generated/gold-adjudication-plan.json',
    scale_adjudication_plan: 'generated/scale-adjudication-plan.json',
    scale_gap_ledger: 'generated/scale-gap-ledger.json',
    adjudication_readiness: 'generated/adjudication-readiness.json',
      annotator_agreement: 'generated/annotator-agreement.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      annotation_import_smoke: 'generated/annotation-import-smoke/report.json',
      annotation_import: 'generated/annotation-import/report.json',
      review_calibration: 'generated/review-calibration.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      gold_promotion_smoke: 'generated/gold-promotion-smoke/report.json',
      expansion_promotion_smoke: 'generated/expansion-promotion-smoke/report.json',
      expansion_review_preflight: 'generated/expansion-review-preflight.json',
      expansion_review_merge_report: 'generated/expansion-review-merge-report.json',
      review_merge_report: 'generated/review-merge-report.json',
      scale_plan: 'generated/scale-plan.json',
      power_plan: 'generated/power-plan.json',
      item_quality_audit: 'generated/item-quality-audit.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      failure_atlas: 'generated/failure-atlas.json',
      hypothesis_test_matrix: 'generated/hypothesis-test-matrix.json',
      result_interpretation_guide: 'generated/result-interpretation-guide.json',
      evidence_sufficiency_audit: 'generated/evidence-sufficiency-audit.json',
      estimand_registry: 'generated/estimand-registry.json',
      sensitivity_analysis_plan: 'generated/sensitivity-analysis-plan.json',
      lookup_contrast_registry: 'generated/lookup-contrast-registry.json',
      statistical_reporting_template: 'generated/statistical-reporting-template.json',
      control_ablation_plan: 'generated/control-ablation-plan.json',
      error_codebook: 'generated/error-codebook.json',
      paper_tables: 'generated/paper-tables.json',
      analysis_plan: 'generated/analysis-plan.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      supplement_index: 'generated/supplement-index.json',
      citation_metadata: 'generated/citation-metadata.json',
      reviewer_faq: 'generated/reviewer-faq.json',
      baseline_uncertainty: 'generated/baseline-uncertainty.json',
      model_run_index: 'generated/model-run-index.json',
      model_baseline_packets: 'generated/model-baseline-packets.json',
      submission_contract: 'generated/submission-contract.json',
      scoring_contract: 'generated/scoring-contract.json',
      corpus_audit: 'generated/corpus-audit.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      source_acquisition_manifest: 'generated/source-acquisition-manifest.json',
      source_acquisition_packets: 'generated/source-acquisition-packets.json',
      source_acquisition_audit: 'generated/source-acquisition-audit.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      source_acquisition_review_workbooks: 'generated/source-acquisition-review-workbooks/index.json',
      source_acquisition_review_preflight: 'generated/source-acquisition-review-preflight.json',
      source_lineage_ledger: 'generated/source-lineage-ledger.json',
      construct_map: 'generated/construct-map.json',
      difficulty_mechanism_ledger: 'generated/difficulty-mechanism-ledger.json',
      artifact_checklist: 'generated/artifact-checklist.json',
      reproduction_capsule: 'generated/reproduction-capsule.json',
      version_manifest: 'generated/version-manifest.json',
      threats_validity: 'generated/threats-validity.json',
      license_review: 'generated/license-review.json',
      license_impact: 'generated/license-impact.json',
      license_clearance: 'generated/license-clearance.json',
      license_remediation_plan: 'generated/license-remediation-plan.json',
      license_remediated_expansion_candidates: 'generated/license-remediated-expansion-candidates.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      public_package_integrity: 'generated/public-package-integrity.json',
      public_package_schema: 'generated/public-package-schema.json',
      responsible_use: 'generated/responsible-use.json',
      data_statement: 'generated/data-statement.json',
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
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(inputs.noveltyFinalizationPreflight),
  noveltySourceIdentityAudit: readJson(inputs.noveltySourceIdentityAudit),
  noveltySourceReviewPackets: readJson(inputs.noveltySourceReviewPackets),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
  noveltyLinkAudit: readJson(inputs.noveltyLinkAudit),
  noveltyReplacementCandidates: readJson(inputs.noveltyReplacementCandidates),
  noveltyOverlapAdjudication: readJson(inputs.noveltyOverlapAdjudication),
  noveltyRefreshLedger: readJson(inputs.noveltyRefreshLedger),
  finalNoveltyAdjudication: readJson(inputs.finalNoveltyAdjudication),
  derivedLabelSuite: readJson(inputs.derivedLabelSuite),
  derivedScaleSuite: readJson(inputs.derivedScaleSuite),
  goldSummary: readJson(inputs.goldSummary),
  annotationProtocol: readJson(inputs.annotationProtocol),
  reviewPreflight: readJson(inputs.reviewPreflight),
  reviewOperations: readJson(inputs.reviewOperations),
  reviewTriage: readJson(inputs.reviewTriage),
  annotationAssignments: readJson(inputs.annotationAssignments),
  reviewAssignmentAudit: readJson(inputs.reviewAssignmentAudit),
  reviewerHandoff: readJson(inputs.reviewerHandoff),
  reviewProgress: readJson(inputs.reviewProgress),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  reviewPacketAudit: readJson(inputs.reviewPacketAudit),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  reviewReturnPreflight: readJson(inputs.reviewReturnPreflight),
  reviewReturnChecklist: readJson(inputs.reviewReturnChecklist),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  reviewWaveSchedule: readJson(inputs.reviewWaveSchedule),
  reviewDropoffManifest: readJson(inputs.reviewDropoffManifest),
  reviewIntakeValidator: readJson(inputs.reviewIntakeValidator),
  goldAdjudicationPlan: readJson(inputs.goldAdjudicationPlan),
  scaleAdjudicationPlan: readJson(inputs.scaleAdjudicationPlan),
  scaleGapLedger: readJson(inputs.scaleGapLedger),
  adjudicationReadiness: readJson(inputs.adjudicationReadiness),
  annotatorAgreement: readJson(inputs.annotatorAgreement),
  expansionReviewPreflight: readJson(inputs.expansionReviewPreflight),
  expansionReviewMergeReport: readJson(inputs.expansionReviewMergeReport),
  reviewMergeReport: readJson(inputs.reviewMergeReport),
  scalePlan: readJson(inputs.scalePlan),
  powerPlan: readJson(inputs.powerPlan),
  itemQualityAudit: readJson(inputs.itemQualityAudit),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  failureAtlas: readJson(inputs.failureAtlas),
  hypothesisTestMatrix: readJson(inputs.hypothesisTestMatrix),
  resultInterpretationGuide: readJson(inputs.resultInterpretationGuide),
  evidenceSufficiencyAudit: readJson(inputs.evidenceSufficiencyAudit),
  estimandRegistry: readJson(inputs.estimandRegistry),
  sensitivityAnalysisPlan: readJson(inputs.sensitivityAnalysisPlan),
  lookupContrastRegistry: readJson(inputs.lookupContrastRegistry),
  statisticalReportingTemplate: readJson(inputs.statisticalReportingTemplate),
  controlAblationPlan: readJson(inputs.controlAblationPlan),
  errorCodebook: readJson(inputs.errorCodebook),
  paperTables: readJson(inputs.paperTables),
  analysisPlan: readJson(inputs.analysisPlan),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  supplementIndex: readJson(inputs.supplementIndex),
  citationMetadata: readJson(inputs.citationMetadata),
  reviewerFaq: readJson(inputs.reviewerFaq),
  baselineUncertainty: readJson(inputs.baselineUncertainty),
  modelRunIndex: readJson(inputs.modelRunIndex),
  modelBaselinePackets: readJson(inputs.modelBaselinePackets),
  modelReportingCard: readJson(inputs.modelReportingCard),
  submissionContract: readJson(inputs.submissionContract),
  scoringContract: readJson(inputs.scoringContract),
  corpusAudit: readJson(inputs.corpusAudit),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  sourceAcquisitionManifest: readJson(inputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(inputs.sourceAcquisitionPackets),
  sourceAcquisitionAudit: readJson(inputs.sourceAcquisitionAudit),
  sourceAcquisitionFetchedRows: readJson(inputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  sourceAcquisitionReviewWorkbooks: readJson(inputs.sourceAcquisitionReviewWorkbooks),
  sourceAcquisitionReviewPreflight: readJson(inputs.sourceAcquisitionReviewPreflight),
  sourceLineageLedger: readJson(inputs.sourceLineageLedger),
  constructMap: readJson(inputs.constructMap),
  difficultyMechanismLedger: readJson(inputs.difficultyMechanismLedger),
  artifactChecklist: readJson(inputs.artifactChecklist),
  reproductionCapsule: readJson(inputs.reproductionCapsule),
  versionManifest: readJson(inputs.versionManifest),
  threatsValidity: readJson(inputs.threatsValidity),
  annotationExport: readJson(inputs.annotationExport),
  annotationImportSmoke: readJson(inputs.annotationImportSmoke),
  annotationImport: readJson(inputs.annotationImport),
  reviewCalibration: readJson(inputs.reviewCalibration),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  goldPromotionSmoke: readJson(inputs.goldPromotionSmoke),
  expansionPromotionSmoke: readJson(inputs.expansionPromotionSmoke),
  licenseReview: readJson(inputs.licenseReview),
  licenseImpact: readJson(inputs.licenseImpact),
  licenseClearance: readJson(inputs.licenseClearance),
  licenseRemediationPlan: readJson(inputs.licenseRemediationPlan),
  licenseRemediatedExpansionCandidates: readJson(inputs.licenseRemediatedExpansionCandidates),
  packageManifest: readJson(inputs.packageManifest),
  publicPackageIntegrity: readJson(inputs.publicPackageIntegrity),
  publicPackageSchema: readJson(inputs.publicPackageSchema),
  responsibleUse: readJson(inputs.responsibleUse),
  dataStatement: readJson(inputs.dataStatement),
  publicPackageSummary: readJson(inputs.publicPackageSummary),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
})

writeJson(releaseGateJsonPath, gate)
writeText(releaseGateMarkdownPath, renderMarkdown(gate))
console.log(`Wrote hard grounded research release gate to ${releaseGateJsonPath}`)
console.log(`Wrote hard grounded research release gate report to ${releaseGateMarkdownPath}`)
