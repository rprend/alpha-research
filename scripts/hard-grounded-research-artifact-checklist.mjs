import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const root = process.cwd()
const experimentDir = join(root, 'docs/experiments/hard-grounded-research-benchmark')
const generatedDir = join(experimentDir, 'generated')
const checklistJsonPath = join(generatedDir, 'artifact-checklist.json')
const checklistMarkdownPath = join(experimentDir, 'ARTIFACT_CHECKLIST.md')

const inputs = {
  spec: join(experimentDir, 'benchmark-spec.json'),
  pilotSuite: join(generatedDir, 'pilot-suite.json'),
  corpusAudit: join(generatedDir, 'corpus-audit.json'),
  sourceDiversityPlan: join(generatedDir, 'source-diversity-plan.json'),
  sourceAcquisitionManifest: join(generatedDir, 'source-acquisition-manifest.json'),
  sourceAcquisitionPackets: join(generatedDir, 'source-acquisition-packets.json'),
  sourceAcquisitionAudit: join(generatedDir, 'source-acquisition-audit.json'),
  sourceAcquisitionFetchedRows: join(generatedDir, 'source-acquisition-fetched-rows.json'),
  sourceAcquisitionCandidates: join(generatedDir, 'source-acquisition-candidates.json'),
  sourceAcquisitionReviewWorkbooks: join(generatedDir, 'source-acquisition-review-workbooks/index.json'),
  sourceAcquisitionReviewPreflight: join(generatedDir, 'source-acquisition-review-preflight.json'),
  constructMap: join(generatedDir, 'construct-map.json'),
  powerPlan: join(generatedDir, 'power-plan.json'),
  noveltyAudit: join(generatedDir, 'novelty-audit.json'),
  noveltyEvidence: join(generatedDir, 'novelty-evidence.json'),
  noveltyWatchlist: join(generatedDir, 'novelty-watchlist.json'),
  noveltyResolutionMatrix: join(generatedDir, 'novelty-resolution-matrix.json'),
  noveltyFinalizationPreflight: join(generatedDir, 'novelty-finalization-preflight.json'),
  noveltySourceReviewPackets: join(generatedDir, 'novelty-source-review-packets.json'),
  noveltyClaimRevisionPlan: join(generatedDir, 'novelty-claim-revision-plan.json'),
  noveltyLinkAudit: join(generatedDir, 'novelty-link-audit.json'),
  noveltyReplacementCandidates: join(generatedDir, 'novelty-replacement-candidates.json'),
  noveltyOverlapAdjudication: join(generatedDir, 'novelty-overlap-adjudication.json'),
  licenseClearance: join(generatedDir, 'license-clearance.json'),
  packageManifest: join(generatedDir, 'public-package-manifest.json'),
  publicPackageIntegrity: join(generatedDir, 'public-package-integrity.json'),
  publicPackageSchema: join(generatedDir, 'public-package-schema.json'),
  responsibleUse: join(generatedDir, 'responsible-use.json'),
  dataStatement: join(generatedDir, 'data-statement.json'),
  scaledPublicPackageSummary: join(generatedDir, 'public-package/scaled-summary.json'),
  modelRunIndex: join(generatedDir, 'model-run-index.json'),
  modelReportingCard: join(generatedDir, 'model-reporting-card.json'),
  submissionContract: join(generatedDir, 'submission-contract.json'),
  scoringContract: join(generatedDir, 'scoring-contract.json'),
  errorCodebook: join(generatedDir, 'error-codebook.json'),
  baselineAnalysis: join(generatedDir, 'baseline-analysis.json'),
  paperTables: join(generatedDir, 'paper-tables.json'),
  analysisPlan: join(generatedDir, 'analysis-plan.json'),
  paperClaimLedger: join(generatedDir, 'paper-claim-ledger.json'),
  supplementIndex: join(generatedDir, 'supplement-index.json'),
  citationMetadata: join(generatedDir, 'citation-metadata.json'),
  reviewerFaq: join(generatedDir, 'reviewer-faq.json'),
  annotationExport: join(generatedDir, 'annotation-export/manifest.json'),
  reviewCalibration: join(generatedDir, 'review-calibration.json'),
  annotationQualityControl: join(generatedDir, 'annotation-quality-control.json'),
  reviewProgress: join(generatedDir, 'review-progress.json'),
  reviewExecutionPlan: join(generatedDir, 'review-execution-plan.json'),
  reviewPacketAudit: join(generatedDir, 'review-packet-audit.json'),
  reviewReturnContract: join(generatedDir, 'review-return-contract.json'),
  reviewReturnPreflight: join(generatedDir, 'review-return-preflight.json'),
  reviewReturnChecklist: join(generatedDir, 'review-return-checklist.json'),
  reviewCollectionTracker: join(generatedDir, 'review-collection-tracker.json'),
  reviewWaveSchedule: join(generatedDir, 'review-wave-schedule.json'),
  reviewDropoffManifest: join(generatedDir, 'review-dropoff-manifest.json'),
  goldAdjudicationPlan: join(generatedDir, 'gold-adjudication-plan.json'),
  scaleAdjudicationPlan: join(generatedDir, 'scale-adjudication-plan.json'),
  reproductionCapsule: join(generatedDir, 'reproduction-capsule.json'),
  versionManifest: join(generatedDir, 'version-manifest.json'),
  releaseGate: join(generatedDir, 'release-gate.json'),
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
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

function artifactClass(id, status, evidence, blockers = []) {
  return {
    id,
    status: status ? 'ready' : 'blocked',
    ready: Boolean(status),
    evidence,
    blockers,
  }
}

function buildChecklist({
  spec,
  pilotSuite,
  corpusAudit,
  sourceDiversityPlan,
  sourceAcquisitionManifest,
  sourceAcquisitionPackets,
  sourceAcquisitionAudit,
  sourceAcquisitionFetchedRows,
  sourceAcquisitionCandidates,
  sourceAcquisitionReviewWorkbooks,
  sourceAcquisitionReviewPreflight,
  constructMap,
  powerPlan,
  noveltyAudit,
  noveltyEvidence,
  noveltyWatchlist,
  noveltyResolutionMatrix,
  noveltyFinalizationPreflight,
  noveltySourceReviewPackets,
  noveltyClaimRevisionPlan,
  noveltyLinkAudit,
  noveltyReplacementCandidates,
  noveltyOverlapAdjudication,
  licenseClearance,
  packageManifest,
  publicPackageIntegrity,
  publicPackageSchema,
  responsibleUse,
  dataStatement,
  scaledPublicPackageSummary,
  modelRunIndex,
  modelReportingCard,
  submissionContract,
  scoringContract,
  errorCodebook,
  baselineAnalysis,
  paperTables,
  analysisPlan,
  paperClaimLedger,
  supplementIndex,
  citationMetadata,
  reviewerFaq,
  annotationExport,
  reviewCalibration,
  annotationQualityControl,
  reviewProgress,
  reviewExecutionPlan,
  reviewPacketAudit,
  reviewReturnContract,
  reviewReturnPreflight,
  reviewReturnChecklist,
  reviewCollectionTracker,
  reviewWaveSchedule,
  reviewDropoffManifest,
  goldAdjudicationPlan,
  scaleAdjudicationPlan,
  reproductionCapsule,
  versionManifest,
  releaseGate,
}) {
  const failedReleaseChecks = releaseGate.checks.filter((check) => !check.passed)
  const artifactClasses = [
    artifactClass('taxonomy_and_constructs', constructMap.construct_map_ready, `${constructMap.summary.ready_constructs}/${constructMap.summary.category_count} constructs mapped to rubrics, metrics, examples, novelty risk, and review status.`),
    artifactClass('corpus_and_public_package', corpusAudit.corpus_audit_ready && licenseClearance.public_redistribution_clearance_ready, `${corpusAudit.summary.scaled_public_items} scaled public items; ${corpusAudit.summary.scaled_public_evidence_units} evidence units; ${corpusAudit.summary.scaled_public_pointer_only_evidence_units} pointer-only evidence units.`),
    artifactClass('public_package_integrity', publicPackageIntegrity.public_package_integrity_ready && publicPackageIntegrity.summary.pointer_only_text_leaks === 0, `${publicPackageIntegrity.version}; suites=${publicPackageIntegrity.summary.suites_checked}; items=${publicPackageIntegrity.summary.total_items}; findings=${publicPackageIntegrity.summary.findings}.`),
    artifactClass('public_package_schema', publicPackageSchema.public_package_schema_ready && publicPackageSchema.summary.schema_violations === 0, `${publicPackageSchema.version}; suites=${publicPackageSchema.summary.suites_checked}; items=${publicPackageSchema.summary.items_checked}; schema violations=${publicPackageSchema.summary.schema_violations}.`),
    artifactClass('source_diversity_expansion', sourceDiversityPlan.source_diversity_plan_ready, `${sourceDiversityPlan.summary.current_distinct_source_rows}/${sourceDiversityPlan.summary.target_distinct_source_rows_total} target source rows; deficit=${sourceDiversityPlan.summary.source_row_deficit_total}.`),
    artifactClass('source_acquisition_manifest', sourceAcquisitionManifest.source_acquisition_manifest_ready, `${sourceAcquisitionManifest.summary.acquisition_batches} acquisition batches; ${sourceAcquisitionManifest.summary.target_new_distinct_source_rows} target new source rows.`),
    artifactClass('source_acquisition_packets', sourceAcquisitionPackets.source_acquisition_packets_ready, `${sourceAcquisitionPackets.summary.packet_count} packet files; ${sourceAcquisitionPackets.summary.target_new_distinct_source_rows} acquisition row slots.`),
    artifactClass('source_acquisition_audit', sourceAcquisitionAudit.source_acquisition_audit_ready, `${sourceAcquisitionAudit.summary.audited_rows}/${sourceAcquisitionAudit.summary.expected_rows} packet rows audited; findings=${sourceAcquisitionAudit.summary.finding_count}.`),
    artifactClass('source_acquisition_fetch_report', sourceAcquisitionFetchedRows.source_acquisition_fetch_report_ready, `${sourceAcquisitionFetchedRows.summary.fetched_rows}/${sourceAcquisitionFetchedRows.summary.requested_rows} source rows fetched from Hugging Face; findings=${sourceAcquisitionFetchedRows.summary.finding_count}.`),
    artifactClass('source_acquisition_candidates', sourceAcquisitionCandidates.source_acquisition_candidates_ready, `${sourceAcquisitionCandidates.summary.candidates} fetched-row candidates; ${sourceAcquisitionCandidates.summary.required_review_rows} required review rows.`),
    artifactClass('source_acquisition_review_workbooks', sourceAcquisitionReviewWorkbooks.source_acquisition_review_workbooks_ready, `${sourceAcquisitionReviewWorkbooks.workbook_count} workbooks; ${sourceAcquisitionReviewWorkbooks.total_review_rows} source-acquisition review rows.`),
    artifactClass('source_acquisition_review_preflight', sourceAcquisitionReviewPreflight.source_acquisition_review_preflight_report_ready, `${sourceAcquisitionReviewPreflight.complete_review_rows}/${sourceAcquisitionReviewPreflight.total_review_rows} source-acquisition review rows complete; preflight_ready=${sourceAcquisitionReviewPreflight.preflight_ready}.`),
    artifactClass('review_calibration', reviewCalibration.review_calibration_ready && reviewCalibration.gold_promotion_allowed === false, `${reviewCalibration.sentinel_count} reviewer-screening sentinels across ${reviewCalibration.category_count} categories; minimum_accuracy=${reviewCalibration.acceptance_policy.minimum_accuracy}.`),
    artifactClass('annotation_quality_control', annotationQualityControl.annotation_quality_control_ready && annotationQualityControl.completion_claim_allowed === false, `${annotationQualityControl.workload.total_review_rows} review rows governed by ${annotationQualityControl.qa_rules.length} QA rules; sentinel rows in gold=${annotationQualityControl.thresholds.allow_sentinel_rows_in_gold}.`),
    artifactClass('annotation_and_review_workflow', annotationExport.export_ready && reviewProgress.review_progress_ready, `${annotationExport.totals.row_count} exported review rows; ${reviewProgress.summary.reviewed_items_remaining} reviewed target items remaining.`),
    artifactClass('review_execution_plan', reviewExecutionPlan.review_execution_plan_ready && reviewExecutionPlan.claim_limits.completion_claim_allowed === false, `${reviewExecutionPlan.version}; rows remaining=${reviewExecutionPlan.summary.total_rows_remaining}; reviewer hours=${reviewExecutionPlan.summary.reviewer_hours_with_reserve}; blocking checks=${reviewExecutionPlan.summary.blocking_review_checks}.`),
    artifactClass('review_packet_audit', reviewPacketAudit.review_packet_audit_ready && reviewPacketAudit.summary.finding_count === 0, `${reviewPacketAudit.version}; files=${reviewPacketAudit.summary.files_checked}; rows=${reviewPacketAudit.summary.rows_checked}; findings=${reviewPacketAudit.summary.finding_count}.`),
    artifactClass('review_return_contract', reviewReturnContract.review_return_contract_ready && reviewReturnContract.summary.finding_count === 0, `${reviewReturnContract.version}; files=${reviewReturnContract.summary.expected_return_files}; rows=${reviewReturnContract.summary.expected_return_rows}; findings=${reviewReturnContract.summary.finding_count}.`),
    artifactClass('review_return_preflight', reviewReturnPreflight.review_return_preflight_ready && reviewReturnPreflight.summary.completion_claim_allowed === false, `${reviewReturnPreflight.version}; present=${reviewReturnPreflight.summary.present_return_files}/${reviewReturnPreflight.summary.expected_return_files}; missing=${reviewReturnPreflight.summary.missing_return_files}; latest import ready=${reviewReturnPreflight.summary.latest_import_ready}.`),
    artifactClass('review_return_checklist', reviewReturnChecklist.review_return_checklist_ready && reviewReturnChecklist.summary.completion_claim_allowed === false, `${reviewReturnChecklist.version}; packets=${reviewReturnChecklist.summary.packets}; rows=${reviewReturnChecklist.summary.expected_rows}; missing=${reviewReturnChecklist.summary.missing_packets}.`),
    artifactClass('review_collection_tracker', reviewCollectionTracker.review_collection_tracker_ready && reviewCollectionTracker.summary.completion_claim_allowed === false, `${reviewCollectionTracker.version}; packets=${reviewCollectionTracker.summary.packets}; missing=${reviewCollectionTracker.summary.missing_packets}; returned=${reviewCollectionTracker.summary.returned_packets}.`),
    artifactClass('review_wave_schedule', reviewWaveSchedule.review_wave_schedule_ready && reviewWaveSchedule.summary.completion_claim_allowed === false, `${reviewWaveSchedule.version}; waves=${reviewWaveSchedule.summary.waves}; packets=${reviewWaveSchedule.summary.packets}; scheduled missing=${reviewWaveSchedule.summary.scheduled_missing_packets}.`),
    artifactClass('review_dropoff_manifest', reviewDropoffManifest.review_dropoff_manifest_ready && reviewDropoffManifest.summary.completion_claim_allowed === false, `${reviewDropoffManifest.version}; packets=${reviewDropoffManifest.summary.packets}; export hashes=${reviewDropoffManifest.summary.export_hashes}; rows=${reviewDropoffManifest.summary.expected_rows}.`),
    artifactClass('gold_adjudication_plan', goldAdjudicationPlan.gold_adjudication_plan_ready && goldAdjudicationPlan.summary.completion_claim_allowed === false, `${goldAdjudicationPlan.version}; items=${goldAdjudicationPlan.summary.pilot_items}; missing reviews=${goldAdjudicationPlan.summary.missing_reviews}; promotion-ready=${goldAdjudicationPlan.summary.promotion_ready_items}.`),
    artifactClass('scale_adjudication_plan', scaleAdjudicationPlan.scale_adjudication_plan_ready && scaleAdjudicationPlan.summary.completion_claim_allowed === false, `${scaleAdjudicationPlan.version}; batches=${scaleAdjudicationPlan.summary.expansion_batches}; missing review rows=${scaleAdjudicationPlan.summary.missing_review_rows}; merge-ready=${scaleAdjudicationPlan.summary.merge_ready_items}.`),
    artifactClass('submission_contract', submissionContract.submission_contract_ready && submissionContract.public_leaderboard_allowed === false, `${submissionContract.version}; pilot tasks=${submissionContract.scoring_sources.pilot.task_count}; required fields=${submissionContract.schema.answer_required_fields.length}.`),
    artifactClass('scoring_contract', scoringContract.scoring_contract_ready && scoringContract.claim_limits.public_leaderboard_allowed === false, `${scoringContract.version}; metrics=${scoringContract.summary.metric_count}; required metrics=${scoringContract.summary.required_metric_count}/${scoringContract.required_metric_ids.length}.`),
    artifactClass('error_codebook', errorCodebook.error_codebook_ready && errorCodebook.claim_limits.completion_claim_allowed === false, `${errorCodebook.version}; codes=${errorCodebook.summary.code_count}; observed pilot failures=${errorCodebook.summary.observed_failure_cases}.`),
    artifactClass('baselines_and_scoring', baselineAnalysis.systems.length >= 5 && modelRunIndex.eligible_model_baseline_count >= 2, `${baselineAnalysis.systems.length} scored systems; ${modelRunIndex.eligible_model_baseline_count} eligible external model baselines.`),
    artifactClass('model_reporting_card', modelReportingCard.model_reporting_card_ready && modelReportingCard.claim_limits.public_leaderboard_allowed === false, `${modelReportingCard.version}; systems=${modelReportingCard.summary.systems_reported}; eligible=${modelReportingCard.summary.eligible_model_baselines}; required fields=${modelReportingCard.summary.required_reporting_fields}.`),
    artifactClass('statistics_and_scale', powerPlan.power_plan_ready, `${powerPlan.assumptions.target_reviewed_items_per_category} target reviewed items/category; ${powerPlan.current_state.reviewed_items_remaining} reviewed items remaining.`),
    artifactClass('paper_tables_and_figures', paperTables.paper_tables_ready, `${paperTables.summary.table_count} paper tables; ${paperTables.summary.challenge_rows} challenge rows; ${paperTables.summary.failure_modes} failure modes.`),
    artifactClass('analysis_plan', analysisPlan.analysis_plan_ready, `${analysisPlan.summary.hypotheses} hypotheses; ${analysisPlan.summary.model_families} model families; ${analysisPlan.summary.covariates} covariates.`),
    artifactClass('paper_claim_ledger', paperClaimLedger.paper_claim_ledger_ready && paperClaimLedger.completion_claim_allowed === false, `${paperClaimLedger.summary.claims} claims mapped to evidence; prohibited=${paperClaimLedger.summary.prohibited_claims}; diagnostic=${paperClaimLedger.summary.diagnostic_only_claims}.`),
    artifactClass('supplement_index', supplementIndex.summary.sections >= 6 && supplementIndex.summary.completion_claim_allowed === false, `${supplementIndex.version}; sections=${supplementIndex.summary.sections}; tables=${supplementIndex.summary.paper_tables}; claims=${supplementIndex.summary.claims}.`),
    artifactClass('reproduction_capsule', reproductionCapsule.summary.reproduction_commands >= 8 && reproductionCapsule.summary.validation_commands >= 3 && reproductionCapsule.claim_limits.completion_claim_allowed === false, `${reproductionCapsule.version}; commands=${reproductionCapsule.summary.reproduction_commands}; validations=${reproductionCapsule.summary.validation_commands}; hashes=${reproductionCapsule.summary.artifact_hashes}.`),
    artifactClass('citation_metadata', citationMetadata.summary.citation_caveats >= 4 && citationMetadata.summary.completion_claim_allowed === false, `${citationMetadata.version}; caveats=${citationMetadata.summary.citation_caveats}; artifact hashes=${citationMetadata.summary.artifact_hashes}; blockers=${citationMetadata.summary.release_blockers}.`),
    artifactClass('reviewer_faq', reviewerFaq.reviewer_faq_ready && reviewerFaq.summary.completion_claim_allowed === false, `${reviewerFaq.version}; questions=${reviewerFaq.summary.questions}; prohibited claims=${reviewerFaq.summary.prohibited_claims}.`),
    artifactClass('responsible_use', responsibleUse.responsible_use_ready && responsibleUse.public_leaderboard_allowed === false, `${responsibleUse.summary.policy_rules} policy rules; active restrictions=${responsibleUse.summary.active_restrictions}; public leaderboard allowed=${responsibleUse.public_leaderboard_allowed}.`),
    artifactClass('data_statement', dataStatement.data_statement_ready && dataStatement.summary.completion_claim_allowed === false, `${dataStatement.version}; source datasets=${dataStatement.summary.source_dataset_count}; scaled items=${dataStatement.composition.scaled_public_items}; pointer-only items=${dataStatement.package_policy.pointer_only_items}.`),
    artifactClass('version_manifest', versionManifest.summary.artifact_count >= 20 && versionManifest.summary.completion_claim_allowed === false, `${versionManifest.version}; artifacts=${versionManifest.summary.artifact_count}; bytes=${versionManifest.summary.total_bytes}.`),
    artifactClass('novelty_finalization_preflight', noveltyFinalizationPreflight.novelty_finalization_preflight_ready && noveltyFinalizationPreflight.summary.completion_claim_allowed === false, `${noveltyFinalizationPreflight.version}; unresolved=${noveltyFinalizationPreflight.summary.unresolved_sources}; high-risk unresolved=${noveltyFinalizationPreflight.summary.high_risk_unresolved_sources}; final allowed=${noveltyFinalizationPreflight.summary.final_novelty_claim_allowed}.`),
    artifactClass('novelty_source_review_packets', noveltySourceReviewPackets.novelty_source_review_packets_ready && noveltySourceReviewPackets.summary.completion_claim_allowed === false, `${noveltySourceReviewPackets.version}; packets=${noveltySourceReviewPackets.summary.packets}; high-risk=${noveltySourceReviewPackets.summary.high_risk_packets}; final allowed=${noveltySourceReviewPackets.summary.final_novelty_claim_allowed}.`),
    artifactClass('novelty_claim_revision_plan', noveltyClaimRevisionPlan.novelty_claim_revision_plan_ready && noveltyClaimRevisionPlan.summary.completion_claim_allowed === false, `${noveltyClaimRevisionPlan.version}; revisions=${noveltyClaimRevisionPlan.summary.revisions}; high-risk=${noveltyClaimRevisionPlan.summary.high_risk_revisions}; linked claims=${noveltyClaimRevisionPlan.summary.linked_claims}.`),
    artifactClass('novelty_link_audit', noveltyLinkAudit.novelty_link_audit_ready && noveltyLinkAudit.summary.completion_claim_allowed === false, `${noveltyLinkAudit.version}; checked=${noveltyLinkAudit.summary.checked_sources}; quarantined=${noveltyLinkAudit.summary.quarantined_sources}; title mismatches=${noveltyLinkAudit.summary.title_mismatches}.`),
    artifactClass('novelty_replacement_candidates', noveltyReplacementCandidates.novelty_replacement_candidates_ready && noveltyReplacementCandidates.summary.completion_claim_allowed === false, `${noveltyReplacementCandidates.version}; candidates=${noveltyReplacementCandidates.summary.candidates}; verified=${noveltyReplacementCandidates.summary.verified_title_match_candidates}; covered quarantined=${noveltyReplacementCandidates.summary.covered_quarantined_sources}.`),
    artifactClass('novelty_overlap_adjudication', noveltyOverlapAdjudication.novelty_overlap_adjudication_ready && noveltyOverlapAdjudication.summary.completion_claim_allowed === false, `${noveltyOverlapAdjudication.version}; candidates=${noveltyOverlapAdjudication.summary.candidates}; high-overlap=${noveltyOverlapAdjudication.summary.high_overlap_candidates}; pending dispositions=${noveltyOverlapAdjudication.summary.pending_dispositions}.`),
    artifactClass('novelty_and_claim_boundaries', noveltyEvidence.completion_claim_allowed === false && noveltyEvidence.claim_boundaries.length >= 4 && noveltyAudit.refresh_summary?.query_count >= 4 && noveltyWatchlist.novelty_watchlist_ready && noveltyResolutionMatrix.novelty_resolution_matrix_ready && noveltyFinalizationPreflight.novelty_finalization_preflight_ready && noveltySourceReviewPackets.novelty_source_review_packets_ready && noveltyClaimRevisionPlan.novelty_claim_revision_plan_ready && noveltyLinkAudit.novelty_link_audit_ready && noveltyReplacementCandidates.novelty_replacement_candidates_ready && noveltyOverlapAdjudication.novelty_overlap_adjudication_ready, `${noveltyEvidence.source_count} related-work sources; ${noveltyWatchlist.summary.watchlist_source_count} watchlist sources; ${noveltyResolutionMatrix.summary.unresolved_sources} unresolved watchlist sources; ${noveltyClaimRevisionPlan.summary.revisions} claim revisions; ${noveltyLinkAudit.summary.quarantined_sources} quarantined source links; ${noveltyReplacementCandidates.summary.candidates} replacement candidates; ${noveltyOverlapAdjudication.summary.pending_dispositions} pending overlap dispositions; ${noveltyEvidence.prohibited_claim_count} prohibited claims; refresh queries=${noveltyAudit.refresh_summary?.query_count ?? 0}.`),
  ]

  const reproductionCommands = [
    { step: 'Generate benchmark seeds and pilot suite', command: 'node scripts/hard-grounded-research-benchmark.mjs' },
    { step: 'Run scorer smoke report', command: 'node scripts/hard-grounded-research-evaluate.mjs' },
    { step: 'Run local non-oracle baselines', command: 'node scripts/hard-grounded-research-runner.mjs && node scripts/hard-grounded-research-lexical-baseline.mjs && node scripts/hard-grounded-research-citation-verifier.mjs' },
    { step: 'Refresh submission contract', command: 'node scripts/hard-grounded-research-submission-contract.mjs' },
    { step: 'Refresh scoring contract', command: 'node scripts/hard-grounded-research-scoring-contract.mjs' },
    { step: 'Refresh error codebook', command: 'node scripts/hard-grounded-research-error-codebook.mjs' },
    { step: 'Refresh aggregate baseline analysis', command: 'node scripts/hard-grounded-research-report.mjs' },
    { step: 'Refresh corpus, construct, and power artifacts', command: 'node scripts/hard-grounded-research-corpus-audit.mjs && node scripts/hard-grounded-research-construct-map.mjs && node scripts/hard-grounded-research-power-plan.mjs' },
    { step: 'Refresh novelty watchlist', command: 'node scripts/hard-grounded-research-novelty-watchlist.mjs' },
    { step: 'Refresh novelty resolution matrix', command: 'node scripts/hard-grounded-research-novelty-resolution-matrix.mjs' },
    { step: 'Refresh novelty finalization preflight', command: 'node scripts/hard-grounded-research-novelty-finalization-preflight.mjs' },
    { step: 'Refresh novelty source review packets', command: 'node scripts/hard-grounded-research-novelty-source-review-packets.mjs' },
    { step: 'Refresh novelty claim revision plan', command: 'node scripts/hard-grounded-research-novelty-claim-revision-plan.mjs' },
    { step: 'Refresh novelty link audit', command: 'node scripts/hard-grounded-research-novelty-link-audit.mjs' },
    { step: 'Refresh novelty replacement candidates', command: 'node scripts/hard-grounded-research-novelty-replacement-candidates.mjs' },
    { step: 'Refresh novelty overlap adjudication', command: 'node scripts/hard-grounded-research-novelty-overlap-adjudication.mjs' },
    { step: 'Refresh public package integrity', command: 'node scripts/hard-grounded-research-public-package-integrity.mjs' },
    { step: 'Refresh public package schema', command: 'node scripts/hard-grounded-research-public-package-schema.mjs' },
    { step: 'Refresh source diversity plan', command: 'node scripts/hard-grounded-research-source-diversity-plan.mjs' },
    { step: 'Refresh source acquisition manifest', command: 'node scripts/hard-grounded-research-source-acquisition-manifest.mjs' },
    { step: 'Refresh source acquisition packets', command: 'node scripts/hard-grounded-research-source-acquisition-packets.mjs' },
    { step: 'Refresh source acquisition audit', command: 'node scripts/hard-grounded-research-source-acquisition-audit.mjs' },
    { step: 'Fetch source acquisition row metadata', command: 'node scripts/hard-grounded-research-source-acquisition-fetch.mjs' },
    { step: 'Materialize source acquisition candidates', command: 'node scripts/hard-grounded-research-source-acquisition-candidates.mjs' },
    { step: 'Generate source acquisition review workbooks', command: 'node scripts/hard-grounded-research-source-acquisition-review-workbooks.mjs' },
    { step: 'Refresh source acquisition review preflight', command: 'node scripts/hard-grounded-research-source-acquisition-review-preflight.mjs' },
    { step: 'Refresh reviewer calibration sentinels', command: 'node scripts/hard-grounded-research-review-calibration.mjs' },
    { step: 'Refresh annotation quality-control policy', command: 'node scripts/hard-grounded-research-annotation-quality-control.mjs' },
    { step: 'Refresh review execution plan', command: 'node scripts/hard-grounded-research-review-execution-plan.mjs' },
    { step: 'Refresh review packet audit', command: 'node scripts/hard-grounded-research-review-packet-audit.mjs' },
    { step: 'Refresh review return contract', command: 'node scripts/hard-grounded-research-review-return-contract.mjs' },
    { step: 'Refresh review return preflight', command: 'node scripts/hard-grounded-research-review-return-preflight.mjs' },
    { step: 'Refresh review return checklist', command: 'node scripts/hard-grounded-research-review-return-checklist.mjs' },
    { step: 'Refresh review collection tracker', command: 'node scripts/hard-grounded-research-review-collection-tracker.mjs' },
    { step: 'Refresh review wave schedule', command: 'node scripts/hard-grounded-research-review-wave-schedule.mjs' },
    { step: 'Refresh review dropoff manifest', command: 'node scripts/hard-grounded-research-review-dropoff-manifest.mjs' },
    { step: 'Refresh gold adjudication plan', command: 'node scripts/hard-grounded-research-gold-adjudication-plan.mjs' },
    { step: 'Refresh scale adjudication plan', command: 'node scripts/hard-grounded-research-scale-adjudication-plan.mjs' },
    { step: 'Refresh paper tables and figure data', command: 'node scripts/hard-grounded-research-paper-tables.mjs' },
    { step: 'Refresh statistical analysis plan', command: 'node scripts/hard-grounded-research-analysis-plan.mjs' },
    { step: 'Refresh model reporting card', command: 'node scripts/hard-grounded-research-model-reporting-card.mjs' },
    { step: 'Refresh paper claim ledger', command: 'node scripts/hard-grounded-research-paper-claim-ledger.mjs' },
    { step: 'Refresh supplement index', command: 'node scripts/hard-grounded-research-supplement-index.mjs' },
    { step: 'Refresh reproduction capsule', command: 'node scripts/hard-grounded-research-reproduction-capsule.mjs' },
    { step: 'Refresh citation metadata', command: 'node scripts/hard-grounded-research-citation-metadata.mjs' },
    { step: 'Refresh reviewer FAQ', command: 'node scripts/hard-grounded-research-reviewer-faq.mjs' },
    { step: 'Refresh responsible-use policy', command: 'node scripts/hard-grounded-research-responsible-use.mjs' },
    { step: 'Refresh data statement', command: 'node scripts/hard-grounded-research-data-statement.mjs' },
    { step: 'Refresh version manifest', command: 'node scripts/hard-grounded-research-version-manifest.mjs' },
    { step: 'Refresh release and publication surfaces', command: 'node scripts/hard-grounded-research-release-gate.mjs && node scripts/hard-grounded-research-dataset-card.mjs && node scripts/hard-grounded-research-paper-draft.mjs' },
    { step: 'Validate harness integration', command: 'node scripts/validate-harness.mjs' },
    { step: 'Run app build and dashboard QA', command: 'node_modules/.bin/vite build && node scripts/qa-dashboard.mjs' },
    { step: 'Run full repository gates', command: 'pnpm build && pnpm test', caveat: 'Currently blocked in this workspace by pnpm ignored-build approvals for esbuild, sharp, and workerd.' },
  ]

  const paperReadiness = {
    status: releaseGate.status === 'release_ready' ? 'paper_ready' : 'blocked',
    release_gate_status: releaseGate.status,
    completion_claim_allowed: releaseGate.status === 'release_ready',
    blockers: failedReleaseChecks.map((check) => ({
      id: check.id,
      detail: check.detail,
      blocker: check.blocker,
    })),
  }

  const checklist = {
    artifact_checklist_ready: artifactClasses.every((entry) => entry.ready) && reproductionCommands.length >= 8,
    benchmark_id: spec.id,
    generated_from: {
      release_gate: 'generated/release-gate.json',
      corpus_audit: 'generated/corpus-audit.json',
      source_diversity_plan: 'generated/source-diversity-plan.json',
      source_acquisition_manifest: 'generated/source-acquisition-manifest.json',
      source_acquisition_packets: 'generated/source-acquisition-packets.json',
      source_acquisition_audit: 'generated/source-acquisition-audit.json',
      source_acquisition_fetched_rows: 'generated/source-acquisition-fetched-rows.json',
      source_acquisition_candidates: 'generated/source-acquisition-candidates.json',
      source_acquisition_review_workbooks: 'generated/source-acquisition-review-workbooks/index.json',
      source_acquisition_review_preflight: 'generated/source-acquisition-review-preflight.json',
      construct_map: 'generated/construct-map.json',
      power_plan: 'generated/power-plan.json',
      novelty_audit: 'generated/novelty-audit.json',
      novelty_evidence: 'generated/novelty-evidence.json',
      novelty_watchlist: 'generated/novelty-watchlist.json',
      novelty_resolution_matrix: 'generated/novelty-resolution-matrix.json',
      novelty_finalization_preflight: 'generated/novelty-finalization-preflight.json',
      novelty_source_review_packets: 'generated/novelty-source-review-packets.json',
      novelty_claim_revision_plan: 'generated/novelty-claim-revision-plan.json',
      novelty_link_audit: 'generated/novelty-link-audit.json',
      novelty_replacement_candidates: 'generated/novelty-replacement-candidates.json',
      novelty_overlap_adjudication: 'generated/novelty-overlap-adjudication.json',
      public_package_manifest: 'generated/public-package-manifest.json',
      public_package_integrity: 'generated/public-package-integrity.json',
      public_package_schema: 'generated/public-package-schema.json',
      responsible_use: 'generated/responsible-use.json',
      data_statement: 'generated/data-statement.json',
      scaled_public_package_summary: 'generated/public-package/scaled-summary.json',
      model_run_index: 'generated/model-run-index.json',
      model_reporting_card: 'generated/model-reporting-card.json',
      submission_contract: 'generated/submission-contract.json',
      scoring_contract: 'generated/scoring-contract.json',
      error_codebook: 'generated/error-codebook.json',
      baseline_analysis: 'generated/baseline-analysis.json',
      paper_tables: 'generated/paper-tables.json',
      analysis_plan: 'generated/analysis-plan.json',
      paper_claim_ledger: 'generated/paper-claim-ledger.json',
      supplement_index: 'generated/supplement-index.json',
      citation_metadata: 'generated/citation-metadata.json',
      reviewer_faq: 'generated/reviewer-faq.json',
      annotation_export: 'generated/annotation-export/manifest.json',
      review_calibration: 'generated/review-calibration.json',
      annotation_quality_control: 'generated/annotation-quality-control.json',
      review_progress: 'generated/review-progress.json',
      review_execution_plan: 'generated/review-execution-plan.json',
      review_packet_audit: 'generated/review-packet-audit.json',
      review_return_contract: 'generated/review-return-contract.json',
      review_return_preflight: 'generated/review-return-preflight.json',
      review_return_checklist: 'generated/review-return-checklist.json',
      review_collection_tracker: 'generated/review-collection-tracker.json',
      review_wave_schedule: 'generated/review-wave-schedule.json',
      review_dropoff_manifest: 'generated/review-dropoff-manifest.json',
      gold_adjudication_plan: 'generated/gold-adjudication-plan.json',
      scale_adjudication_plan: 'generated/scale-adjudication-plan.json',
      reproduction_capsule: 'generated/reproduction-capsule.json',
      version_manifest: 'generated/version-manifest.json',
    },
    summary: {
      categories: spec.categories.length,
      pilot_items: pilotSuite.items.length,
      scaled_public_items: scaledPublicPackageSummary.item_count,
      artifact_classes_ready: artifactClasses.filter((entry) => entry.ready).length,
      artifact_classes_total: artifactClasses.length,
      reproduction_commands: reproductionCommands.length,
      release_blockers: failedReleaseChecks.length,
    },
    artifact_classes: artifactClasses,
    reproduction_commands: reproductionCommands,
    paper_readiness: paperReadiness,
  }

  return checklist
}

function renderMarkdown(checklist) {
  const artifactRows = checklist.artifact_classes.map((entry) => [
    entry.id,
    entry.status,
    entry.evidence,
  ])
  const commandRows = checklist.reproduction_commands.map((entry) => [
    entry.step,
    `\`${entry.command}\`${entry.caveat ? `<br>${entry.caveat}` : ''}`,
  ])
  const blockerRows = checklist.paper_readiness.blockers.map((blocker) => [
    blocker.id,
    blocker.detail,
    blocker.blocker,
  ])

  return `# Hard Grounded Research Artifact Checklist

This generated checklist makes the benchmark package auditable as a research artifact. It records what can be regenerated, what is already packaged, and which paper-readiness claims remain blocked.

## Summary

- Checklist ready: ${checklist.artifact_checklist_ready}
- Benchmark id: \`${checklist.benchmark_id}\`
- Categories: ${checklist.summary.categories}
- Pilot items: ${checklist.summary.pilot_items}
- Scaled public items: ${checklist.summary.scaled_public_items}
- Artifact classes ready: ${checklist.summary.artifact_classes_ready}/${checklist.summary.artifact_classes_total}
- Reproduction commands: ${checklist.summary.reproduction_commands}
- Release blockers: ${checklist.summary.release_blockers}
- Paper readiness status: ${checklist.paper_readiness.status}
- Completion claim allowed: ${checklist.paper_readiness.completion_claim_allowed}

## Artifact Classes

${markdownTable(['Class', 'Status', 'Evidence'], artifactRows)}

## Reproduction Commands

${markdownTable(['Step', 'Command'], commandRows)}

## Paper-Readiness Blockers

${blockerRows.length ? markdownTable(['Check', 'Detail', 'Required action'], blockerRows) : 'No paper-readiness blockers are present.'}
`
}

for (const [name, path] of Object.entries(inputs)) {
  assert(existsSync(path), `Missing artifact checklist input ${name}: ${path}`)
}

const checklist = buildChecklist({
  spec: readJson(inputs.spec),
  pilotSuite: readJson(inputs.pilotSuite),
  corpusAudit: readJson(inputs.corpusAudit),
  sourceDiversityPlan: readJson(inputs.sourceDiversityPlan),
  sourceAcquisitionManifest: readJson(inputs.sourceAcquisitionManifest),
  sourceAcquisitionPackets: readJson(inputs.sourceAcquisitionPackets),
  sourceAcquisitionAudit: readJson(inputs.sourceAcquisitionAudit),
  sourceAcquisitionFetchedRows: readJson(inputs.sourceAcquisitionFetchedRows),
  sourceAcquisitionCandidates: readJson(inputs.sourceAcquisitionCandidates),
  sourceAcquisitionReviewWorkbooks: readJson(inputs.sourceAcquisitionReviewWorkbooks),
  sourceAcquisitionReviewPreflight: readJson(inputs.sourceAcquisitionReviewPreflight),
  constructMap: readJson(inputs.constructMap),
  powerPlan: readJson(inputs.powerPlan),
  noveltyAudit: readJson(inputs.noveltyAudit),
  noveltyEvidence: readJson(inputs.noveltyEvidence),
  noveltyWatchlist: readJson(inputs.noveltyWatchlist),
  noveltyResolutionMatrix: readJson(inputs.noveltyResolutionMatrix),
  noveltyFinalizationPreflight: readJson(inputs.noveltyFinalizationPreflight),
  noveltySourceReviewPackets: readJson(inputs.noveltySourceReviewPackets),
  noveltyClaimRevisionPlan: readJson(inputs.noveltyClaimRevisionPlan),
  noveltyLinkAudit: readJson(inputs.noveltyLinkAudit),
  noveltyReplacementCandidates: readJson(inputs.noveltyReplacementCandidates),
  noveltyOverlapAdjudication: readJson(inputs.noveltyOverlapAdjudication),
  licenseClearance: readJson(inputs.licenseClearance),
  packageManifest: readJson(inputs.packageManifest),
  publicPackageIntegrity: readJson(inputs.publicPackageIntegrity),
  publicPackageSchema: readJson(inputs.publicPackageSchema),
  responsibleUse: readJson(inputs.responsibleUse),
  dataStatement: readJson(inputs.dataStatement),
  scaledPublicPackageSummary: readJson(inputs.scaledPublicPackageSummary),
  modelRunIndex: readJson(inputs.modelRunIndex),
  modelReportingCard: readJson(inputs.modelReportingCard),
  submissionContract: readJson(inputs.submissionContract),
  scoringContract: readJson(inputs.scoringContract),
  errorCodebook: readJson(inputs.errorCodebook),
  baselineAnalysis: readJson(inputs.baselineAnalysis),
  paperTables: readJson(inputs.paperTables),
  analysisPlan: readJson(inputs.analysisPlan),
  paperClaimLedger: readJson(inputs.paperClaimLedger),
  supplementIndex: readJson(inputs.supplementIndex),
  citationMetadata: readJson(inputs.citationMetadata),
  reviewerFaq: readJson(inputs.reviewerFaq),
  annotationExport: readJson(inputs.annotationExport),
  reviewCalibration: readJson(inputs.reviewCalibration),
  annotationQualityControl: readJson(inputs.annotationQualityControl),
  reviewProgress: readJson(inputs.reviewProgress),
  reviewExecutionPlan: readJson(inputs.reviewExecutionPlan),
  reviewPacketAudit: readJson(inputs.reviewPacketAudit),
  reviewReturnContract: readJson(inputs.reviewReturnContract),
  reviewReturnPreflight: readJson(inputs.reviewReturnPreflight),
  reviewReturnChecklist: readJson(inputs.reviewReturnChecklist),
  reviewCollectionTracker: readJson(inputs.reviewCollectionTracker),
  reviewWaveSchedule: readJson(inputs.reviewWaveSchedule),
  reviewDropoffManifest: readJson(inputs.reviewDropoffManifest),
  goldAdjudicationPlan: readJson(inputs.goldAdjudicationPlan),
  scaleAdjudicationPlan: readJson(inputs.scaleAdjudicationPlan),
  reproductionCapsule: readJson(inputs.reproductionCapsule),
  versionManifest: readJson(inputs.versionManifest),
  releaseGate: readJson(inputs.releaseGate),
})

writeJson(checklistJsonPath, checklist)
writeText(checklistMarkdownPath, renderMarkdown(checklist))
console.log(`Wrote hard grounded research artifact checklist to ${checklistJsonPath}`)
console.log(`Wrote hard grounded research artifact checklist report to ${checklistMarkdownPath}`)
